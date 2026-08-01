from __future__ import annotations

from pathlib import Path
import unittest


class GeneratedTargetBootstrapTest(unittest.TestCase):
    def test_generated_target_installation_is_present(self) -> None:
        root = Path(__file__).resolve().parents[1]
        checklist = (root / "INSTALL_CHECKLIST.md").read_text(encoding="utf-8")

        self.assertIn(
            "<!-- ai-dev-automation-foundation:generated-target -->",
            checklist,
        )
        for required_path in (
            "SECURITY.md",
            "scripts/public_export_guard.py",
            "scripts/validate_repository.py",
        ):
            with self.subTest(path=required_path):
                self.assertTrue((root / required_path).is_file())


if __name__ == "__main__":
    unittest.main()
