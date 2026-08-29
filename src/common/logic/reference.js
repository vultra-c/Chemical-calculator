/**
 * 数据速查（纯逻辑模块，可被 Node 冒烟测试直接导入）。
 * 数据源全部派生自 elements.js 常量，页面只渲染不加工。
 * 行结构复用 catalog 的 {kind:'title'|'item', main, sub}，可视化与常用物质表一致。
 */
import { ATOMIC_MASSES, ACTIVITY, CATION_CHARGE, ANIONS, INSOLUBLE } from './elements.js'
import { ELEMENT_CN } from './elementQuery.js'
import { formulaToText } from './fmt.js'
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

function cationRows() {
  // 中学常见顺序：+1 → +2 → +3，最后铁变价单独说明
  const order = ['K', 'Na', 'Ag', 'NH4', 'H', 'Ca', 'Ba', 'Mg', 'Zn', 'Cu', 'Hg', 'Sn', 'Pb', 'Al']
  const rows = []
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
  const rows = []
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

/** 分组化数据：{title, rows[]} — 金属活动性按记忆节律折 3 行 */
export const REFERENCE_SECTIONS = [
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
  { title: '常见不溶物（沉淀）', rows: insolubleRows() },
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
