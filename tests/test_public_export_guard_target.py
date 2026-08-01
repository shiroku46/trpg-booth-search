#!/usr/bin/env python3
"""Tests for public_export_guard generated-target mode."""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from public_export_guard import GENERATED_TARGET_MARKER, is_generated_target, scan

EXACT_MARKER = "<!-- ai-dev-automation-foundation:generated-target -->"


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


class TestProductTermsWithoutMarker(unittest.TestCase):
    """Product terminology must fail when the generated-target marker is absent."""

    def test_trpg_fails_without_marker(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write(root / "README.md", "TRPG search tool")
            findings = scan(root)
            self.assertTrue(any("product-specific" in f for f in findings))

    def test_booth_fails_without_marker(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write(root / "README.md", "BOOTH product page")
            findings = scan(root)
            self.assertTrue(any("product-specific" in f for f in findings))

    def test_luluportal_fails_without_marker(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write(root / "README.md", "luluportal integration")
            findings = scan(root)
            self.assertTrue(any("product-specific" in f for f in findings))


class TestProductTermsWithExactMarker(unittest.TestCase):
    """Product terminology must pass when the exact generated-target marker is present."""

    def test_trpg_passes_with_exact_marker(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write(root / "INSTALL_CHECKLIST.md", EXACT_MARKER + "\n# Checklist\n")
            _write(root / "README.md", "TRPG search tool")
            findings = scan(root)
            self.assertFalse(any("product-specific" in f for f in findings))

    def test_booth_passes_with_exact_marker(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write(root / "INSTALL_CHECKLIST.md", EXACT_MARKER + "\n# Checklist\n")
            _write(root / "README.md", "BOOTH product page")
            findings = scan(root)
            self.assertFalse(any("product-specific" in f for f in findings))

    def test_luluportal_passes_with_exact_marker(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write(root / "INSTALL_CHECKLIST.md", EXACT_MARKER + "\n# Checklist\n")
            _write(root / "README.md", "luluportal integration")
            findings = scan(root)
            self.assertFalse(any("product-specific" in f for f in findings))


class TestNearMatchMarkerDoesNotActivate(unittest.TestCase):
    """Near-match markers must not activate generated-target mode."""

    def test_partial_marker_does_not_activate(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write(root / "INSTALL_CHECKLIST.md", "<!-- generated-target -->\n# Checklist\n")
            _write(root / "README.md", "TRPG search tool")
            findings = scan(root)
            self.assertTrue(any("product-specific" in f for f in findings))

    def test_bare_marker_text_does_not_activate(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write(root / "INSTALL_CHECKLIST.md", "ai-dev-automation-foundation:generated-target\n# Checklist\n")
            _write(root / "README.md", "TRPG search tool")
            findings = scan(root)
            self.assertTrue(any("product-specific" in f for f in findings))

    def test_extra_whitespace_in_marker_does_not_activate(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write(root / "INSTALL_CHECKLIST.md", "<!--  ai-dev-automation-foundation:generated-target -->\n# Checklist\n")
            _write(root / "README.md", "TRPG search tool")
            findings = scan(root)
            self.assertTrue(any("product-specific" in f for f in findings))

    def test_absent_checklist_does_not_activate(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write(root / "README.md", "TRPG search tool")
            findings = scan(root)
            self.assertTrue(any("product-specific" in f for f in findings))


class TestSensitiveContentBlockedWithExactMarker(unittest.TestCase):
    """Credential/token/private-reference findings must still fail even with the exact marker."""

    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self._tmpdir.name)
        _write(self.root / "INSTALL_CHECKLIST.md", EXACT_MARKER + "\n# Checklist\n")

    def tearDown(self):
        self._tmpdir.cleanup()

    def test_credential_still_fails(self):
        _write(self.root / "config.txt", "api_key = abcdefghijklmnopqrstuvwxyz12345678")
        findings = scan(self.root)
        self.assertTrue(any("credential-value" in f for f in findings))

    def test_github_token_still_fails(self):
        _write(self.root / "config.txt", "token ghp_" + "A" * 36)
        findings = scan(self.root)
        self.assertTrue(any("github-token" in f for f in findings))

    def test_private_repo_ref_still_fails(self):
        _write(self.root / "README.md", "See ai-dev-automation-sandbox repository")
        findings = scan(self.root)
        self.assertTrue(any("private-repository-reference" in f for f in findings))

    def test_private_notion_still_fails(self):
        _write(self.root / "README.md", "https://notion.so/" + "a" * 22)
        findings = scan(self.root)
        self.assertTrue(any("private-notion-reference" in f for f in findings))

    def test_private_actions_url_still_fails(self):
        _write(self.root / "README.md", "https://github.com/owner/repo/actions/runs/123456789")
        findings = scan(self.root)
        self.assertTrue(any("private-actions-url" in f for f in findings))


class TestExcludedPaths(unittest.TestCase):
    """The guard's own excluded paths must remain excluded."""

    def test_guard_script_itself_excluded(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write(root / "scripts" / "public_export_guard.py", "TRPG BOOTH luluportal")
            findings = scan(root)
            guard_findings = [f for f in findings if "public_export_guard.py" in f]
            self.assertEqual(guard_findings, [])

    def test_new_test_file_excluded(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write(root / "tests" / "test_public_export_guard_target.py", "TRPG BOOTH luluportal")
            findings = scan(root)
            excluded_findings = [f for f in findings if "test_public_export_guard_target.py" in f]
            self.assertEqual(excluded_findings, [])


class TestIsGeneratedTarget(unittest.TestCase):
    """Unit tests for the is_generated_target helper."""

    def test_returns_true_with_exact_marker(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write(root / "INSTALL_CHECKLIST.md", EXACT_MARKER + "\n# Checklist\n")
            self.assertTrue(is_generated_target(root))

    def test_returns_false_without_checklist(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.assertFalse(is_generated_target(root))

    def test_returns_false_with_empty_checklist(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write(root / "INSTALL_CHECKLIST.md", "# Checklist\n")
            self.assertFalse(is_generated_target(root))

    def test_constant_matches_actual_checklist_marker(self):
        self.assertEqual(GENERATED_TARGET_MARKER, EXACT_MARKER)


if __name__ == "__main__":
    unittest.main()
