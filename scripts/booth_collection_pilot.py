#!/usr/bin/env python3
"""Fail-closed, manual-only BOOTH collection research pilot."""

from __future__ import annotations

import argparse
import hashlib
import http.client
import json
import random
import re
import ssl
import time
import unicodedata
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Callable, Iterable, Mapping, Protocol
from urllib.parse import urljoin, urlsplit, urlunsplit

SCHEMA_VERSION = 1
TEXT_NORMALIZATION_VERSION = "booth-text-v1"
POLICY_HTML_NORMALIZATION_VERSION = "booth-policy-visible-text-v2"
NORMALIZATION_VERSION = "booth-mixed-v2"
PARSER_VERSION = "stage8-pilot-v5"
USER_AGENT_TOKEN = "trpg-booth-search-pilot"
USER_AGENT = (
    "trpg-booth-search-pilot/1.0 "
    "(bounded research prototype; https://github.com/shiroku46/trpg-booth-search)"
)

MAX_LISTING_REQUESTS = 20
CURRENT_FIXED_REQUEST_LIMIT = 1
MIN_DELAY_SECONDS = 10.0
MAX_JITTER_SECONDS = 2.0
CONNECT_TIMEOUT_SECONDS = 10.0
READ_TIMEOUT_SECONDS = 10.0
TOTAL_REQUEST_TIMEOUT_SECONDS = 30.0
MAX_PREFLIGHT_BYTES = 2_000_000
MAX_PAGE_BYTES = 1_000_000
MAX_REDIRECTS = 3
READ_CHUNK_BYTES = 65_536

ROBOTS_URL = "https://booth.pm/robots.txt"
GUIDELINE_URL = "https://booth.pm/guidelines"
TERMS_URL = "https://policies.pixiv.net/"
PILOT_ENDPOINTS = ("https://booth.pm/ja/browse/TRPG?adult=none&type=digital",)
PREFLIGHT_URLS = (ROBOTS_URL, GUIDELINE_URL, TERMS_URL)

SENSITIVE_HEADER_NAMES = {
    "authorization",
    "cookie",
    "proxy-authorization",
    "set-cookie",
    "x-api-key",
}
STOP_STATUS = {401: "http_401", 403: "http_403", 429: "http_429"}
ACCESS_CHALLENGE_MARKERS = (
    b"captcha",
    b"cf-chl-",
    b"cloudflare ray id",
    "ログインしてください".encode(),
)
AGE_CONTENT_MARKERS = (
    "年齢確認".encode(),
    b"r-18",
    b"r18",
)
POLICY_VISIBLE_TEXT_MARKER_GROUPS = {
    GUIDELINE_URL: (
        ("ガイドライン", "guideline"),
        ("スクレイピング", "scraping"),
        ("ユーザーの利便性向上", "user convenience"),
        ("創作活動の健全な発展", "healthy development"),
    ),
    TERMS_URL: (
        ("pixiv", "ピクシブ"),
        ("規約", "terms"),
    ),
}
_UNRESERVED = frozenset(
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
)
_HEX = frozenset("0123456789abcdefABCDEF")


class PilotStop(RuntimeError):
    """A bounded, non-sensitive stop reason suitable for durable evidence."""

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
    request_attempts: int = 1
    redirect_count: int = 0


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
    request_attempts: int
    redirect_count: int
    evidence: HashEvidence


@dataclass(frozen=True)
class RobotsRule:
    allow: bool
    pattern: str
    end_anchor: bool
    normalized_pattern: str
    specificity: int


@dataclass
class PreflightProgress:
    attempted_urls: list[str]
    records: list[PolicyRecord]
    decisions: list[dict[str, object]]
    digest: str | None = None

    @classmethod
    def empty(cls) -> "PreflightProgress":
        return cls(attempted_urls=[], records=[], decisions=[])


class ResponseLike(Protocol):
    status: int

    def read(self, amount: int) -> bytes: ...

    def getheader(self, name: str, default: str | None = None) -> str | None: ...


