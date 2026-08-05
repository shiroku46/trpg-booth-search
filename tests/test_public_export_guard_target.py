#!/usr/bin/env python3
"""Tests for public_export_guard generated-target mode."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from public_export_guard import GENERATED_TARGET_MARKER, is_generated_target, scan

EXACT_MARKER = "<!-- ai-dev-automation-foundation:generated-target -->"
VALID_LOCK = {
    "schema_version": 1,
    "source_repository": "shiroku46/ai-dev-automation-foundation",
    "source_sha": "a" * 40,
    "managed_files": [],
}


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _write_generated_target(root: Path) -> None:
    """Write the complete minimal contract required by is_generated_target."""
    _write(root / "INSTALL_CHECKLIST.md", EXACT_MARKER + "\n# Checklist\n")
    _write(
        root / "FOUNDATION.lock.json",
        json.dumps(VALID_LOCK, sort_keys=True) + "\n",
    )


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
    """Product terminology must pass for a complete generated-target contract."""

    def test_trpg_passes_with_exact_marker(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_generated_target(root)
            _write(root / "README.md", "TRPG search tool")
            findings = scan(root)
            self.assertFalse(any("product-specific" in f for f in findings))

    def test_booth_passes_with_exact_marker(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_generated_target(root)
            _write(root / "README.md", "BOOTH product page")
            findings = scan(root)
            self.assertFalse(any("product-specific" in f for f in findings))

    def test_luluportal_passes_with_exact_marker(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_generated_target(root)
            _write(root / "README.md", "luluportal integration")
            findings = scan(root)
            self.assertFalse(any("product-specific" in f for f in findings))


class TestNearMatchMarkerDoesNotActivate(unittest.TestCase):
    """Near-match or incomplete contracts must not activate generated-target mode."""

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

    def test_exact_marker_without_lock_does_not_activate(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write(root / "INSTALL_CHECKLIST.md", EXACT_MARKER + "\n# Checklist\n")
            _write(root / "README.md", "TRPG search tool")
            findings = scan(root)
            self.assertTrue(any("product-specific" in f for f in findings))


class TestSensitiveContentBlockedWithExactMarker(unittest.TestCase):
    """Sensitive findings must still fail with a complete generated-target contract."""

    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self._tmpdir.name)
        _write_generated_target(self.root)

    def tearDown(self):
        self._tmpdir.cleanup()

    def test_credential_still_fails(self):
        credential = "api" + "_key = " + "abcdefghijklmnopqrstuvwxyz12345678"
        _write(self.root / "config.txt", credential)
        findings = scan(self.root)
        self.assertTrue(any("credential-value" in f for f in findings))

    def test_github_token_still_fails(self):
        token = "gh" + "p_" + "A" * 36
        _write(self.root / "config.txt", "token " + token)
        findings = scan(self.root)
        self.assertTrue(any("github-token" in f for f in findings))

    def test_private_repo_ref_still_fails(self):
        private_repo = "ai-dev-automation-" + "sandbox"
        _write(self.root / "README.md", "See " + private_repo + " repository")
        findings = scan(self.root)
        self.assertTrue(any("private-repository-reference" in f for f in findings))

    def test_private_notion_still_fails(self):
        private_notion = "https://" + "notion.so/" + "a" * 22
        _write(self.root / "README.md", private_notion)
        findings = scan(self.root)
        self.assertTrue(any("private-notion-reference" in f for f in findings))

    def test_private_actions_url_still_fails(self):
        private_actions = (
            "https://github.com/"
            + "owner/repo/actions/"
            + "runs/123456789"
        )
        _write(self.root / "README.md", private_actions)
        findings = scan(self.root)
        self.assertTrue(any("private-actions-url" in f for f in findings))


class TestExcludedPaths(unittest.TestCase):
    """Only the guard's established self-referential paths stay excluded."""

    def test_guard_script_itself_excluded(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            sensitive_value = "api" + "_key = " + "Z" * 24
            _write(root / "scripts" / "public_export_guard.py", sensitive_value)
            findings = scan(root)
            guard_findings = [f for f in findings if "public_export_guard.py" in f]
            self.assertEqual(guard_findings, [])

    def test_new_regression_test_file_is_scanned(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            sensitive_value = "api" + "_key = " + "Z" * 24
            test_path = root / "tests" / "test_public_export_guard_target.py"
            _write(test_path, sensitive_value)
            findings = scan(root)
            self.assertTrue(
                any(
                    "tests/test_public_export_guard_target.py" in finding
                    and "credential-value" in finding
                    for finding in findings
                )
            )


class TestIsGeneratedTarget(unittest.TestCase):
    """Unit tests for the complete generated-target identity contract."""

    def test_returns_true_with_exact_marker_and_valid_lock(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_generated_target(root)
            self.assertTrue(is_generated_target(root))

    def test_returns_false_without_checklist(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write(root / "FOUNDATION.lock.json", json.dumps(VALID_LOCK))
            self.assertFalse(is_generated_target(root))

    def test_returns_false_with_empty_checklist(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write(root / "INSTALL_CHECKLIST.md", "# Checklist\n")
            _write(root / "FOUNDATION.lock.json", json.dumps(VALID_LOCK))
            self.assertFalse(is_generated_target(root))

    def test_returns_false_without_lock(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write(root / "INSTALL_CHECKLIST.md", EXACT_MARKER + "\n# Checklist\n")
            self.assertFalse(is_generated_target(root))

    def test_returns_false_with_invalid_lock(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write(root / "INSTALL_CHECKLIST.md", EXACT_MARKER + "\n# Checklist\n")
            invalid_lock = {**VALID_LOCK, "source_sha": "not-a-commit"}
            _write(root / "FOUNDATION.lock.json", json.dumps(invalid_lock))
            self.assertFalse(is_generated_target(root))

    def test_returns_false_for_foundation_source_checkout(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_generated_target(root)
            _write(root / "bootstrap" / "generator.py", "# source checkout\n")
            self.assertFalse(is_generated_target(root))

    def test_constant_matches_actual_checklist_marker(self):
        self.assertEqual(GENERATED_TARGET_MARKER, EXACT_MARKER)


if __name__ == "__main__":
    unittest.main()
