/**
 * 数据速查（纯逻辑模块，可被 Node 冒烟测试直接导入）。
 * 数据源全部派生自 elements.js 常量，页面只渲染不加工。
 * 行结构复用 catalog 的 {kind:'title'|'item', main, sub}，可视化与常用物质表一致。
 */
import { ATOMIC_MASSES, ACTIVITY, CATION_CHARGE, ANIONS, INSOLUBLE, ELEMENT_Z, ION_TABLE } from './elements.js'
import { ELEMENT_CN } from './elementQuery.js'
import { formulaToText, chargeText } from './fmt.js'
import { formulaName } from './substances.js'

const REV_CN = {}
for (const cn in ELEMENT_CN) REV_CN[ELEMENT_CN[cn]] = cn

export function cnName(sym) { return REV_CN[sym] || sym }

/** 常见根/酸根的展示名（中学常用） */
const ANION_NAME = {
  Cl: '氯离子', Br: '溴离子', I: '碘离子', S: '硫离子',
  OH: '氢氧根', NO3: '硝酸根', SO4: '硫酸根', SO3: '亚硫酸根',
  CO3: '碳酸根', HCO3: '碳酸氢根', MnO4: '高锰酸根', MnO4b: '锰酸根',
  ClO3: '氯酸根', PO4: '磷酸根'
}

function atomMassRows() {
  const syms = Object.keys(ATOMIC_MASSES)
  const rows = []
  for (let i = 0; i < syms.length; i += 2) {
    const a = syms[i]
    const b = syms[i + 1]
    const left = cnName(a) + ' ' + a + '  ' + ATOMIC_MASSES[a]
    const right = b ? cnName(b) + ' ' + b + '  ' + ATOMIC_MASSES[b] : ''
    rows.push({ main: left, sub: right })
  }
  return rows
}

/** 元素周期表（按原子序数 1→118，两列「序数 中文 符号」成对成行） */
function periodicRows() {
  const syms = Object.keys(ATOMIC_MASSES)
  const rows = []
  for (let i = 0; i < syms.length; i += 2) {
    const a = syms[i]
    const b = syms[i + 1]
    const left = ELEMENT_Z[a] + ' ' + cnName(a) + ' ' + a
    const right = b ? ELEMENT_Z[b] + ' ' + cnName(b) + ' ' + b : ''
    rows.push({ main: left, sub: right })
  }
  return rows
}

/** 电荷 ASCII → 汉字读法（离子右上标口语，如 3+ 三加、2- 二减） */
const CHARGE_READING = { '+': '一加', '-': '一减', '2+': '二加', '3+': '三加', '2-': '二减', '3-': '三减' }

/**
 * 常见离子符号（阳离子在前、阴离子随后）。
 * 真机字体缺 Unicode 上标字形（³⁺ 显示为空白/豆腐），
 * 展示一律 ASCII：化学式原样保留角标数字（SO4、NH4），电荷与读法放副行。
 */
function ionRows() {
  const rows = ION_TABLE.map(it => {
    const c = chargeText(it.q)
    const reading = CHARGE_READING[c] || c
    return {
      main: it.name + ' ' + it.f,
      sub: '电荷 ' + c + '（读作 ' + reading + '）'
    }
  })
  // 读法说明行（零基础考点：离子右上标数字在前符号在后，读作"几加/几减"）
  rows.push({ main: '读法提示', sub: '右上标数字在前：3+ 读三加、2- 读二减，1 省略不写' })
  return rows
}

function cationRows() {
  // 中学常见顺序：+1 → +2 → +3，最后铁变价单独说明
  const order = ['K', 'Na', 'Ag', 'NH4', 'H', 'Ca', 'Ba', 'Mg', 'Zn', 'Cu', 'Hg', 'Sn', 'Pb', 'Al']
  const rows = [
    { main: '化合价口诀 上', sub: '一价氢氯钾钠银 二价氧钙钡镁锌' },
    { main: '化合价口诀 下', sub: '三铝四硅五价磷 二三铁 二四碳 二四六硫 铜汞二价最常见' }
  ]
  for (let i = 0; i < order.length; i++) {
    const s = order[i]
    if (!CATION_CHARGE[s]) continue
    const cn = s === 'NH4' ? '铵根' : cnName(s)
    rows.push({ main: cn + ' ' + formulaToText(s), sub: '+' + CATION_CHARGE[s] })
  }
  rows.push({ main: '铁 Fe 变价·低价', sub: '+2' })
  rows.push({ main: '铁 Fe 变价·高价', sub: '+3' })
  return rows
}

function anionRows() {
  const rows = [
    { main: '根价口诀', sub: '负一硝酸氢氧根 负二硫酸碳酸根 负三只有磷酸根 正一价的是铵根' }
  ]
  for (const id in ANIONS) {
    const a = ANIONS[id]
    rows.push({ main: ANION_NAME[id] + ' ' + formulaToText(a.label), sub: '-' + a.charge })
  }
  return rows
}

