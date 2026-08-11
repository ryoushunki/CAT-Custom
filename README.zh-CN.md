# LingoForge CAT

面向游戏本地化的本地优先桌面 CAT 工具，重点支持个人翻译、发行团队少量内部翻译，以及术语库、翻译记忆库和非译元素管理。

[English README](README.en.md) · [更新日志](CHANGELOG.md) · [GitHub Releases](https://github.com/ryoushunki/CAT-Custom/releases)

## 项目定位

LingoForge CAT 用于减少在云文档、AI 工具和本地文件之间反复复制粘贴的操作，帮助翻译人员保持术语、标签和格式的一致性。

它不是面向多人账号、任务分配或供应商管理的系统，而是一个本地优先的单人 CAT 工作台原型，后续可以交给技术团队继续扩展。

## 当前能力

- 现代化三栏翻译工作区；
- Excel、CSV、TSV 导入；
- 工作表、原文列、译文列、起始行和语言选择；
- 非译元素正则表达式设置；
- 非译元素 token 展示、缺失/多出/顺序 QA 和快速插入；
- Ctrl+Enter 确认句段；
- 修改已确认译文后自动进入待检查；
- XLSX 原格式回写导出；
- CSV、TSV 按原始行列回写；
- 本地项目创建、切换和项目级资产绑定；
- 翻译记忆库导入、模糊匹配和实时建议；
- 术语库导入、分类和实时命中；
- 项目、文件、资产和导入设置使用 IndexedDB 保存在本机；
- Electron Windows 安装包。

## 开发

环境要求：Node.js、npm 和 Windows Electron 构建环境。

```powershell
npm.cmd install
npm.cmd run dev
```

验证构建和导出功能：

```powershell
npm.cmd run build
npm.cmd run test:export
```

构建 Windows 安装包：

```powershell
npm.cmd run dist
```

## 数据安全

真实项目文件、客户文本、翻译记忆库和术语库不会由应用自动上传。数据默认保存在本机 IndexedDB 中，原始导入文件也保存在本机用于导出回写。

仓库通过 `.gitignore` 排除本地构建产物和常见翻译文件格式。提交代码前仍应检查 `git status` 和 `git diff`，确认没有加入公司或客户数据。

## 版本与 Release

当前版本为 `v0.6.0`，版本号与 `package.json` 保持一致。

- `v0.x.y`：开发验证阶段；
- 第三个数字递增：问题修复和小幅改动，例如 `v0.6.1`；
- 第二个数字递增：新增功能，例如 `v0.7.0`；
- `v1.0.0`：达到稳定可交接版本。

源码通过 Git tag 管理版本，Windows 安装包应作为 GitHub Release 附件发布，不直接提交到源码仓库。

## 路线图

后续计划包括：

- 资产重命名和编辑；
- TMX 导入导出；
- 更完整的数字、标点、空格和长度 QA；
- 可配置 OpenAI-compatible、Anthropic、Gemini 等 API；
- 项目级提示词和本地化风格；
- 批量翻译、重试和 API 消耗统计。

详见 [docs/ROADMAP.md](docs/ROADMAP.md)。
