import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HANDOFF = ROOT / "docs/SUPABASE_PROVISIONING.md"


class SupabaseProvisioningContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.text = HANDOFF.read_text(encoding="utf-8")

    def test_fixed_non_production_project_profile(self) -> None:
        for expected in (
            "trpg-booth-search-staging",
            "Free",
            "Northeast Asia (Tokyo)",
            "ap-northeast-1",
            "non-production staging database only",
        ):
            with self.subTest(expected=expected):
                self.assertIn(expected, self.text)

    def test_requires_session_pooler_for_github_actions(self) -> None:
        for expected in (
            "Session pooler",
            "port **5432**",
            "GitHub Actions is IPv4-only",
            "Free direct Postgres endpoint is IPv6-only",
        ):
            with self.subTest(expected=expected):
                self.assertIn(expected, self.text)

    def test_exact_secret_name_and_safe_owner_handoff(self) -> None:
        self.assertIn("SUPABASE_STAGING_DATABASE_URL", self.text)
        self.assertIn("Supabase **project reference**", self.text)
        self.assertIn(
            "SUPABASE_STAGING_DATABASE_URL を GitHub Actions Secret に設定済み",
            self.text,
        )
        self.assertIn("Do **not** report the password or connection string", self.text)

    def test_free_backup_limit_and_production_gates_remain_blocked(self) -> None:
        self.assertIn("Automatic database backups and PITR are not included", self.text)
        self.assertIn("does not satisfy PD-010 backup/recovery", self.text)
        self.assertIn("production-ready", self.text)
        self.assertIn("BOOTH collection remains independently blocked", self.text)

    def test_forbids_credential_publication(self) -> None:
        for target in (
            "ChatGPT",
            "GitHub Issues",
            "Pull Requests",
            "commits",
            "workflow inputs",
            "logs",
            "screenshots",
        ):
            with self.subTest(target=target):
                self.assertIn(target, self.text)


if __name__ == "__main__":
    unittest.main()
