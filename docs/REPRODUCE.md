# Reproduce the core workflow

This checklist lets a reviewer verify the main CAT workflow without private data or external services.

## 1. Install and run

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local Vite URL shown in the terminal.

## 2. Import the fixture

Use the included file `tests/fixtures/import-sample.csv`.

Recommended import settings:

- Source column: `A`;
- Target column: `B`;
- Start row: `1`;
- Source language: Simplified Chinese;
- Target language: Vietnamese;
- Protected-element regex: `<[^>]+>|%(?:s|d)|\\n|\\{[^{}]+\\}`.

The fixture contains a translated row, an empty target row, and a `{0}` placeholder.

## 3. Verify editing and protected elements

1. Select the empty target row and enter a translation.
2. Press `Ctrl+Enter` to confirm the segment.
3. Edit the confirmed segment again and verify it returns to review.
4. Confirm that `{0}` is rendered as a protected token and that deleting it produces a QA warning.

## 4. Verify round-trip export

Use **Export current file**. The original row and column layout should be preserved, while the target column contains the edited translations.

The automated export checks cover XLSX style preservation, existing and appended target columns, CSV quoting, TSV output, and blank-row offsets:

```powershell
npm.cmd run test:export
```

The workflow is intentionally local-first. No fixture or project data is uploaded by the application.
