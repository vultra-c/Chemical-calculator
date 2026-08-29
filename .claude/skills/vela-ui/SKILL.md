---
name: vela-ui-style
description: 小米 Vela 快应用「闪念小抄」UI 风格开发规范（化学工具箱 / 弦电子书同源）。新建或修改本仓库页面、卡片、列表、顶栏、交互时使用；确保与现有视觉、交互、性能模式完全一致。
---

# Vela UI 风格 Skill

完整规范见仓库根目录 `VELA_UI_SKILL.md`（单一权威来源）。本文件为加载入口与速记。

## 必须遵守（速查）

1. 屏幕 336×480，designWidth 336，主体 absolute 顶层挂载；**禁止后代选择器**。
2. **list-item 的 for 与 if 不得同用**；同 type 同 DOM，差异用三元动态 class；`tid` 唯一；列表分块渲染（`onscrollbottom`）。
3. 顶栏四件套：`hd.png` 底图 + `back.png`（6,6,72×72）+ 可选 `more.png`（258,6）+ `hd-sub`/`hd-title`；坐标取自 `src/common/style.css`。
4. 滚动列表页：`.list` 全屏铺底（`padding:102px 6px 8px`）；**遮罩 = hd.png 自身渐变**（α 255→6，与弦电子书同文件），它绘制在 list 之后即完成渐隐，**不要再叠自制遮罩层**（top_fade 之类，真机踩过坑）。
5. 有键盘的页面：输入卡与主按钮必须在 y ≤ 252px 的键盘遮挡安全区内。
6. 交互：右滑返回（键盘开则先收）、`onBackPress` 返回 true、主页右滑 `app.terminate()`、反馈用 `prompt.showToast`。
7. 长文本拼单字符串渲染；重计算函数配模块级 Map 缓存；大字典/银行惰性构建。
8. `@system.*` 仅在页面（.ux）import；`common/logic` 纯逻辑保持 Node 可测；展示数值用 `settings.js` 的 `fmtOut`。
9. 色板：背景 #000、卡片 #262626、主蓝 #0d6eff、强调 #4da3ff、圆角 36/28/24/21、字级见根文件。
10. 验收：`node tests/smoke.mjs`、`npm run release`、`node scripts/verify-rpk.mjs dist/*.rpk` 三步全过；分发走 GitHub Releases 原始 rpk。

新建页面按 `VELA_UI_SKILL.md` 第 8 节清单逐项过一遍再提交。