function insolubleRows() {
  return INSOLUBLE.map((f) => {
    const nm = formulaName(f)
    return {
      main: (nm && nm !== f) ? nm : f,
      sub: formulaToText(f) + '↓'
    }
  })
}

/** 常见物质颜色（九年级推断题速查） */
const COLOR_ROWS = [
  { main: '黑色固体', sub: 'C、CuO、MnO₂、Fe₃O₄、铁粉' },
  { main: '红色固体', sub: 'Cu（紫红）、Fe₂O₃（红棕）、红磷（暗红）' },
  { main: '黄色固体', sub: 'S（淡黄）' },
  { main: '紫黑色固体', sub: 'KMnO₄' },
  { main: '蓝色晶体', sub: 'CuSO₄·5H₂O（胆矾）' },
  { main: '蓝色沉淀', sub: 'Cu(OH)₂' },
  { main: '红褐色沉淀', sub: 'Fe(OH)₃' },
  { main: '白色沉淀（不溶于稀酸）', sub: 'BaSO₄、AgCl' },
  { main: '白色沉淀（溶于酸并放气）', sub: 'CaCO₃、BaCO₃、MgCO₃' },
  { main: '白色沉淀（溶于酸不放气）', sub: 'Mg(OH)₂、Al(OH)₃、Zn(OH)₂' },
  { main: '蓝色溶液', sub: '含 Cu²⁺：CuSO₄、CuCl₂、Cu(NO₃)₂' },
  { main: '浅绿色溶液', sub: '含 Fe²⁺：FeSO₄、FeCl₂' },
  { main: '黄色溶液', sub: '含 Fe³⁺：FeCl₃、Fe₂(SO₄)₃' },
  { main: '高锰酸钾溶液', sub: '紫红色' }
]

/** 常见气体的制取与检验（九年级实验题速查：main=气体，sub=制法·检验） */
const GAS_ROWS = [
  { main: 'O₂ 制取', sub: 'KMnO₄ 加热 / KClO₃+MnO₂ / H₂O₂+MnO₂' },
  { main: 'O₂ 检验', sub: '带火星木条复燃' },
  { main: 'H₂ 制取', sub: 'Zn + 稀硫酸（或稀盐酸）' },
  { main: 'H₂ 检验', sub: '点燃爆鸣、淡蓝火焰，干冷烧杯内壁有水珠' },
  { main: 'CO₂ 制取', sub: '大理石/石灰石 + 稀盐酸（不用浓盐酸与稀硫酸）' },
  { main: 'CO₂ 检验', sub: '通入澄清石灰水，变浑浊' },
  { main: 'CO₂ 验满', sub: '燃着木条放瓶口，熄灭则满' },
  { main: 'NH₃ 检验', sub: '湿润红色石蕊试纸变蓝，刺激性气味' },
  { main: 'CO 检验', sub: '点燃蓝色火焰，产物使石灰水变浑浊' },
  { main: '水蒸气检验', sub: '无水硫酸铜（白色）变蓝' }
]

/** 分组化数据：{title, rows[]} — 金属活动性按记忆节律折 3 行 */
export const REFERENCE_SECTIONS = [
  { title: '元素周期表（118 元素 · 按原子序数）', rows: periodicRows() },
  {
    title: '金属活动性顺序',
    rows: [
      { main: 'K > Ca > Na > Mg > Al > Zn', sub: '' },
      { main: 'Fe > Sn > Pb > (H)', sub: '' },
      { main: 'Cu > Hg > Ag > Pt > Au', sub: '' }
    ]
  },
  { title: '常见元素化合价', rows: cationRows() },
  { title: '常见根 / 酸根化合价', rows: anionRows() },
  { title: '常见离子符号', rows: ionRows() },
  { title: '常见不溶物（沉淀）', rows: insolubleRows() },
  { title: '常见物质颜色', rows: COLOR_ROWS },
  { title: '常见气体制取与检验', rows: GAS_ROWS },
  { title: '相对原子质量表', rows: atomMassRows() }
]

/** 展平成滚动画面的行流（含分组标题行） */
export function flattenReference() {
  const rows = []
  let n = 0
  for (let g = 0; g < REFERENCE_SECTIONS.length; g++) {
    const sec = REFERENCE_SECTIONS[g]
    rows.push({ kind: 'title', rid: 't' + g, main: '【' + sec.title + '】', sub: '' })
    for (let i = 0; i < sec.rows.length; i++) {
      const r = sec.rows[i]
      rows.push({ kind: 'item', rid: 'r' + (n++), main: r.main, sub: r.sub || '' })
    }
  }
  return rows
}

export { ACTIVITY }