class _VisibleTextParser(HTMLParser):
    """Extract human-visible text while ignoring volatile scripts and markup."""

    SKIP_TAGS = frozenset({"script", "style", "noscript", "template", "svg"})

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._skip_depth = 0
        self._chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:  # noqa: ANN001
        if tag.lower() in self.SKIP_TAGS:
            self._skip_depth += 1

    def handle_startendtag(self, tag: str, attrs) -> None:  # noqa: ANN001
        return

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in self.SKIP_TAGS and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self._skip_depth and data:
            self._chunks.append(data)

    def visible_text(self) -> str:
        return " ".join(" ".join(self._chunks).split())


def _triplet(value: str, index: int) -> tuple[int, int] | None:
    if (
        value[index:index + 1] == "%"
        and index + 2 < len(value)
        and value[index + 1] in _HEX
        and value[index + 2] in _HEX
    ):
        return int(value[index + 1:index + 3], 16), index + 3
    return None


def _normalize_octets(value: str, *, wildcard: bool) -> str:
    output: list[str] = []
    index = 0
    while index < len(value):
        char = value[index]
        if wildcard and char == "*":
            output.append("*")
            index += 1
            continue
        encoded = _triplet(value, index)
        if encoded:
            octet, index = encoded
            output.append(chr(octet) if octet in _UNRESERVED else f"%{octet:02X}")
            continue
        if char == "%":
            raise PilotStop("robots_malformed")
        for octet in char.encode("utf-8"):
            literal = chr(octet)
            if octet in _UNRESERVED or literal in "/?=&;:+,[]@!$'()-":
                output.append(literal)
            else:
                output.append(f"%{octet:02X}")
        index += 1
    return "".join(output)


def _specificity(pattern: str) -> int:
    count = index = 0
    while index < len(pattern):
        if pattern[index] == "*":
            index += 1
            continue
        encoded = _triplet(pattern, index)
        index = encoded[1] if encoded else index + 1
        count += 1
    return count


def _matches(rule: RobotsRule, target: str) -> bool:
    regex = ["^"]
    index = 0
    while index < len(rule.normalized_pattern):
        if rule.normalized_pattern[index] == "*":
            regex.append(".*")
            index += 1
            continue
        encoded = _triplet(rule.normalized_pattern, index)
        if encoded:
            regex.append(re.escape(rule.normalized_pattern[index:index + 3]))
            index += 3
        else:
            regex.append(re.escape(rule.normalized_pattern[index]))
            index += 1
    if rule.end_anchor:
        regex.append("$")
    return re.match("".join(regex), target, flags=re.DOTALL) is not None


class RobotsPolicy:
    """RFC 9309-style matching with *, terminal $, octets and allow ties."""

    def __init__(self, groups: list[tuple[list[str], list[RobotsRule]]]):
        self.groups = groups

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
                    anchored = value.endswith("$")
                    raw_pattern = value[:-1] if anchored else value
                    normalized = _normalize_octets(raw_pattern, wildcard=True)
                    rules.append(
                        RobotsRule(
                            allow=key == "allow",
                            pattern=value,
                            end_anchor=anchored,
                            normalized_pattern=normalized,
                            specificity=_specificity(normalized),
                        )
                    )
        flush()
        if not groups:
            raise PilotStop("robots_malformed")
        return cls(groups)

    def rules_for(self, user_agent: str) -> list[RobotsRule]:
        token = user_agent.lower().split("/", 1)[0]
        exact = [rules for agents, rules in self.groups if token in agents]
        selected = exact or [rules for agents, rules in self.groups if "*" in agents]
        if not selected:
            raise PilotStop("robots_ambiguous")
        return [rule for group in selected for rule in group]

    def allows(self, url: str, user_agent: str = USER_AGENT_TOKEN) -> bool:
        parts = require_url(url, allowed_hosts={"booth.pm"})
        target = parts.path or "/"
        if parts.query:
            target += "?" + parts.query
        target = _normalize_octets(target, wildcard=False)
        matches = [rule for rule in self.rules_for(user_agent) if _matches(rule, target)]
        if not matches:
            return True
        longest = max(rule.specificity for rule in matches)
        return any(rule.allow for rule in matches if rule.specificity == longest)


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


