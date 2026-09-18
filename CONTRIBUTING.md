# Contributing to LingoForge CAT

Thank you for helping improve LingoForge CAT, a local-first CAT workspace for game localization.

## Development setup

Requirements:

- Node.js 20 or newer;
- npm;
- Windows if you need to build the Electron installer.

Install dependencies and start the development server:

```powershell
npm.cmd install
npm.cmd run dev
```

Before opening a pull request, run:

```powershell
npm.cmd run build
npm.cmd run test:export
```

## Contribution guidelines

- Keep changes focused on one behavior or workflow.
- Add or update a regression test when changing import, export, protected elements, or asset matching.
- Do not commit customer strings, company files, real translation memories, termbases, API keys, or local IndexedDB exports.
- Use the included fixtures under `tests/fixtures` for reproducible examples.
- Describe user-visible behavior and verification steps in the pull request.

## Project direction

The current release is a local single-user CAT workbench. The planned AI layer is opt-in and provider-agnostic: it should support OpenAI-compatible endpoints without uploading project data unless the user explicitly configures a provider. See [the roadmap](docs/ROADMAP.md).

## 中文说明

欢迎参与 LingoForge CAT。提交代码前请运行 `npm.cmd run build` 和 `npm.cmd run test:export`。不要提交客户文本、公司文件、真实术语库、翻译记忆库、API Key 或本地 IndexedDB 数据。涉及导入、导出、非译元素和资产匹配的改动，请补充回归测试。
