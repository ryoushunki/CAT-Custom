# Open-source development context

LingoForge CAT started from a practical game-localization workflow: translators repeatedly copied strings between spreadsheets, AI tools, and documents, which made terminology, placeholders, tags, and formatting drift over time.

The repository is intentionally useful before any cloud service is configured:

- local project and file persistence;
- configurable source/target columns and protected-element regex;
- terminology and translation-memory suggestions;
- protected-token QA;
- format-preserving XLSX, CSV, and TSV export;
- no automatic upload of imported project data.

The next development phase is an opt-in AI provider layer. The target design is provider-agnostic and should support OpenAI-compatible endpoints, project-level localization instructions, context-aware batches, retries, and usage reporting. API keys and project data must remain local unless a user explicitly configures a provider.

Codex support would be used to extend this foundation with focused, testable increments: AI adapter boundaries, translation-quality checks, import/export fixtures, and documentation for localization teams. The project is small enough for contributors to run locally and concrete enough for each change to be verified against the included fixtures.
