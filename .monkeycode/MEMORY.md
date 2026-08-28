# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.

## Entries

[Git 提交与认证方式]
- Date: 2026-08-28
- Context: 用户交接 Chemical-calculator 项目时提供
- Instructions:
  - 仓库地址: github.com/vultra-c/Chemical-calculator,默认分支 main
  - 提交/推送代码使用用户在对话中提供的 GitHub personal access token(以 x-access-token 方式拼入 push URL 使用)
  - token 本身属于敏感凭据:不得写入仓库任何文件、不得随提交进入历史、不得在回复中展示,仅在命令中临时引用
  - 用户提到 token 直接粘贴在对话中,若担心泄露应提醒用户可轮换

[RPK 安装「没有包名」排查路径]
- Date: 2026-08-28
- Context: Discovered by Agent while 修复 Action 构建产物安装时显示没有包名的问题
- Category: Troubleshooting & Debugging
- Instructions:
  - 小米 Vela 快应用的 RPK 必须以「原始 .rpk 文件」形式分发安装
  - GitHub Actions artifact 一律是 zip 容器(内部才是 .rpk),把 zip 直接交给安装器会因读不到 manifest.json 而显示「没有包名」,这是该报错的最常见原因
  - 本项目分发渠道: Action 自动发布到 GitHub Release(tag 为 v{versionCode}),原始 rpk 为 release asset,直链 releases/latest/download/ 可下载
  - 本地/CI 可用 node scripts/verify-rpk.mjs <rpk> 校验:包名可解析 + 含 RPK Sig Block 42 签名块
  - 用户后续会提供正式签名文件替换 sign/release/,替换后重新触发构建即可,verify 脚本与证书无关、可继续用作闸门
