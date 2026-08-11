# 更新日志 / Changelog

## v0.6.0 — 2026-08-07

### 简体中文

- 新增本地项目创建、切换和项目级翻译资产绑定；
- 新增术语库和翻译记忆库的自定义名称与分类；
- 新增导入向导：工作表、原文列、译文列、起始行、语言和非译元素正则；
- 新增非译元素 token 展示、缺失/多出/顺序 QA 和快速插入；
- 导出按钮明确为“导出当前文件”；
- 修复 CSV 空行导致的原始行号偏移；
- 完成 XLSX、CSV、TSV 导入、编辑、回写导出和本地持久化；
- 生成 Windows 安装包。

### English

- Added local project creation, switching, and project-level translation asset binding;
- Added custom names and categories for termbases and translation memories;
- Added an import wizard for worksheets, source/target columns, start row, languages, and protected-element regex;
- Added protected tag tokens, missing/extra/order QA, and quick tag insertion;
- Clarified the export action as “Export current file”;
- Fixed CSV blank-row offsets during round-trip export;
- Completed XLSX, CSV, and TSV import, editing, export, and local persistence;
- Added the Windows installer build.

## Data notice / 数据说明

This repository contains source code and generic test fixtures only. It does not contain personal or company translation files, customer strings, translation memories, termbases, or local IndexedDB data.

本仓库仅包含源代码和通用测试文件，不包含个人或公司翻译文件、客户文本、翻译记忆库、术语库或本地 IndexedDB 数据。