def _decode_normalized(raw: bytes, *, limit: int) -> str:
    if len(raw) > limit:
        raise PilotStop("response_oversized")
    try:
        text = raw.decode("utf-8", "strict")
    except UnicodeDecodeError as exc:
        raise PilotStop("invalid_encoding") from exc
    return (
        unicodedata.normalize("NFC", text)
        .replace("\r\n", "\n")
        .replace("\r", "\n")
    )


def normalized_text(raw: bytes, *, limit: int = MAX_PAGE_BYTES) -> bytes:
    text = _decode_normalized(raw, limit=limit)
    return "\n".join(line.rstrip(" \t") for line in text.split("\n")).encode()


def normalized_policy_html(
    raw: bytes,
    *,
    url: str,
    limit: int = MAX_PREFLIGHT_BYTES,
) -> bytes:
    """Hash only visible policy text, excluding volatile DOM attributes/scripts."""

    parser = _VisibleTextParser()
    try:
        parser.feed(_decode_normalized(raw, limit=limit))
        parser.close()
    except (AssertionError, ValueError) as exc:
        raise PilotStop("policy_html_malformed") from exc
    visible = unicodedata.normalize("NFC", parser.visible_text())
    lowered = visible.casefold()
    required_groups = POLICY_VISIBLE_TEXT_MARKER_GROUPS.get(url, ())
    recognized = all(
        any(marker.casefold() in lowered for marker in group)
        for group in required_groups
    )
    if not visible or not recognized:
        raise PilotStop("policy_visible_text_unrecognized")
    return visible.encode("utf-8")


