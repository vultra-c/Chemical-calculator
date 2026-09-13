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

[Git 提交与认证方式 / 推送授权]
- Date: 2026-08-28（2026-09-05 修订：用户明确长期授权推送）
- Context: 用户交接 Chemical-calculator 项目时提供；2026-09-05 用户指令"确认,以后都推送"
- Instructions:
  - 仓库地址: github.com/vultra-c/Chemical-calculator,默认分支 main
  - 用户长期授权:每次开发完成并验证（测试+构建）通过后,直接 commit 并 push 到 main,不再逐次询问
  - 提交信息风格跟随历史:中文、概括主要改动、多行明细（参考 0199b5e / 0c3ea9b）
  - 推送前检查: node tests/smoke.mjs 全过 + npm run release 构建成功 + verify-rpk 通过
  - 提交/推送代码使用用户在对话中提供的 GitHub personal access token(以 x-access-token 方式拼入 push URL 使用);当前环境 credential helper 已可取凭据,直接用 git push 即可
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

[Vela 真机坑: flex 兄弟节点 show=false 不塌缩 与 if 兄弟增删连累渲染 双向陷阱]
- Date: 2026-09-13（V26.9.52 修订：此前"正确模式：改 show"的结论已过时）
- Context: Discovered by Agent while 修复英文键盘联想行永不渲染 — V26.9.51 尝试改 show 反致控制行整体压扁
- Category: Troubleshooting & Debugging
- Instructions:
  - 症状双向: (a) 兄弟节点用 if 增删 → 夹在中间的存续节点在真机上有几率停止渲染（构建/模拟器不重现）;
    (b) 兄弟节点用 show=false → 真机上节点仍保留在 flex 布局中占位，容器 flex 会把整行按钮均匀压扁，
    表现为「整行按钮变窄、候选胶囊行完全被挤没」
  - Show 不塌缩是设备侧行为（与部分文档描述相反），Vela 项目一律不能把 show=false 当作「塌陷式隐藏」
  - 优先保持结构恒定：显隐切换按钮若必须共存，用「固定槽位 + 内部 img/文案数据绑定」而非整块显隐；
    InputMethod 控制行 V26.9.52 已回退 if（历史兄弟结构真机可用），show 方案不可行
  - 页面层与输入法兜底（防吞输入）：onInput 字母正则必须允许多字符整词候选（ca/cu）；
    输入法 resetResultList 英文分支要 try/catch + 候选空即直出 cval；space 键无论中英都先 flush cval，
    确保候选行渲染失败时键盘至少能用
  - 排查路径复用: 真机「字面进输入法但无联想/不上屏」→ 先看键盘 JS 是否吞字符（正则、字典初始化异常），
    再看候选行两侧兄弟结构；「整行宽度异常」→ 检查是否使用了 show 隐藏兄弟

  - 兄弟 增删 与 flex 溢出是两个独立真机坑：V26.9.54 复盘发现 en mode 候选行不出现的直接原因
    是 flex 溢出（en 60 + case 94 + 123 94 + del 60 + 4 cand-ml + 3 side-ml = 326px > 324px 可用），
    Yoga flex:1 clamps 0 → <text for> 无宽；兄弟 增删是次生隐患
  - 修法：控制行改恒定 5 槽位（.ks-1st/.ks-mid/.ks-last/.ks-cand 及其 off 变体 class 切换宽度），
    case/123 图片 94x60 → 60x60 与 cn/en/del 对齐；兄弟数量恒定 + 每键 60 宽，cand 净宽 82px

[Vela 输入法英文模式：字母即时上屏 + 反向 delete 换整词（不依赖候选行渲染）]
- Date: 2026-09-13
- Context: 用户反馈 V26.9.52 英文候选行仍不渲染但 JS 数据完整（DIAG toast 证实 rw/r0 正常）
- Category: Troubleshooting & Debugging
- Instructions:
  - 症状再诊断: englishSymbolIndex() 与 resultRow0 均正确装箱（idx=128 hits=12 rw=4 r0=4），
    但真机 flex:1 候选 <text for> 未渲染出胶囊——即使兄弟节点全 if 也不救
  - 修复方向: 输入可用性绝不绑死候选行；onSelect 英文分支改为 `addAllTxt(letter)`
    + `this.pendingEn += letter`（新增私有 data 字段），候选行只作为可选辅助
  - onRsSelect 英文分支：先按 pendingEn.length 反向 $emit('delete')（页面 onDel 逐字符回退），
    再 addAllTxt(candidate) 一次性写入整词
  - D/space/lang/switchNum/switchCn/AC/watchHide 全量清 pendingEn，避免跨段串扰
  - 中文/日文模式仍走 cval + getResultByWord 异步候选路径，不受影响

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

