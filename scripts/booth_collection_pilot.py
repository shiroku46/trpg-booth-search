#!/usr/bin/env python3
"""Fail-closed, one-shot BOOTH collection research pilot.

The module is intentionally dependency-free. CI exercises only the pure planning,
robots, classification, and hashing boundaries. Network access occurs only when
an owner explicitly dispatches the dedicated workflow in ``network`` mode.
"""

from __future__ import annotations

import argparse
import hashlib
import http.client
import json
import re
import ssl
import time
import unicodedata
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterable, Mapping
from urllib.parse import urljoin, urlsplit, urlunsplit

SCHEMA_VERSION = 1
NORMALIZATION_VERSION = "booth-text-v1"
PARSER_VERSION = "stage8-pilot-v1"
USER_AGENT_TOKEN = "trpg-booth-search-pilot"
USER_AGENT = (
    "trpg-booth-search-pilot/1.0 "
    "(bounded research prototype; https://github.com/shiroku46/trpg-booth-search)"
)
MAX_LISTING_REQUESTS = 20
MIN_DELAY_SECONDS = 10.0
MAX_JITTER_SECONDS = 2.0
CONNECT_TIMEOUT_SECONDS = 10.0
MAX_PREFLIGHT_BYTES = 2_000_000
MAX_PAGE_BYTES = 1_000_000
MAX_REDIRECTS = 3

ROBOTS_URL = "https://booth.pm/robots.txt"
GUIDELINE_URL = "https://booth.pm/guidelines"
TERMS_URL = "https://policies.pixiv.net/"
PILOT_ENDPOINTS = (
    "https://booth.pm/ja/browse/TRPG?adult=none&type=digital",
)
PREFLIGHT_URLS = (ROBOTS_URL, GUIDELINE_URL, TERMS_URL)

SENSITIVE_HEADER_NAMES = {
    "authorization",
    "cookie",
    "proxy-authorization",
    "set-cookie",
    "x-api-key",
}
STOP_STATUS = {401: "http_401", 403: "http_403", 429: "http_429"}
CHALLENGE_MARKERS = (
    b"captcha",
    b"cf-chl-",
    b"cloudflare ray id",
    "年齢確認".encode(),
    "ログインしてください".encode(),
    "r-18".encode(),
    "r18".encode(),
)


