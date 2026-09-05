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

[Vela 快应用真机坑: list-item 上 for 与 if 不得同用]
- Date: 2026-08-29
- Context: Discovered by Agent while 修复 catalog 页整列无内容(真机截图:只剩「还有 N 条」加载项)
- Category: Troubleshooting & Debugging
- Instructions:
  - Vela 的 list-item 同时写 for 和 if 时,if 不会按条目求值,真机会整列不渲染(本地构建无任何报错,只能真机发现)
  - 正确模式: 同页单 type 单 list-item,DOM 结构完全一致,行内差异用三元动态 class 表达(class="{{$item.kind === 'x' ? 'a' : 'b'}}"),该方法已在 catalog/mass 真机验证
  - 同类 CSS 限制: 不支持后代选择器(.a .b),构建期告警「Selector type unsupport Descendant Selector」,样式静默失效
  - 完整 UI 规范已固化在仓库根目录 VELA_UI_SKILL.md,新页面开发先读它

[Vela 列表滑动性能：splice 增量追加优于 concat；方程式文本懒计算]
- Date: 2026-09-05
- Context: Discovered by Agent while 优化化学工具箱列表滑动卡顿（V26.9.47）
- Category: Troubleshooting & Debugging
- Instructions:
  - 长列表 onscrollbottom 追加用 `this.rows.splice(this.rows.length, 0, ...more)`，
    不用 `this.rows = this.rows.concat(more)`：concat 生新数组整表 diff，splice 只增量挂新行
  - 大结果集（元素/合成查询 50 条）先建占位行（text:'')，仅首屏块立即 equationText 解析，
    追加时再补该块；搜索按钮链路不再被几十次 parseFormula 占住
  - 键盘横滑 progress：percent 变化 <2 不回写，滚动事件高频下 progress 不重绘
  - elementBank.js 由 scripts/genBank.mjs 生成，改引擎后必须 `node scripts/genBank.mjs > src/common/logic/elementBank.js`
  - 词库由 scripts/gen_chem_dict.py 生成（先装 pypinyin），改 NAME_MAP/元素后重跑

[滚动页顶部渐隐：hd.png 自身即遮罩，禁止额外叠层]
- Date: 2026-08-29（20-08 修订：此前「top_fade 规格」条目结论错误，以本条为准）
- Context: 用户多次反馈遮罩消失/位置错误/像多加一层；最终用户指认弦电子书仓库 e2e 原版
- Category: Environment Configuration
- Instructions:
  - 原版设计里 common/images/hd.png（336×102，α 逐行 255→6）本身就是顶部渐隐遮罩，
    与弦电子书仓库 src/common/images/hd.png 逐字节一致
  - 滚动列表页正确结构：list 全屏铺底 → 直接画 hd 四件套；内容滑入顶栏下方时被 hd.png 半透明底部自然渐隐
  - 严禁叠任何自制遮罩层/自制 top_fade.png（无论 alpha 如何调）：
    叠层会盖住 hd.png 渐变——表现为「遮罩消失」或「像多加了一层」；
    全部相关资产、.top-fade 样式与各页引用已移除（2026-08-29）
  - 每次改动涉及顶部视觉时，先核对 VELA_UI_SKILL.md 第 2 节

