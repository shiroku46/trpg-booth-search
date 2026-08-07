import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from scripts.booth_collection_pilot import (
    GUIDELINE_URL,
    MAX_JITTER_SECONDS,
    MAX_LISTING_REQUESTS,
    MIN_DELAY_SECONDS,
    PILOT_ENDPOINTS,
    POLICY_HTML_NORMALIZATION_VERSION,
    PREFLIGHT_URLS,
    ROBOTS_URL,
    TERMS_URL,
    DirectHttpsTransport,
    FetchResult,
    PilotStop,
    RobotsPolicy,
    bounded_delay,
    build_dry_run_evidence,
    classify_response,
    hash_evidence,
    normalized_policy_html,
    normalized_text,
    preflight,
    require_url,
    run_network,
    unchanged_content,
    validate_request_limit,
    validate_stop_observation,
    write_evidence,
)

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/booth-collection-pilot.yml"


def result(
    url: str,
    body: bytes,
    content_type: str = "text/html",
    *,
    status: int = 200,
    final_url: str | None = None,
) -> FetchResult:
    return FetchResult(
        requested_url=url,
        final_url=final_url or url,
        status=status,
        content_type=content_type,
        body=body,
        elapsed_ms=1,
    )


class FakeSocket:
    def __init__(self):
        self.timeouts: list[float] = []

    def settimeout(self, value: float) -> None:
        self.timeouts.append(value)


class FakeResponse:
    def __init__(
        self,
        *,
        status: int,
        body: bytes = b"",
        content_type: str = "text/html",
        location: str | None = None,
    ):
        self.status = status
        self._body = body
        self._offset = 0
        self._headers = {
            "Content-Type": content_type,
            "Location": location,
        }

    def read(self, amount: int) -> bytes:
        chunk = self._body[self._offset:self._offset + amount]
        self._offset += len(chunk)
        return chunk

    def getheader(self, name: str, default=None):
        value = self._headers.get(name)
        return default if value is None else value


