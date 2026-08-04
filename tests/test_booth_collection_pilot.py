import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from scripts.booth_collection_pilot import (
    GUIDELINE_URL,
    MAX_LISTING_REQUESTS,
    PILOT_ENDPOINTS,
    ROBOTS_URL,
    TERMS_URL,
    FetchResult,
    PilotStop,
    RobotsPolicy,
    build_dry_run_evidence,
    hash_evidence,
    normalized_text,
    preflight,
    require_url,
    run_network,
    unchanged_content,
    validate_request_limit,
    write_evidence,
)

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/booth-collection-pilot.yml"


def result(url: str, body: bytes, content_type: str = "text/html") -> FetchResult:
    return FetchResult(url, url, 200, content_type, body, 1)


class BoothCollectionPilotTest(unittest.TestCase):
    def test_robots_longest_match_and_allow_tie(self):
        policy = RobotsPolicy.parse(
            b"""User-agent: *
Disallow: /ja/
Allow: /ja/browse/
Disallow: /ja/browse/private
Allow: /ja/browse/private-safe
"""
        )
        self.assertTrue(policy.allows("https://booth.pm/ja/browse/TRPG"))
        self.assertFalse(policy.allows("https://booth.pm/ja/account"))
        self.assertFalse(policy.allows("https://booth.pm/ja/browse/private/item"))
        self.assertTrue(policy.allows("https://booth.pm/ja/browse/private-safe/item"))
        tie = RobotsPolicy.parse(
            b"User-agent: *\nDisallow: /same\nAllow: /same\n"
        )
        self.assertTrue(tie.allows("https://booth.pm/same/path"))

    def test_robots_prefers_declared_agent_and_fails_without_matching_group(self):
        policy = RobotsPolicy.parse(
            b"""User-agent: *
Disallow: /

User-agent: trpg-booth-search-pilot
Allow: /ja/browse/
Disallow: /
"""
        )
        self.assertTrue(policy.allows(PILOT_ENDPOINTS[0]))
        with self.assertRaisesRegex(PilotStop, "robots_ambiguous"):
            RobotsPolicy.parse(
                b"User-agent: another-bot\nAllow: /\n"
            ).allows(PILOT_ENDPOINTS[0])

    def test_robots_invalid_inputs_fail_closed(self):
        for raw, reason in [
            (b"\xff", "robots_invalid_encoding"),
            (b"Disallow: /\n", "robots_malformed"),
            (b"User-agent *\nDisallow: /\n", "robots_malformed"),
            (b"User-agent: *\nDisallow: relative\n", "robots_malformed"),
        ]:
            with self.subTest(reason=reason), self.assertRaisesRegex(
                PilotStop, reason
            ):
                RobotsPolicy.parse(raw)

    def test_fixed_endpoint_validation_rejects_arbitrary_urls(self):
        require_url(
            PILOT_ENDPOINTS[0],
            allowed_hosts={"booth.pm"},
            allowed_exact=PILOT_ENDPOINTS,
        )
        for url in (
            "http://booth.pm/ja/browse/TRPG",
            "https://evil.example/ja/browse/TRPG",
            "https://user@booth.pm/ja/browse/TRPG",
            "https://booth.pm:444/ja/browse/TRPG",
            "https://booth.pm/ja/browse/TRPG#fragment",
            "https://booth.pm/ja/items/1",
        ):
            with self.subTest(url=url), self.assertRaises(PilotStop):
                require_url(
                    url,
                    allowed_hosts={"booth.pm"},
                    allowed_exact=PILOT_ENDPOINTS,
                )

    def test_request_ceiling_and_dry_run_are_fail_closed(self):
        self.assertEqual(validate_request_limit("dry-run", 0), 0)
        self.assertEqual(validate_request_limit("network", 1), 1)
        for mode, value in [
            ("dry-run", 1),
            ("network", 0),
            ("network", MAX_LISTING_REQUESTS + 1),
            ("other", 1),
            ("network", 2),
        ]:
            with self.subTest(mode=mode, value=value), self.assertRaises(
                PilotStop
            ):
                validate_request_limit(mode, value)
        dry = build_dry_run_evidence()
        self.assertEqual(dry["network_requests"], 0)
        self.assertEqual(dry["listing_requests"], 0)

    def test_normalization_and_hashes_are_deterministic(self):
        left = b"alpha \r\nbeta\t\r\n"
        right = b"alpha\nbeta\n"
        left_hash = hash_evidence(left)
        right_hash = hash_evidence(right)
        self.assertNotEqual(left_hash.raw_sha256, right_hash.raw_sha256)
        self.assertEqual(
            left_hash.normalized_sha256, right_hash.normalized_sha256
        )
        self.assertEqual(normalized_text(left), b"alpha\nbeta\n")
        self.assertTrue(unchanged_content(left_hash.normalized_sha256, right))
        with self.assertRaisesRegex(PilotStop, "invalid_encoding"):
            normalized_text(b"\xff")
        with self.assertRaisesRegex(PilotStop, "response_oversized"):
            normalized_text(b"abc", limit=2)

    def _preflight_responses(self):
        return {
            ROBOTS_URL: result(
                ROBOTS_URL,
                b"User-agent: trpg-booth-search-pilot\nAllow: /ja/browse/TRPG\n",
                "text/plain; charset=utf-8",
            ),
            GUIDELINE_URL: result(GUIDELINE_URL, b"<html>guideline</html>"),
            TERMS_URL: result(TERMS_URL, b"<html>terms</html>"),
        }

    def test_preflight_records_hashes_and_robots_decisions(self):
        responses = self._preflight_responses()
        transport = Mock(side_effect=lambda url, **_: responses[url])
        records, decisions, digest = preflight(transport)
        self.assertEqual(
            [record.url for record in records],
            [ROBOTS_URL, GUIDELINE_URL, TERMS_URL],
        )
        self.assertTrue(decisions[0]["allowed"])
        self.assertRegex(digest, r"^[0-9a-f]{64}$")
        self.assertEqual(transport.call_count, 3)

    def test_network_stops_before_listing_without_policy_approval(self):
        responses = self._preflight_responses()
        transport = Mock(side_effect=lambda url, **_: responses[url])
        evidence = run_network(
            request_limit=1,
            approval_digest="",
            transport=transport,
            sleeper=Mock(),
        )
        self.assertEqual(evidence["stop_reason"], "current_policy_review_required")
        self.assertEqual(evidence["listing_requests"], 0)
        self.assertEqual(transport.call_count, 3)

    def test_approved_plan_fetches_only_fixed_endpoint_once(self):
        responses = self._preflight_responses()
        responses[PILOT_ENDPOINTS[0]] = result(
            PILOT_ENDPOINTS[0], b"<html>all ages listing</html>"
        )
        _, _, digest = preflight(Mock(side_effect=lambda url, **_: responses[url]))
        transport = Mock(side_effect=lambda url, **_: responses[url])
        evidence = run_network(
            request_limit=1,
            approval_digest=digest,
            transport=transport,
            sleeper=Mock(),
        )
        self.assertEqual(evidence["stop_state"], "complete")
        self.assertEqual(evidence["listing_requests"], 1)
        self.assertEqual(len(evidence["listing_records"]), 1)
        self.assertNotIn("body", evidence["listing_records"][0])

    def test_stop_conditions_do_not_persist_response_body(self):
        base = self._preflight_responses()
        _, _, digest = preflight(Mock(side_effect=lambda url, **_: base[url]))
        cases = [
            (401, "text/html", b"SECRET_RESPONSE_BODY_401", "http_401"),
            (403, "text/html", b"SECRET_RESPONSE_BODY_403", "http_403"),
            (429, "text/html", b"SECRET_RESPONSE_BODY_429", "http_429"),
            (500, "text/html", b"SECRET_RESPONSE_BODY_500", "server_error"),
            (200, "application/json", b'{"private_payload":true}', "unexpected_content_type"),
            (200, "text/html", b"<html>captcha SECRET_BODY</html>", "challenge_or_age_gate"),
            (200, "text/html", "年齢確認 SECRET_BODY".encode(), "challenge_or_age_gate"),
        ]
        for status, content_type, body, reason in cases:
            with self.subTest(reason=reason):
                responses = dict(base)
                responses[PILOT_ENDPOINTS[0]] = FetchResult(
                    PILOT_ENDPOINTS[0],
                    PILOT_ENDPOINTS[0],
                    status,
                    content_type,
                    body,
                    1,
                )
                evidence = run_network(
                    request_limit=1,
                    approval_digest=digest,
                    transport=Mock(side_effect=lambda url, **_: responses[url]),
                    sleeper=Mock(),
                )
                self.assertEqual(evidence["stop_reason"], reason)
                self.assertEqual(evidence["listing_records"], [])
                self.assertNotIn(body.decode(errors="ignore"), json.dumps(evidence))

    def test_evidence_writer_rejects_sensitive_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "evidence.json"
            write_evidence(path, build_dry_run_evidence())
            for key in ("authorization", "set-cookie", "exact_price", "full_body"):
                with self.subTest(key=key), self.assertRaisesRegex(
                    PilotStop, "forbidden_evidence_field"
                ):
                    write_evidence(path, {key: "value"})

    def test_cli_default_dry_run_performs_no_network(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "evidence.json"
            completed = subprocess.run(
                [
                    sys.executable,
                    "scripts/booth_collection_pilot.py",
                    "--output",
                    str(output),
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)
            evidence = json.loads(output.read_text())
            self.assertEqual(evidence["mode"], "dry-run")
            self.assertEqual(evidence["network_requests"], 0)

    def test_workflow_is_manual_only_and_credential_free(self):
        text = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("workflow_dispatch:", text)
        for trigger in (
            "\n  push:",
            "\n  pull_request:",
            "\n  schedule:",
            "\n  issue_comment:",
            "\n  repository_dispatch:",
        ):
            self.assertNotIn(trigger, text)
        self.assertIn("default: dry-run", text)
        self.assertIn('default: "0"', text)
        self.assertIn("permissions: {}", text)
        self.assertIn("contents: read", text)
        self.assertNotIn("id-token: write", text)
        self.assertNotIn("secrets.", text)
        self.assertNotIn("contents: write", text)
        self.assertIn("retention-days: 30", text)
        self.assertIn("python scripts/booth_collection_pilot.py", text)


if __name__ == "__main__":
    unittest.main()
