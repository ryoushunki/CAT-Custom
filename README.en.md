# LingoForge CAT

A local-first desktop CAT tool for game localization. It focuses on individual translators, small internal localization tasks for publishing teams, translation memories, termbases, and protected non-translatable elements.

[简体中文 README](README.zh-CN.md) · [Changelog](CHANGELOG.md) · [GitHub Releases](https://github.com/ryoushunki/CAT-Custom/releases)

## Project focus

LingoForge CAT reduces repetitive copying between cloud documents, AI tools, and local files. It helps translators keep terminology, tags, and formatting consistent.

It is not an account, task-assignment, or vendor-management platform. It is a local-first single-user CAT workspace prototype that can later be extended by a technical team.

## Current capabilities

- Modern three-column translation workspace;
- XLSX, CSV, and TSV import;
- Worksheet, source column, target column, start row, and language selection;
- Configurable regular expressions for non-translatable elements;
- Protected tag tokens, missing/extra/order QA, and quick tag insertion;
- Ctrl+Enter segment confirmation;
- Edited confirmed segments automatically return to review;
- Format-preserving XLSX export;
- CSV and TSV export with original row/column mapping;
- Local project creation, switching, and project-level asset binding;
- Translation memory import, fuzzy matching, and suggestions;
- Termbase import, categorization, and live term hits;
- Local IndexedDB persistence for projects, files, assets, and import settings;
- Windows Electron installer.

## Development

Requirements: Node.js, npm, and a Windows Electron build environment.

```powershell
npm.cmd install
npm.cmd run dev
```

Run the build and export checks:

```powershell
npm.cmd run build
npm.cmd run test:export
```

Build the Windows installer:

```powershell
npm.cmd run dist
```

## Data and privacy

The application does not automatically upload project files, customer strings, translation memories, or termbases. Data is stored locally in IndexedDB, and imported originals are kept locally for round-trip export.

The repository ignores local build outputs and common translation-file formats. Always review `git status` and `git diff` before committing to ensure that company or customer data is not included.

## Versions and releases

The current version is `v0.6.0`, kept in sync with `package.json`.

- `v0.x.y`: development and validation stage;
- Increment the patch number for fixes, such as `v0.6.1`;
- Increment the minor number for new features, such as `v0.7.0`;
- `v1.0.0`: stable handoff-ready release.

Source versions are managed with Git tags. Windows installers should be attached to GitHub Releases rather than committed to the source repository.

## Roadmap

Planned work includes asset editing, TMX import/export, broader numeric and punctuation QA, configurable OpenAI-compatible/Anthropic/Gemini APIs, project-level prompts and style guidance, batch translation, retries, and API usage statistics.

See [docs/ROADMAP.md](docs/ROADMAP.md).