class FakeConnection:
    def __init__(self, response: FakeResponse):
        self.response = response
        self.sock = FakeSocket()
        self.requests: list[tuple[str, str, dict[str, str]]] = []
        self.closed = False

    def request(self, method: str, path: str, headers: dict[str, str]) -> None:
        self.requests.append((method, path, headers))

    def getresponse(self) -> FakeResponse:
        return self.response

    def close(self) -> None:
        self.closed = True


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

    def test_robots_wildcard_terminal_anchor_and_query(self):
        policy = RobotsPolicy.parse(
            b"""User-agent: *
Disallow: /ja/browse/*?adult=*
Allow: /ja/browse/TRPG?adult=none&type=digital$
"""
        )
        self.assertTrue(policy.allows(PILOT_ENDPOINTS[0]))
        self.assertFalse(
            policy.allows("https://booth.pm/ja/browse/TRPG?adult=none&type=physical")
        )
        self.assertFalse(
            policy.allows(
                "https://booth.pm/ja/browse/TRPG?adult=none&type=digital&extra=1"
            )
        )

    def test_robots_percent_encoding_semantics(self):
        policy = RobotsPolicy.parse(
            b"""User-agent: *
Disallow: /private/%7Euser
Disallow: /encoded/%2Fadmin
Allow: /caf%C3%A9$
"""
        )
        self.assertFalse(policy.allows("https://booth.pm/private/~user"))
        self.assertFalse(policy.allows("https://booth.pm/encoded/%2fadmin"))
        self.assertTrue(policy.allows("https://booth.pm/caf%C3%A9"))
        self.assertTrue(policy.allows("https://booth.pm/café"))
        self.assertTrue(policy.allows("https://booth.pm/encoded//admin"))

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
            (b"User-agent: *\nDisallow: /bad%zz\n", "robots_malformed"),
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

    def test_request_ceiling_dry_run_and_delay_are_fail_closed(self):
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
        self.assertEqual(bounded_delay(0.0), MIN_DELAY_SECONDS)
        self.assertEqual(
            bounded_delay(1.0), MIN_DELAY_SECONDS + MAX_JITTER_SECONDS
        )
        with self.assertRaisesRegex(PilotStop, "invalid_jitter"):
            bounded_delay(1.01)
        dry = build_dry_run_evidence()
        self.assertEqual(dry["network_requests"], 0)
        self.assertEqual(dry["listing_requests"], 0)
        self.assertEqual(dry["preflight_attempted_urls"], [])

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

    def test_policy_visible_text_hash_ignores_volatile_markup(self):
        first = (
            '<html nonce="one"><head><script>window.BUILD="abc"</script></head>'
            '<body><h1>ガイドライン</h1><p>スクレイピング</p>'
            '<p>ユーザーの利便性向上と創作活動の健全な発展</p></body></html>'
        ).encode()
        second = (
            '<html nonce="two"><head><script>window.BUILD="xyz"</script></head>'
            '<body class="changed"><h1>ガイドライン</h1><p>スクレイピング</p>'
            '<p>ユーザーの利便性向上と創作活動の健全な発展</p></body></html>'
        ).encode()
        left = hash_evidence(first, policy_url=GUIDELINE_URL)
        right = hash_evidence(second, policy_url=GUIDELINE_URL)
        self.assertNotEqual(left.raw_sha256, right.raw_sha256)
        self.assertEqual(left.normalized_sha256, right.normalized_sha256)
        self.assertEqual(left.normalized_version, POLICY_HTML_NORMALIZATION_VERSION)

    def test_policy_visible_text_change_changes_digest_and_unrecognized_fails(self):
        base = (
            '<html><body><h1>ガイドライン</h1><p>スクレイピング</p>'
            '<p>ユーザーの利便性向上と創作活動の健全な発展</p></body></html>'
        ).encode()
        changed = base.replace(b"</body>", b"<p>Additional binding policy sentence.</p></body>")
        self.assertNotEqual(
            hash_evidence(base, policy_url=GUIDELINE_URL).normalized_sha256,
            hash_evidence(changed, policy_url=GUIDELINE_URL).normalized_sha256,
        )
        with self.assertRaisesRegex(PilotStop, "policy_visible_text_unrecognized"):
            normalized_policy_html(
                b"<html><script>dynamic only</script><body>shell</body></html>",
                url=GUIDELINE_URL,
            )

    def test_mismatched_hidden_tag_closer_does_not_expose_svg_text(self):
        hostile = (
            '<html><body><svg></style>'
            'ガイドライン スクレイピング '
            'ユーザーの利便性向上 創作活動の健全な発展'
            '</svg></body></html>'
        ).encode()
        with self.assertRaisesRegex(PilotStop, "policy_visible_text_unrecognized"):
            normalized_policy_html(hostile, url=GUIDELINE_URL)

    def _preflight_responses(self):
        return {
            ROBOTS_URL: result(
                ROBOTS_URL,
                (
                    b"User-agent: trpg-booth-search-pilot\n"
                    b"Allow: /ja/browse/TRPG\n"
                    b"Disallow: /captcha\n"
                    b"Disallow: /r18\n"
                ),
                "text/plain; charset=utf-8",
            ),
            GUIDELINE_URL: result(
                GUIDELINE_URL,
                (
                    "<html><h1>ガイドライン</h1><p>スクレイピング</p>"
                    "<p>ユーザーの利便性向上と創作活動の健全な発展</p>"
                    "<p>R-18 年齢確認を含む公式ガイドライン本文</p></html>"
                ).encode(),
            ),
            TERMS_URL: result(
                TERMS_URL,
                b"<html><h1>pixiv Terms</h1><p>Official terms and policy</p></html>",
            ),
        }

    def test_preflight_records_hashes_and_machine_readable_review_decisions(self):
        responses = self._preflight_responses()
        transport = Mock(side_effect=lambda url, **_: responses[url])
        records, decisions, digest = preflight(transport)
        self.assertEqual(
            [record.url for record in records],
            [ROBOTS_URL, GUIDELINE_URL, TERMS_URL],
        )
        self.assertEqual(decisions[0]["decision"], "allow")
        self.assertEqual(
            decisions[1]["decision"], "semantic_visible_text_review_required"
        )
        self.assertEqual(
            decisions[2]["decision"], "semantic_visible_text_review_required"
        )
        self.assertRegex(digest, r"^[0-9a-f]{64}$")
        self.assertEqual(transport.call_count, 3)

    def test_preflight_digest_is_stable_across_dynamic_html_shells(self):
        left = self._preflight_responses()
        right = self._preflight_responses()
        left[GUIDELINE_URL] = result(
            GUIDELINE_URL,
            left[GUIDELINE_URL].body.replace(b"<html>", b'<html nonce="one"><script>a=1</script>'),
        )
        right[GUIDELINE_URL] = result(
            GUIDELINE_URL,
            right[GUIDELINE_URL].body.replace(b"<html>", b'<html nonce="two"><script>a=2</script>'),
        )
        left[TERMS_URL] = result(
            TERMS_URL,
            b'<html data-build="one"><script>token=1</script><h1>pixiv Terms</h1><p>Official terms and policy</p></html>',
        )
        right[TERMS_URL] = result(
            TERMS_URL,
            b'<html data-build="two"><script>token=2</script><h1>pixiv Terms</h1><p>Official terms and policy</p></html>',
        )
        _, _, left_digest = preflight(Mock(side_effect=lambda url, **_: left[url]))
        _, _, right_digest = preflight(Mock(side_effect=lambda url, **_: right[url]))
        self.assertEqual(left_digest, right_digest)

    def test_policy_pages_are_not_misclassified_as_age_or_challenge_pages(self):
        responses = self._preflight_responses()
        records, _, _ = preflight(Mock(side_effect=lambda url, **_: responses[url]))
        self.assertEqual(len(records), 3)

    def test_listing_marker_scan_covers_entire_bounded_body(self):
        body = b"a" * 200_000 + b"captcha"
        with self.assertRaisesRegex(PilotStop, "challenge_or_login_gate"):
            classify_response(
                result(PILOT_ENDPOINTS[0], body),
                expected_types=("text/html",),
                limit=1_000_000,
                inspect_listing_markers=True,
            )
        with self.assertRaisesRegex(PilotStop, "age_or_adult_signal"):
            classify_response(
                result(PILOT_ENDPOINTS[0], b"<html>R-18</html>"),
                expected_types=("text/html",),
                limit=1_000_000,
                inspect_listing_markers=True,
            )

    def test_challenge_stop_carries_bounded_marker_fingerprint(self):
        body = (
            b"<html>captcha SECRET_DIAGNOSTIC_BODY cf-chl- "
            b"cloudflare ray id</html>"
        )
        with self.assertRaises(PilotStop) as raised:
            classify_response(
                result(PILOT_ENDPOINTS[0], body),
                expected_types=("text/html",),
                limit=1_000_000,
                inspect_listing_markers=True,
            )
        self.assertEqual(raised.exception.reason, "challenge_or_login_gate")
        observation = raised.exception.details["stop_observation"]
        self.assertEqual(
            observation["marker_ids"],
            [
                "captcha",
                "cloudflare_challenge_token",
                "cloudflare_ray_id",
            ],
        )
        self.assertEqual(observation["byte_length"], len(body))
        self.assertEqual(observation["content_type"], "text/html")
        self.assertRegex(observation["raw_sha256"], r"^[0-9a-f]{64}$")
        self.assertRegex(observation["normalized_sha256"], r"^[0-9a-f]{64}$")
        serialized = json.dumps(observation, ensure_ascii=False)
        self.assertNotIn("SECRET_DIAGNOSTIC_BODY", serialized)
        self.assertNotIn("<html>", serialized)

    def test_login_and_adult_markers_use_stable_non_sensitive_ids(self):
        cases = [
            (
                "ログインしてください SECRET_LOGIN_BODY".encode(),
                "challenge_or_login_gate",
                ["login_prompt"],
            ),
            (
                "年齢確認 SECRET_ADULT_BODY R-18".encode(),
                "age_or_adult_signal",
                ["age_confirmation", "r18_hyphen"],
            ),
        ]
        for body, reason, marker_ids in cases:
            with self.subTest(reason=reason), self.assertRaises(PilotStop) as raised:
                classify_response(
                    result(PILOT_ENDPOINTS[0], body),
                    expected_types=("text/html",),
                    limit=1_000_000,
                    inspect_listing_markers=True,
                )
            self.assertEqual(raised.exception.reason, reason)
            observation = raised.exception.details["stop_observation"]
            self.assertEqual(observation["marker_ids"], marker_ids)
            self.assertNotIn("SECRET_", json.dumps(observation, ensure_ascii=False))

    def test_invalid_utf8_challenge_keeps_stop_reason_and_raw_fingerprint(self):
        body = b"captcha\xffSECRET_INVALID_UTF8"
        with self.assertRaises(PilotStop) as raised:
            classify_response(
                result(PILOT_ENDPOINTS[0], body),
                expected_types=("text/html",),
                limit=1_000_000,
                inspect_listing_markers=True,
            )
        self.assertEqual(raised.exception.reason, "challenge_or_login_gate")
        observation = raised.exception.details["stop_observation"]
        self.assertRegex(observation["raw_sha256"], r"^[0-9a-f]{64}$")
        self.assertIsNone(observation["normalized_sha256"])
        self.assertIsNone(observation["normalized_version"])

    def test_run_network_preserves_challenge_observation_without_listing_record(self):
        responses = self._preflight_responses()
        _, _, digest = preflight(Mock(side_effect=lambda url, **_: responses[url]))
        responses[PILOT_ENDPOINTS[0]] = result(
            PILOT_ENDPOINTS[0],
            b"<html>captcha SECRET_RUN_BODY cloudflare ray id</html>",
        )
        evidence = run_network(
            request_limit=1,
            approval_digest=digest,
            transport=Mock(side_effect=lambda url, **_: responses[url]),
            sleeper=Mock(),
        )
        self.assertEqual(evidence["stop_reason"], "challenge_or_login_gate")
        self.assertEqual(evidence["listing_requests"], 1)
        self.assertEqual(evidence["listing_records"], [])
        self.assertEqual(
            evidence["stop_observation"]["marker_ids"],
            ["captcha", "cloudflare_ray_id"],
        )
        serialized = json.dumps(evidence, ensure_ascii=False)
        self.assertNotIn("SECRET_RUN_BODY", serialized)
        self.assertNotIn("<html>", serialized)

    def test_stop_observation_schema_round_trips_detached(self):
        body = b"<html>captcha</html>"
        with self.assertRaises(PilotStop) as raised:
            classify_response(
                result(PILOT_ENDPOINTS[0], body),
                expected_types=("text/html",),
                limit=1_000_000,
                inspect_listing_markers=True,
            )
        source = raised.exception.details["stop_observation"]
        validated = validate_stop_observation(source)
        self.assertEqual(validated, source)
        self.assertIsNot(validated, source)
        self.assertIsNot(validated["marker_ids"], source["marker_ids"])

    def test_stop_observation_schema_rejects_unknown_keys_and_bad_markers(self):
        body = b"<html>captcha cloudflare ray id</html>"
        with self.assertRaises(PilotStop) as raised:
            classify_response(
                result(PILOT_ENDPOINTS[0], body),
                expected_types=("text/html",),
                limit=1_000_000,
                inspect_listing_markers=True,
            )
        base = raised.exception.details["stop_observation"]
        invalid = [
            {**base, "snippet": "forbidden"},
            {**base, "marker_ids": []},
            {**base, "marker_ids": ["unknown_marker"]},
            {**base, "marker_ids": ["captcha", "captcha"]},
            {**base, "marker_ids": ["cloudflare_ray_id", "captcha"]},
        ]
        for candidate in invalid:
            with self.subTest(candidate=candidate), self.assertRaises(PilotStop) as stopped:
                validate_stop_observation(candidate)
            self.assertEqual(stopped.exception.reason, "invalid_stop_observation")

    def test_stop_observation_schema_rejects_transport_hash_and_version_mismatches(self):
        body = b"<html>captcha</html>"
        with self.assertRaises(PilotStop) as raised:
            classify_response(
                result(PILOT_ENDPOINTS[0], body),
                expected_types=("text/html",),
                limit=1_000_000,
                inspect_listing_markers=True,
            )
        base = raised.exception.details["stop_observation"]
        invalid = [
            {**base, "url": "https://example.com/"},
            {**base, "final_url": "https://booth.pm/ja/items/1"},
            {**base, "status": 403},
            {**base, "content_type": "text/plain"},
            {**base, "elapsed_ms": -1},
            {**base, "request_attempts": 2},
            {**base, "redirect_count": 1},
            {**base, "byte_length": 1_000_001},
            {**base, "raw_sha256": "A" * 64},
            {**base, "raw_sha256": "0" * 63},
            {**base, "normalized_version": None},
            {**base, "normalized_sha256": None, "normalized_version": "booth-text-v1"},
            {**base, "normalized_version": "other-version"},
        ]
        for candidate in invalid:
            with self.subTest(candidate=candidate), self.assertRaises(PilotStop) as stopped:
                validate_stop_observation(candidate)
            self.assertEqual(stopped.exception.reason, "invalid_stop_observation")

    def test_run_network_rejects_injected_unvalidated_stop_details(self):
        responses = self._preflight_responses()
        _, _, digest = preflight(Mock(side_effect=lambda url, **_: responses[url]))
        malicious = {
            "url": PILOT_ENDPOINTS[0],
            "unexpected": "SECRET_INJECTED_DETAIL",
        }
        def transport(url, **kwargs):
            if url in responses:
                return responses[url]
            raise PilotStop("challenge_or_login_gate", {"stop_observation": malicious})
        evidence = run_network(
            request_limit=1,
            approval_digest=digest,
            transport=transport,
            sleeper=Mock(),
        )
        self.assertEqual(evidence["stop_reason"], "invalid_stop_observation")
        self.assertIsNone(evidence["stop_observation"])
        self.assertNotIn("SECRET_INJECTED_DETAIL", json.dumps(evidence))

    def test_write_evidence_revalidates_stop_observation(self):
        evidence = build_dry_run_evidence()
        evidence["stop_observation"] = {"unexpected": "value"}
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(PilotStop) as stopped:
                write_evidence(Path(directory) / "evidence.json", evidence)
        self.assertEqual(stopped.exception.reason, "invalid_stop_observation")

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
        self.assertEqual(evidence["preflight_fetches"], 3)
        self.assertEqual(evidence["preflight_attempted_urls"], list(PREFLIGHT_URLS))
        self.assertRegex(evidence["policy_digest"], r"^[0-9a-f]{64}$")
        self.assertEqual(evidence["policy_review"]["decision"], "not_reviewed")
        self.assertEqual(transport.call_count, 3)

    def test_partial_preflight_failure_retains_exact_completed_evidence(self):
        responses = self._preflight_responses()

        def transport(url, **_):
            if url == GUIDELINE_URL:
                raise PilotStop("network_error")
            return responses[url]

        evidence = run_network(
            request_limit=1,
            approval_digest="",
            transport=transport,
            sleeper=Mock(),
        )
        self.assertEqual(evidence["stop_reason"], "network_error")
        self.assertEqual(evidence["preflight_fetches"], 2)
        self.assertEqual(
            evidence["preflight_attempted_urls"],
            [ROBOTS_URL, GUIDELINE_URL],
        )
        self.assertEqual([item["url"] for item in evidence["preflight"]], [ROBOTS_URL])
        self.assertEqual(evidence["endpoint_decisions"], [])
        self.assertIsNone(evidence["policy_digest"])
        self.assertEqual(evidence["listing_requests"], 0)

    def test_restrictive_robots_retains_hashes_decisions_and_digest(self):
        responses = self._preflight_responses()
        responses[ROBOTS_URL] = result(
            ROBOTS_URL,
            b"User-agent: trpg-booth-search-pilot\nDisallow: /ja/browse/TRPG\n",
            "text/plain",
        )
        evidence = run_network(
            request_limit=1,
            approval_digest="",
            transport=Mock(side_effect=lambda url, **_: responses[url]),
            sleeper=Mock(),
        )
        self.assertEqual(evidence["stop_reason"], "robots_restricted")
        self.assertEqual(len(evidence["preflight"]), 3)
        self.assertEqual(evidence["endpoint_decisions"][0]["decision"], "deny")
        self.assertRegex(evidence["policy_digest"], r"^[0-9a-f]{64}$")
        self.assertEqual(evidence["listing_requests"], 0)

    def test_approved_plan_fetches_only_fixed_endpoint_once(self):
        responses = self._preflight_responses()
        responses[PILOT_ENDPOINTS[0]] = result(
            PILOT_ENDPOINTS[0], b"<html>all ages listing</html>"
        )
        _, _, digest = preflight(Mock(side_effect=lambda url, **_: responses[url]))
        transport = Mock(side_effect=lambda url, **_: responses[url])
        sleeper = Mock()
        evidence = run_network(
            request_limit=1,
            approval_digest=digest,
            transport=transport,
            sleeper=sleeper,
        )
        self.assertEqual(evidence["stop_state"], "complete")
        self.assertEqual(evidence["listing_requests"], 1)
        self.assertEqual(len(evidence["listing_records"]), 1)
        self.assertIsNone(evidence["stop_observation"])
        self.assertNotIn("body", evidence["listing_records"][0])
        self.assertEqual(evidence["status_distribution"], {"200": 1})
        self.assertEqual(
            evidence["policy_review"]["decision"], "approved_semantic_digest"
        )
        self.assertTrue(
            evidence["delay_policy"]["current_single_request_plan_is_vacuous"]
        )
        sleeper.assert_not_called()
        listing_call = transport.call_args_list[-1]
        self.assertEqual(listing_call.args[0], PILOT_ENDPOINTS[0])
        self.assertFalse(listing_call.kwargs["follow_redirects"])
        self.assertEqual(tuple(listing_call.kwargs["allowed_exact"]), PILOT_ENDPOINTS)

    def test_listing_redirect_is_not_followed_and_attempt_is_counted(self):
        responses = self._preflight_responses()
        _, _, digest = preflight(Mock(side_effect=lambda url, **_: responses[url]))
        calls: list[str] = []

        def transport(url, **kwargs):
            calls.append(url)
            if url in responses:
                return responses[url]
            return result(
                PILOT_ENDPOINTS[0],
                b"",
                status=302,
                final_url=PILOT_ENDPOINTS[0],
            )

        evidence = run_network(
            request_limit=1,
            approval_digest=digest,
            transport=transport,
            sleeper=Mock(),
        )
        self.assertEqual(evidence["listing_requests"], 1)
        self.assertEqual(evidence["stop_reason"], "unexpected_redirect")
        self.assertEqual(calls.count(PILOT_ENDPOINTS[0]), 1)

    def test_transport_does_not_follow_listing_same_origin_redirect(self):
        response = FakeResponse(
            status=302,
            location="/ja/account",
        )
        connection = FakeConnection(response)
        factory = Mock(return_value=connection)
        transport = DirectHttpsTransport(
            connection_factory=factory,
            context_factory=Mock(return_value=object()),
            clock=Mock(side_effect=[0.0, 0.0, 0.1, 0.2]),
        )
        fetched = transport(
            PILOT_ENDPOINTS[0],
            max_bytes=100,
            expected_hosts={"booth.pm"},
            allowed_exact=PILOT_ENDPOINTS,
            follow_redirects=False,
        )
        self.assertEqual(fetched.status, 302)
        self.assertEqual(fetched.request_attempts, 1)
        self.assertEqual(len(connection.requests), 1)
        self.assertEqual(
            connection.requests[0][1],
            "/ja/browse/TRPG?adult=none&type=digital",
        )

    def test_transport_converts_network_errors_to_bounded_stop(self):
        connection = FakeConnection(FakeResponse(status=200))
        connection.request = Mock(side_effect=OSError("secret internal detail"))
        transport = DirectHttpsTransport(
            connection_factory=Mock(return_value=connection),
            context_factory=Mock(return_value=object()),
            clock=Mock(side_effect=[0.0, 0.0]),
        )
        with self.assertRaisesRegex(PilotStop, "network_error"):
            transport(
                ROBOTS_URL,
                max_bytes=100,
                expected_hosts={"booth.pm"},
            )
        self.assertTrue(connection.closed)

    def test_stop_conditions_do_not_persist_response_body(self):
        base = self._preflight_responses()
        _, _, digest = preflight(Mock(side_effect=lambda url, **_: base[url]))
        cases = [
            (401, "text/html", b"SECRET_RESPONSE_BODY_401", "http_401"),
            (403, "text/html", b"SECRET_RESPONSE_BODY_403", "http_403"),
            (429, "text/html", b"SECRET_RESPONSE_BODY_429", "http_429"),
            (500, "text/html", b"SECRET_RESPONSE_BODY_500", "server_error"),
            (
                200,
                "application/json",
                b'{"private_payload":true}',
                "unexpected_content_type",
            ),
            (
                200,
                "text/html",
                b"<html>captcha SECRET_BODY</html>",
                "challenge_or_login_gate",
            ),
            (
                200,
                "text/html",
                "年齢確認 SECRET_BODY".encode(),
                "age_or_adult_signal",
            ),
        ]
        for status, content_type, body, reason in cases:
            with self.subTest(reason=reason):
                responses = dict(base)
                responses[PILOT_ENDPOINTS[0]] = result(
                    PILOT_ENDPOINTS[0],
                    body,
                    content_type,
                    status=status,
                )
                evidence = run_network(
                    request_limit=1,
                    approval_digest=digest,
                    transport=Mock(side_effect=lambda url, **_: responses[url]),
                    sleeper=Mock(),
                )
                self.assertEqual(evidence["stop_reason"], reason)
                self.assertEqual(evidence["listing_requests"], 1)
                self.assertEqual(evidence["listing_records"], [])
                self.assertNotIn(body.decode(errors="ignore"), json.dumps(evidence))

    def test_evidence_writer_rejects_sensitive_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "evidence.json"
            write_evidence(path, build_dry_run_evidence())
            for key in (
                "authorization",
                "cookie",
                "set-cookie",
                "exact_price",
                "full_body",
            ):
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

    def test_cli_rejects_policy_digest_in_dry_run(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "evidence.json"
            completed = subprocess.run(
                [
                    sys.executable,
                    "scripts/booth_collection_pilot.py",
                    "--policy-approval-digest",
                    "a" * 64,
                    "--output",
                    str(output),
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(completed.returncode, 2)
            evidence = json.loads(output.read_text())
            self.assertEqual(evidence["stop_reason"], "dry_run_policy_digest_forbidden")

    def test_workflow_is_manual_exact_sha_bound_and_credential_free(self):
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
        self.assertIn("candidate_sha:", text)
        self.assertIn("fix/stage8-issue-79-collection-pilot", text)
        self.assertIn('test "$CANDIDATE_SHA" = "$TARGET_SHA"', text)
        self.assertIn('ref: ${{ github.sha }}', text)
        self.assertIn("run-metadata.json", text)
        self.assertIn("GITHUB_WORKFLOW_REF", text)
        self.assertIn("permissions: {}", text)
        self.assertIn("contents: read", text)
        self.assertNotIn("id-token: write", text)
        self.assertNotIn("secrets.", text)
        self.assertNotIn("contents: write", text)
        self.assertNotIn("if: github.ref_name ==", text)
        self.assertIn("retention-days: 30", text)
        self.assertIn("python scripts/booth_collection_pilot.py", text)


if __name__ == "__main__":
    unittest.main()
