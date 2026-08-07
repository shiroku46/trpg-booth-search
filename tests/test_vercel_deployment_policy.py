import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERCEL_CONFIG = ROOT / "vercel.json"

EXPECTED_HEADERS = [
    {"key": "Cross-Origin-Opener-Policy", "value": "same-origin"},
    {
        "key": "Permissions-Policy",
        "value": "browsing-topics=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    },
    {"key": "Referrer-Policy", "value": "no-referrer"},
    {"key": "X-Content-Type-Options", "value": "nosniff"},
    {"key": "X-Frame-Options", "value": "DENY"},
    {
        "key": "X-Robots-Tag",
        "value": "noindex, nofollow, noarchive, noimageindex",
    },
]


def deployment_enabled(rules: dict[str, bool], branch: str) -> bool:
    """Evaluate the intentionally tiny Stage 33 rule set.

    Vercel documents minimatch syntax. `**` is the globstar rule used here so
    slash-separated Git branch names are covered, while an exact `main: true`
    rule keeps production enabled under Vercel's any-matching-true behavior.
    """

    matches: list[bool] = []
    if branch == "main" and "main" in rules:
        matches.append(rules["main"])
    if "**" in rules:
        matches.append(rules["**"])
    return any(matches) if matches else True


class VercelDeploymentPolicyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.config = json.loads(VERCEL_CONFIG.read_text(encoding="utf-8"))

    def test_only_main_is_automatically_deployed(self) -> None:
        rules = self.config["git"]["deploymentEnabled"]
        self.assertEqual(rules, {"main": True, "**": False})
        self.assertTrue(deployment_enabled(rules, "main"))
        for branch in (
            "agent/stage31-discovery-intake",
            "docs/stage32-collection-mechanism-reassessment",
            "chore/stage33-vercel-main-only",
            "feature/example/nested",
            "fix/example",
            "plain-branch",
        ):
            with self.subTest(branch=branch):
                self.assertFalse(deployment_enabled(rules, branch))

    def test_security_headers_are_preserved_exactly(self) -> None:
        self.assertEqual(
            self.config["headers"],
            [{"source": "/(.*)", "headers": EXPECTED_HEADERS}],
        )

    def test_schema_remains_official_vercel_schema(self) -> None:
        self.assertEqual(
            self.config["$schema"],
            "https://openapi.vercel.sh/vercel.json",
        )


if __name__ == "__main__":
    unittest.main()