class PilotStop(RuntimeError):
    """Expected fail-closed stop with a stable machine reason."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class FetchResult:
    requested_url: str
    final_url: str
    status: int
    content_type: str
    body: bytes
    elapsed_ms: int


@dataclass(frozen=True)
class HashEvidence:
    byte_length: int
    raw_sha256: str
    normalized_version: str
    normalized_sha256: str


@dataclass(frozen=True)
class PolicyRecord:
    url: str
    final_url: str
    status: int
    content_type: str
    retrieved_at: str
    evidence: HashEvidence


@dataclass(frozen=True)
class RobotsRule:
    allow: bool
    pattern: str


class RobotsPolicy:
    """Strict robots parser with longest-match semantics."""

    def __init__(self, groups: list[tuple[list[str], list[RobotsRule]]]):
        self._groups = groups

    @classmethod
    def parse(cls, raw: bytes) -> "RobotsPolicy":
        if len(raw) > MAX_PREFLIGHT_BYTES:
            raise PilotStop("robots_oversized")
        try:
            text = raw.decode("utf-8", "strict")
        except UnicodeDecodeError as exc:
            raise PilotStop("robots_invalid_encoding") from exc

        groups: list[tuple[list[str], list[RobotsRule]]] = []
        agents: list[str] = []
        rules: list[RobotsRule] = []
        saw_rule = False

        def flush() -> None:
            nonlocal agents, rules, saw_rule
            if agents:
                groups.append((agents, rules))
            agents, rules, saw_rule = [], [], False

        for original in text.splitlines():
            line = original.split("#", 1)[0].strip()
            if not line:
                if agents and saw_rule:
                    flush()
                continue
            if ":" not in line:
                raise PilotStop("robots_malformed")
            field, value = (part.strip() for part in line.split(":", 1))
            key = field.lower()
            if key == "user-agent":
                if not value:
                    raise PilotStop("robots_malformed")
                if agents and saw_rule:
                    flush()
                agents.append(value.lower())
            elif key in {"allow", "disallow"}:
                if not agents:
                    raise PilotStop("robots_malformed")
                saw_rule = True
                if value:
                    if not value.startswith("/"):
                        raise PilotStop("robots_malformed")
                    rules.append(RobotsRule(key == "allow", value))
            else:
                continue
        flush()
        if not groups:
            raise PilotStop("robots_malformed")
        return cls(groups)

    def rules_for(self, user_agent: str) -> list[RobotsRule]:
        token = user_agent.lower().split("/", 1)[0]
        exact = [rules for agents, rules in self._groups if token in agents]
        selected = exact or [rules for agents, rules in self._groups if "*" in agents]
        if not selected:
            raise PilotStop("robots_ambiguous")
        return [rule for group in selected for rule in group]

    def allows(self, url: str, user_agent: str = USER_AGENT_TOKEN) -> bool:
        parts = require_url(url, allowed_hosts={"booth.pm"})
        path = parts.path or "/"
        if parts.query:
            path += "?" + parts.query
        matches = [
            rule
            for rule in self.rules_for(user_agent)
            if path.startswith(rule.pattern)
        ]
        if not matches:
            return True
        longest = max(len(rule.pattern) for rule in matches)
        finalists = [rule for rule in matches if len(rule.pattern) == longest]
        return any(rule.allow for rule in finalists)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def require_url(
    url: str,
    *,
    allowed_hosts: set[str],
    allowed_exact: Iterable[str] | None = None,
):
    parts = urlsplit(url)
    if (
        parts.scheme != "https"
        or parts.hostname not in allowed_hosts
        or parts.username is not None
        or parts.password is not None
        or parts.port not in {None, 443}
        or parts.fragment
    ):
        raise PilotStop("url_not_allowed")
    canonical = urlunsplit(
        ("https", parts.hostname or "", parts.path or "/", parts.query, "")
    )
    if allowed_exact is not None and canonical not in set(allowed_exact):
        raise PilotStop("endpoint_not_allowlisted")
    return parts


def normalized_text(raw: bytes, *, limit: int = MAX_PAGE_BYTES) -> bytes:
    if len(raw) > limit:
        raise PilotStop("response_oversized")
    try:
        text = raw.decode("utf-8", "strict")
    except UnicodeDecodeError as exc:
        raise PilotStop("invalid_encoding") from exc
    text = unicodedata.normalize("NFC", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = "\n".join(line.rstrip(" \t") for line in text.split("\n"))
    return text.encode("utf-8")


def hash_evidence(raw: bytes, *, limit: int = MAX_PAGE_BYTES) -> HashEvidence:
    normalized = normalized_text(raw, limit=limit)
    return HashEvidence(
        byte_length=len(raw),
        raw_sha256=hashlib.sha256(raw).hexdigest(),
        normalized_version=NORMALIZATION_VERSION,
        normalized_sha256=hashlib.sha256(normalized).hexdigest(),
    )


def unchanged_content(previous_normalized_sha256: str | None, raw: bytes) -> bool:
    return bool(previous_normalized_sha256) and (
        hash_evidence(raw).normalized_sha256 == previous_normalized_sha256
    )


def validate_request_limit(mode: str, value: int) -> int:
    if mode == "dry-run":
        if value != 0:
            raise PilotStop("dry_run_request_limit_must_be_zero")
        return 0
    if mode != "network" or not 1 <= value <= MAX_LISTING_REQUESTS:
        raise PilotStop("invalid_request_limit")
    if value > len(PILOT_ENDPOINTS):
        raise PilotStop("request_limit_exceeds_fixed_plan")
    return value


def safe_headers(headers: Mapping[str, str]) -> dict[str, str]:
    lowered = {str(key).lower(): str(value) for key, value in headers.items()}
    if SENSITIVE_HEADER_NAMES.intersection(lowered):
        raise PilotStop("sensitive_header_present")
    return lowered


def classify_response(
    result: FetchResult, *, expected_types: tuple[str, ...], limit: int
) -> None:
    if result.status in STOP_STATUS:
        raise PilotStop(STOP_STATUS[result.status])
    if 300 <= result.status < 400:
        raise PilotStop("unexpected_redirect")
    if 500 <= result.status:
        raise PilotStop("server_error")
    if result.status != 200:
        raise PilotStop("unexpected_status")
    if len(result.body) > limit:
        raise PilotStop("response_oversized")
    media_type = result.content_type.split(";", 1)[0].strip().lower()
    if media_type not in expected_types:
        raise PilotStop("unexpected_content_type")
    sample = result.body[:131072].lower()
    if any(marker.lower() in sample for marker in CHALLENGE_MARKERS):
        raise PilotStop("challenge_or_age_gate")


def policy_digest(
    records: list[PolicyRecord], endpoint_decisions: list[dict[str, object]]
) -> str:
    payload = {
        "records": [
            {
                "url": record.url,
                "final_url": record.final_url,
                "status": record.status,
                "content_type": record.content_type,
                "evidence": asdict(record.evidence),
            }
            for record in records
        ],
        "endpoint_decisions": endpoint_decisions,
        "parser_version": PARSER_VERSION,
    }
    canonical = json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode()
    return hashlib.sha256(canonical).hexdigest()


class DirectHttpsTransport:
    """Credential-free direct HTTPS transport without proxy or cookie support."""

    def __call__(
        self, url: str, *, max_bytes: int, expected_hosts: set[str]
    ) -> FetchResult:
        requested = url
        current = url
        started = time.monotonic()
        context = ssl.create_default_context()
        for _ in range(MAX_REDIRECTS + 1):
            parts = require_url(current, allowed_hosts=expected_hosts)
            connection = http.client.HTTPSConnection(
                parts.hostname,
                port=443,
                timeout=CONNECT_TIMEOUT_SECONDS,
                context=context,
            )
            path = parts.path or "/"
            if parts.query:
                path += "?" + parts.query
            headers = {
                "User-Agent": USER_AGENT,
                "Accept": "text/plain,text/html;q=0.9",
                "Connection": "close",
            }
            safe_headers(headers)
            try:
                connection.request("GET", path, headers=headers)
                response = connection.getresponse()
                body = response.read(max_bytes + 1)
                content_type = response.getheader("Content-Type", "")
                location = response.getheader("Location")
                status = response.status
            finally:
                connection.close()
            if 300 <= status < 400:
                if not location:
                    raise PilotStop("redirect_without_location")
                next_url = urljoin(current, location)
                require_url(next_url, allowed_hosts=expected_hosts)
                current = next_url
                continue
            return FetchResult(
                requested_url=requested,
                final_url=current,
                status=status,
                content_type=content_type,
                body=body,
                elapsed_ms=int((time.monotonic() - started) * 1000),
            )
        raise PilotStop("too_many_redirects")


def preflight(
    transport: Callable[..., FetchResult],
) -> tuple[list[PolicyRecord], list[dict[str, object]], str]:
    records: list[PolicyRecord] = []
    fetched: dict[str, FetchResult] = {}
    expectations = {
        ROBOTS_URL: (("text/plain",), MAX_PREFLIGHT_BYTES, {"booth.pm"}),
        GUIDELINE_URL: (("text/html",), MAX_PREFLIGHT_BYTES, {"booth.pm"}),
        TERMS_URL: (("text/html",), MAX_PREFLIGHT_BYTES, {"policies.pixiv.net"}),
    }
    for url in PREFLIGHT_URLS:
        expected_types, limit, hosts = expectations[url]
        response = transport(url, max_bytes=limit, expected_hosts=hosts)
        require_url(response.final_url, allowed_hosts=hosts)
        classify_response(response, expected_types=expected_types, limit=limit)
        record = PolicyRecord(
            url=url,
            final_url=response.final_url,
            status=response.status,
            content_type=response.content_type,
            retrieved_at=utc_now(),
            evidence=hash_evidence(response.body, limit=limit),
        )
        records.append(record)
        fetched[url] = response

    robots = RobotsPolicy.parse(fetched[ROBOTS_URL].body)
    decisions = [
        {
            "url": endpoint,
            "allowed": robots.allows(endpoint),
            "user_agent": USER_AGENT_TOKEN,
        }
        for endpoint in PILOT_ENDPOINTS
    ]
    if not all(item["allowed"] for item in decisions):
        raise PilotStop("robots_restricted")
    return records, decisions, policy_digest(records, decisions)


def build_dry_run_evidence() -> dict[str, object]:
    return {
        "schema_version": SCHEMA_VERSION,
        "parser_version": PARSER_VERSION,
        "mode": "dry-run",
        "network_requests": 0,
        "listing_requests": 0,
        "fixed_endpoints": list(PILOT_ENDPOINTS),
        "stop_state": "dry_run",
        "stop_reason": None,
        "forbidden_data_persisted": False,
    }


def run_network(
    *,
    request_limit: int,
    approval_digest: str,
    transport: Callable[..., FetchResult],
    sleeper: Callable[[float], None] = time.sleep,
) -> dict[str, object]:
    records: list[PolicyRecord] = []
    decisions: list[dict[str, object]] = []
    listing_records: list[dict[str, object]] = []
    listing_requests = 0
    stop_reason: str | None = None
    computed_digest: str | None = None
    try:
        records, decisions, computed_digest = preflight(transport)
        if not re.fullmatch(r"[0-9a-f]{64}", approval_digest or ""):
            raise PilotStop("current_policy_review_required")
        if approval_digest != computed_digest:
            raise PilotStop("policy_digest_mismatch")

        for index, endpoint in enumerate(PILOT_ENDPOINTS[:request_limit]):
            if index:
                sleeper(MIN_DELAY_SECONDS)
            response = transport(
                endpoint,
                max_bytes=MAX_PAGE_BYTES,
                expected_hosts={"booth.pm"},
            )
            listing_requests += 1
            require_url(
                response.final_url,
                allowed_hosts={"booth.pm"},
                allowed_exact=PILOT_ENDPOINTS,
            )
            classify_response(
                response,
                expected_types=("text/html",),
                limit=MAX_PAGE_BYTES,
            )
            listing_records.append(
                {
                    "sequence": listing_requests,
                    "url": endpoint,
                    "final_url": response.final_url,
                    "status": response.status,
                    "content_type": response.content_type,
                    "elapsed_ms": response.elapsed_ms,
                    "evidence": asdict(hash_evidence(response.body)),
                    "checked_at": utc_now(),
                }
            )
    except PilotStop as exc:
        stop_reason = exc.reason

    return {
        "schema_version": SCHEMA_VERSION,
        "parser_version": PARSER_VERSION,
        "normalization_version": NORMALIZATION_VERSION,
        "mode": "network",
        "preflight": [asdict(record) for record in records],
        "endpoint_decisions": decisions,
        "policy_digest": computed_digest,
        "listing_requests": listing_requests,
        "listing_records": listing_records,
        "request_ceiling": request_limit,
        "minimum_delay_seconds": MIN_DELAY_SECONDS,
        "single_concurrency": True,
        "stop_state": "stopped" if stop_reason else "complete",
        "stop_reason": stop_reason,
        "forbidden_data_persisted": False,
    }


def write_evidence(path: Path, evidence: dict[str, object]) -> None:
    raw = json.dumps(evidence, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    lowered = raw.lower()
    for forbidden in ("authorization", "set-cookie", "exact_price", "full_body"):
        if forbidden in lowered:
            raise PilotStop("forbidden_evidence_field")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(raw, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("dry-run", "network"), default="dry-run")
    parser.add_argument("--request-limit", type=int, default=0)
    parser.add_argument("--policy-approval-digest", default="")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)

    try:
        request_limit = validate_request_limit(args.mode, args.request_limit)
        evidence = (
            build_dry_run_evidence()
            if args.mode == "dry-run"
            else run_network(
                request_limit=request_limit,
                approval_digest=args.policy_approval_digest,
                transport=DirectHttpsTransport(),
            )
        )
        write_evidence(args.output, evidence)
    except PilotStop as exc:
        write_evidence(
            args.output,
            {
                "schema_version": SCHEMA_VERSION,
                "parser_version": PARSER_VERSION,
                "mode": args.mode,
                "listing_requests": 0,
                "stop_state": "stopped",
                "stop_reason": exc.reason,
                "forbidden_data_persisted": False,
            },
        )
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
