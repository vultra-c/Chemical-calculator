# 化学反应计算器（小米 Vela 轻应用）

纯离线运行的化学反应计算工具，适配小米 Vela 穿戴设备（手表 / 手环）。所有计算、数据与反应库均在本地完成，**无任何联网请求**。

## 功能

1. **反应物输入识别**：支持标准化学式（`Fe`、`CuSO4·5H2O`）与物质中文名称（`铁`、`胆矾`、`熟石灰` 等 150+ 词条），多种物质用 `+` 分隔；自动过滤非法字符，无法识别时明确提示。
2. **全自动生成物推导**：内置经典反应库 + 规则推理（燃烧、还原、置换、中和、复分解、化合、分解等），自动生成全部产物；无法发生的组合会给出原因，绝不乱配。
3. **智能配平**：BigInt 精确分数 + 高斯消元求零空间，输出最简整数系数。
4. **双向质量计量**：任选方程式中一种物质输入已知质量（克），自动计算其余所有物质的摩尔数与质量（正向 / 反向均可）。
5. **元素数据离线查询**：68 种常见元素的相对原子质量（IUPAC 标准值）本地可查，支持符号 / 名称 / 序号搜索。
6. **一键重置**：随时清空输入与结果，无限次反复计算。

## 工程结构

```
├── src/
│   ├── manifest.json          # 应用配置（3 页面路由）
│   ├── app.ux                 # 入口
│   ├── icon.png               # 应用图标
│   ├── pages/
│   │   ├── index.ux           # 首页
│   │   ├── calc.ux            # 反应计算页
│   │   └── elements.ux        # 元素查询页
│   └── common/chemistry/      # 纯 JS 化学引擎（零依赖，可独立测试）
│       ├── elements.js        # 相对原子质量库
│       ├── substances.js      # 中文名称词典
│       ├── parser.js          # 化学式解析器（含结晶水合物）
│       ├── balance.js         # 精确配平算法
│       └── reactions.js       # 反应规则推导 + 计量计算
├── tests/chemistry.test.mjs   # 32 个单元测试
└── tools/gen-icon.mjs         # 零依赖图标生成器
```

## 构建为 .rpk

### 云端 / 本地命令行构建（已验证可用）

```bash
npm install       # 安装工具链（aiot-toolkit 2.0.5）
npm run build     # 构建 debug 包 → dist/com.velachem.calculator.debug.1.0.0.rpk
npm test          # 同步运行化学引擎单元测试
```

debug 包使用工具链内置调试证书，可直接通过 AIoT-IDE「安装调试包」或 adb 侧载到 Vela 设备测试。

### 发布包（release）

```bash
npm run release   # 需要正式签名证书，放入 sign/release/
```

上架应用商店必须使用与开发者小米账号绑定的正式证书（见 `sign/release/README.txt`）；
若涉及手表与手机 App 通信，两端证书须一致。

也可以直接用 [AIoT-IDE](https://iot.mi.com/vela/quickapp/zh/) 打开本目录进行模拟器预览与构建。

设计基准：圆屏 466×466（`config.designWidth: 466`），深色 OLED 友好配色。

## 测试化学引擎

无需任何依赖：

```bash
npm test
# 或 node --test tests/chemistry.test.mjs
```

覆盖解析、词典、配平、20+ 类反应推导与计量计算的 32 个断言。

## 说明

- 原子量采用 IUPAC 精确值（如 Fe=55.845），结果与教材取整值（Fe=56）可能有 <1% 的正常差异。
- K/Ca/Na 与酸、盐溶液的反应按教材规范给出「不适用」说明而非强行配平。
- 暂不支持三种及以上反应物组合推导。