def hash_evidence(
    raw: bytes,
    *,
    limit: int = MAX_PAGE_BYTES,
    policy_url: str | None = None,
) -> HashEvidence:
    if policy_url in {GUIDELINE_URL, TERMS_URL}:
        normalized = normalized_policy_html(raw, url=policy_url, limit=limit)
        version = POLICY_HTML_NORMALIZATION_VERSION
    else:
        normalized = normalized_text(raw, limit=limit)
        version = TEXT_NORMALIZATION_VERSION
    return HashEvidence(
        byte_length=len(raw),
        raw_sha256=hashlib.sha256(raw).hexdigest(),
        normalized_version=version,
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
    if value != CURRENT_FIXED_REQUEST_LIMIT or value > len(PILOT_ENDPOINTS):
        raise PilotStop("request_limit_exceeds_fixed_plan")
    return value


def bounded_delay(jitter_fraction: float) -> float:
    if not 0.0 <= jitter_fraction <= 1.0:
        raise PilotStop("invalid_jitter")
    return MIN_DELAY_SECONDS + MAX_JITTER_SECONDS * jitter_fraction


def safe_headers(headers: Mapping[str, str]) -> dict[str, str]:
    lowered = {str(key).lower(): str(value) for key, value in headers.items()}
    if SENSITIVE_HEADER_NAMES.intersection(lowered):
        raise PilotStop("sensitive_header_present")
    return lowered


def classify_response(
    result: FetchResult,
    *,
    expected_types: tuple[str, ...],
    limit: int,
    inspect_listing_markers: bool,
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
    if inspect_listing_markers:
        body_lower = result.body.lower()
        if any(marker.lower() in body_lower for marker in ACCESS_CHALLENGE_MARKERS):
            raise PilotStop("challenge_or_login_gate")
        if any(marker.lower() in body_lower for marker in AGE_CONTENT_MARKERS):
            raise PilotStop("age_or_adult_signal")


def policy_digest(
    records: list[PolicyRecord],
    decisions: list[dict[str, object]],
) -> str:
    """Bind approval to semantic policy text, not volatile HTML shell bytes."""

    payload = {
        "records": [
            {
                "url": record.url,
                "final_url": record.final_url,
                "status": record.status,
                "content_type": record.content_type.split(";", 1)[0].strip().lower(),
                "request_attempts": record.request_attempts,
                "redirect_count": record.redirect_count,
                "semantic_evidence": {
                    "normalized_version": record.evidence.normalized_version,
                    "normalized_sha256": record.evidence.normalized_sha256,
                },
            }
            for record in records
        ],
        "decisions": decisions,
        "parser_version": PARSER_VERSION,
    }
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode()
    return hashlib.sha256(canonical).hexdigest()


def _read_bounded(
    response: ResponseLike,
    *,
    max_bytes: int,
    deadline: float,
    clock: Callable[[], float],
    set_timeout: Callable[[float], None],
) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while total <= max_bytes:
        remaining_time = deadline - clock()
        if remaining_time <= 0:
            raise PilotStop("request_timeout")
        set_timeout(min(READ_TIMEOUT_SECONDS, remaining_time))
        chunk = response.read(min(READ_CHUNK_BYTES, max_bytes + 1 - total))
        if not chunk:
            break
        chunks.append(chunk)
        total += len(chunk)
    return b"".join(chunks)


class DirectHttpsTransport:
    """Direct HTTPS transport that ignores proxy env and never stores cookies."""

    def __init__(
        self,
        *,
        connection_factory: Callable[..., object] = http.client.HTTPSConnection,
        context_factory: Callable[[], ssl.SSLContext] = ssl.create_default_context,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.connection_factory = connection_factory
        self.context_factory = context_factory
        self.clock = clock

    def __call__(
        self,
        url: str,
        *,
        max_bytes: int,
        expected_hosts: set[str],
        allowed_exact: Iterable[str] | None = None,
        follow_redirects: bool = True,
    ) -> FetchResult:
        requested = current = url
        started = self.clock()
        attempts = 0
        try:
            context = self.context_factory()
        except (OSError, ssl.SSLError) as exc:
            raise PilotStop("network_error") from exc

        for redirect_count in range(MAX_REDIRECTS + 1):
            parts = require_url(
                current,
                allowed_hosts=expected_hosts,
                allowed_exact=allowed_exact,
            )
            remaining = TOTAL_REQUEST_TIMEOUT_SECONDS - (self.clock() - started)
            if remaining <= 0:
                raise PilotStop("request_timeout")
            try:
                connection = self.connection_factory(
                    parts.hostname,
                    443,
                    timeout=min(CONNECT_TIMEOUT_SECONDS, remaining),
                    context=context,
                )
            except (
                OSError,
                ssl.SSLError,
                http.client.HTTPException,
                TimeoutError,
            ) as exc:
                raise PilotStop("network_error") from exc
            path = (parts.path or "/") + (("?" + parts.query) if parts.query else "")
            headers = safe_headers(
                {
                    "User-Agent": USER_AGENT,
                    "Accept": "text/plain,text/html;q=0.9",
                    "Connection": "close",
                }
            )
            attempts += 1
            try:
                connection.request("GET", path, headers=headers)
                response = connection.getresponse()
                sock = getattr(connection, "sock", None)

                def set_timeout(value: float) -> None:
                    if sock is not None:
                        sock.settimeout(value)

                body = _read_bounded(
                    response,
                    max_bytes=max_bytes,
                    deadline=started + TOTAL_REQUEST_TIMEOUT_SECONDS,
                    clock=self.clock,
                    set_timeout=set_timeout,
                )
                content_type = response.getheader("Content-Type", "") or ""
                location = response.getheader("Location")
                status = response.status
            except PilotStop:
                raise
            except (
                OSError,
                ssl.SSLError,
                http.client.HTTPException,
                TimeoutError,
            ) as exc:
                raise PilotStop("network_error") from exc
            finally:
                connection.close()

            if 300 <= status < 400 and follow_redirects:
                if not location:
                    raise PilotStop("redirect_without_location")
                current = urljoin(current, location)
                require_url(
                    current,
                    allowed_hosts=expected_hosts,
                    allowed_exact=allowed_exact,
                )
                continue

            return FetchResult(
                requested_url=requested,
                final_url=current,
                status=status,
                content_type=content_type,
                body=body,
                elapsed_ms=int((self.clock() - started) * 1000),
                request_attempts=attempts,
                redirect_count=redirect_count,
            )

        raise PilotStop("too_many_redirects")


def preflight(
    transport: Callable[..., FetchResult],
    *,
    progress: PreflightProgress | None = None,
) -> tuple[list[PolicyRecord], list[dict[str, object]], str]:
    state = progress if progress is not None else PreflightProgress.empty()
    expectations = {
        ROBOTS_URL: (("text/plain",), MAX_PREFLIGHT_BYTES, {"booth.pm"}),
        GUIDELINE_URL: (("text/html",), MAX_PREFLIGHT_BYTES, {"booth.pm"}),
        TERMS_URL: (("text/html",), MAX_PREFLIGHT_BYTES, {"policies.pixiv.net"}),
    }
    fetched: dict[str, FetchResult] = {}

    for url in PREFLIGHT_URLS:
        expected_types, limit, hosts = expectations[url]
        state.attempted_urls.append(url)
        response = transport(
            url,
            max_bytes=limit,
            expected_hosts=hosts,
            follow_redirects=True,
        )
        require_url(response.final_url, allowed_hosts=hosts)
        classify_response(
            response,
            expected_types=expected_types,
            limit=limit,
            inspect_listing_markers=False,
        )
        state.records.append(
            PolicyRecord(
                url=url,
                final_url=response.final_url,
                status=response.status,
                content_type=response.content_type,
                retrieved_at=utc_now(),
                request_attempts=response.request_attempts,
                redirect_count=response.redirect_count,
                evidence=hash_evidence(
                    response.body,
                    limit=limit,
                    policy_url=url if url in {GUIDELINE_URL, TERMS_URL} else None,
                ),
            )
        )
        fetched[url] = response

    robots = RobotsPolicy.parse(fetched[ROBOTS_URL].body)
    robots_allowed = [robots.allows(endpoint) for endpoint in PILOT_ENDPOINTS]
    state.decisions.extend(
        [
            {
                "kind": "robots",
                "url": endpoint,
                "allowed": allowed,
                "user_agent": USER_AGENT_TOKEN,
                "decision": "allow" if allowed else "deny",
            }
            for endpoint, allowed in zip(PILOT_ENDPOINTS, robots_allowed, strict=True)
        ]
    )
    state.decisions.extend(
        [
            {
                "kind": "official_guideline",
                "url": GUIDELINE_URL,
                "decision": "semantic_visible_text_review_required",
            },
            {
                "kind": "official_terms",
                "url": TERMS_URL,
                "decision": "semantic_visible_text_review_required",
            },
        ]
    )
    state.digest = policy_digest(state.records, state.decisions)
    if not all(robots_allowed):
        raise PilotStop("robots_restricted")
    return state.records, state.decisions, state.digest


def build_dry_run_evidence() -> dict[str, object]:
    return {
        "schema_version": SCHEMA_VERSION,
        "parser_version": PARSER_VERSION,
        "mode": "dry-run",
        "network_requests": 0,
        "preflight_fetches": 0,
        "preflight_attempted_urls": [],
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
    jitter_source: Callable[[], float] = random.random,
) -> dict[str, object]:
    progress = PreflightProgress.empty()
    listing_records: list[dict[str, object]] = []
    observed_delays: list[float] = []
    listing_requests = 0
    stop_reason: str | None = None
    policy_review_decision = "not_reviewed"

    try:
        preflight(transport, progress=progress)
        if not re.fullmatch(r"[0-9a-f]{64}", approval_digest or ""):
            raise PilotStop("current_policy_review_required")
        if approval_digest != progress.digest:
            raise PilotStop("policy_digest_mismatch")
        policy_review_decision = "approved_semantic_digest"

        for index, endpoint in enumerate(PILOT_ENDPOINTS[:request_limit]):
            if index:
                delay = bounded_delay(jitter_source())
                observed_delays.append(delay)
                sleeper(delay)
            listing_requests += 1
            response = transport(
                endpoint,
                max_bytes=MAX_PAGE_BYTES,
                expected_hosts={"booth.pm"},
                allowed_exact=PILOT_ENDPOINTS,
                follow_redirects=False,
            )
            require_url(
                response.final_url,
                allowed_hosts={"booth.pm"},
                allowed_exact=PILOT_ENDPOINTS,
            )
            classify_response(
                response,
                expected_types=("text/html",),
                limit=MAX_PAGE_BYTES,
                inspect_listing_markers=True,
            )
            listing_records.append(
                {
                    "sequence": listing_requests,
                    "url": endpoint,
                    "final_url": response.final_url,
                    "status": response.status,
                    "content_type": response.content_type,
                    "elapsed_ms": response.elapsed_ms,
                    "request_attempts": response.request_attempts,
                    "redirect_count": response.redirect_count,
                    "evidence": asdict(hash_evidence(response.body)),
                    "checked_at": utc_now(),
                }
            )
    except PilotStop as exc:
        stop_reason = exc.reason

    statuses: dict[str, int] = {}
    for record in listing_records:
        key = str(record["status"])
        statuses[key] = statuses.get(key, 0) + 1

    return {
        "schema_version": SCHEMA_VERSION,
        "parser_version": PARSER_VERSION,
        "normalization_version": NORMALIZATION_VERSION,
        "mode": "network",
        "preflight": [asdict(record) for record in progress.records],
        "preflight_fetches": len(progress.attempted_urls),
        "preflight_attempted_urls": list(progress.attempted_urls),
        "endpoint_decisions": list(progress.decisions),
        "policy_digest": progress.digest,
        "policy_review": {
            "decision": policy_review_decision,
            "approval_digest_supplied": bool(approval_digest),
            "approval_digest_matches_current": (
                bool(progress.digest) and approval_digest == progress.digest
            ),
        },
        "listing_requests": listing_requests,
        "listing_records": listing_records,
        "status_distribution": statuses,
        "request_ceiling": request_limit,
        "delay_policy": {
            "minimum_seconds": MIN_DELAY_SECONDS,
            "maximum_jitter_seconds": MAX_JITTER_SECONDS,
            "applies_between_listing_requests": True,
            "current_single_request_plan_is_vacuous": request_limit == 1,
            "observed_delays_seconds": observed_delays,
        },
        "transport_limits": {
            "connect_timeout_seconds": CONNECT_TIMEOUT_SECONDS,
            "read_timeout_seconds": READ_TIMEOUT_SECONDS,
            "total_request_timeout_seconds": TOTAL_REQUEST_TIMEOUT_SECONDS,
            "max_redirects_preflight": MAX_REDIRECTS,
            "listing_redirects_followed": False,
            "max_preflight_bytes": MAX_PREFLIGHT_BYTES,
            "max_page_bytes": MAX_PAGE_BYTES,
        },
        "single_concurrency": True,
        "stop_state": "stopped" if stop_reason else "complete",
        "stop_reason": stop_reason,
        "forbidden_data_persisted": False,
    }


def write_evidence(path: Path, evidence: dict[str, object]) -> None:
    raw = json.dumps(evidence, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    lowered = raw.lower()
    for forbidden in (
        "authorization",
        "cookie",
        "set-cookie",
        "exact_price",
        "full_body",
    ):
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
        if args.mode == "dry-run" and args.policy_approval_digest:
            raise PilotStop("dry_run_policy_digest_forbidden")
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
                "preflight_fetches": 0,
                "preflight_attempted_urls": [],
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
