/**
 * 化学计算器 - 元素与化学基础数据（全部离线内置）
 */

/**
 * 标准相对原子质量（IUPAC 2021 常规值）
 * 全量 118 元素（人教版九年级附录元素周期表全集），键序即原子序数 1→118。
 * 放射性元素无稳定同位素时取最稳定同位素质量数（惯例加括号的值）。
 */
export const ATOMIC_MASSES = {
  H: 1.008, He: 4.003, Li: 6.941, Be: 9.012, B: 10.811,
  C: 12.011, N: 14.007, O: 15.999, F: 18.998, Ne: 20.180,
  Na: 22.990, Mg: 24.305, Al: 26.982, Si: 28.086, P: 30.974,
  S: 32.065, Cl: 35.453, Ar: 39.948, K: 39.098, Ca: 40.078,
  Sc: 44.956, Ti: 47.867, V: 50.942, Cr: 51.996, Mn: 54.938,
  Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.409,
  Ga: 69.723, Ge: 72.631, As: 74.922, Se: 78.971, Br: 79.904,
  Kr: 83.798, Rb: 85.468, Sr: 87.62, Y: 88.906, Zr: 91.224,
  Nb: 92.906, Mo: 95.95, Tc: 98, Ru: 101.07, Rh: 102.906,
  Pd: 106.42, Ag: 107.868, Cd: 112.414, In: 114.818, Sn: 118.71,
  Sb: 121.76, Te: 127.6, I: 126.904, Xe: 131.293, Cs: 132.905,
  Ba: 137.327, La: 138.905, Ce: 140.116, Pr: 140.908, Nd: 144.242,
  Pm: 145, Sm: 150.36, Eu: 151.964, Gd: 157.25, Tb: 158.925,
  Dy: 162.5, Ho: 164.93, Er: 167.259, Tm: 168.934, Yb: 173.045,
  Lu: 174.967, Hf: 178.486, Ta: 180.948, W: 183.84, Re: 186.207,
  Os: 190.23, Ir: 192.217, Pt: 195.084, Au: 196.967, Hg: 200.591,
  Tl: 204.38, Pb: 207.2, Bi: 208.98, Po: 209, At: 210,
  Rn: 222, Fr: 223, Ra: 226, Ac: 227, Th: 232.038,
  Pa: 231.036, U: 238.029, Np: 237, Pu: 244, Am: 243,
  Cm: 247, Bk: 247, Cf: 251, Es: 252, Fm: 257,
  Md: 258, No: 259, Lr: 262, Rf: 267, Db: 268,
  Sg: 269, Bh: 270, Hs: 270, Mt: 278, Ds: 281,
  Rg: 282, Cn: 285, Nh: 286, Fl: 289, Mc: 290,
  Lv: 293, Ts: 294, Og: 294
}

/** 元素符号 → 原子序数（1-118，由 ATOMIC_MASSES 键序派生，勿手改） */
export const ELEMENT_Z = (function () {
  const z = {}
  Object.keys(ATOMIC_MASSES).forEach(function (s, i) { z[s] = i + 1 })
  return z
})()

/**
 * 英文符号联想前缀索引（英文键盘输入联想用）：小写前缀 → 候选列表。
 * 每条候选 { sym, rest }：sym 为元素标准符号，rest 为去掉前缀后的剩余小写部分，
 * 输入拼接 rest 即得完整符号，如 'c' → Ca/Cd/Ce/Cl/Co/Cr/Cs/Cu…（字母序）。
 */
let _enIndex = null
export function englishSymbolIndex() {
  if (_enIndex) return _enIndex
  const syms = Object.keys(ATOMIC_MASSES)
  const idx = {}
  for (let i = 0; i < syms.length; i++) {
    const s = syms[i]
    const low = s.toLowerCase()
    for (let len = 1; len <= low.length; len++) {
      const p = low.slice(0, len)
      const rest = low.slice(len)
      if (!idx[p]) idx[p] = []
      idx[p].push({ sym: s, rest: rest })
    }
  }
  for (const p in idx) {
    idx[p].sort(function (a, b) { return a.sym < b.sym ? -1 : (a.sym > b.sym ? 1 : 0) })
  }
  _enIndex = idx
  return idx
}

/** 金属活动性顺序（由强到弱） */
export const ACTIVITY = ['K', 'Ca', 'Na', 'Mg', 'Al', 'Zn', 'Fe', 'Sn', 'Pb', 'H', 'Cu', 'Hg', 'Ag', 'Pt', 'Au']

export function activityIndex(sym) {
  const i = ACTIVITY.indexOf(sym)
  return i
}

/** 常见金属单质 */
export const METALS = ['K', 'Ca', 'Na', 'Mg', 'Al', 'Zn', 'Fe', 'Sn', 'Pb', 'Cu', 'Hg', 'Ag', 'Pt', 'Au', 'Ba']

/** 常见非金属单质（化学式形式） */
export const NONMETALS = ['H2', 'O2', 'N2', 'Cl2', 'F2', 'C', 'S', 'P', 'Si']

/** 阳离子 → 常见化合价（盐的组成用） */
export const CATION_CHARGE = {
  K: 1, Na: 1, Ag: 1, NH4: 1,
  Ca: 2, Ba: 2, Mg: 2, Cu: 2, Zn: 2, Fe: 3, Sn: 2, Pb: 2, Hg: 2,
  Al: 3
}

/** 置换反应/金属与酸反应中，变价金属按低价成盐 */
export const DISPLACEMENT_CHARGE = {
  K: 1, Ca: 2, Na: 1, Mg: 2, Al: 3, Zn: 2, Fe: 2, Sn: 2, Pb: 2,
  Cu: 2, Hg: 2, Ag: 1
}

/** 常见酸根/阴离子：id → {label, charge, poly} */
export const ANIONS = {
  Cl: { label: 'Cl', charge: 1, poly: false },
  Br: { label: 'Br', charge: 1, poly: false },
  I: { label: 'I', charge: 1, poly: false },
  S: { label: 'S', charge: 2, poly: false },
  OH: { label: 'OH', charge: 1, poly: true },
  NO3: { label: 'NO3', charge: 1, poly: true },
  SO4: { label: 'SO4', charge: 2, poly: true },
  SO3: { label: 'SO3', charge: 2, poly: true },
  CO3: { label: 'CO3', charge: 2, poly: true },
  HCO3: { label: 'HCO3', charge: 1, poly: true },
  MnO4: { label: 'MnO4', charge: 1, poly: true },
  MnO4b: { label: 'MnO4', charge: 2, poly: true },
  ClO3: { label: 'ClO3', charge: 1, poly: true },
  PO4: { label: 'PO4', charge: 3, poly: true },
  S2O3: { label: 'S2O3', charge: 2, poly: true },
  HS: { label: 'HS', charge: 1, poly: true }
}

/** 由阴离子组成识别酸根：组成签名 → 候选阴离子 id 列表（按常见优先） */
export const RADICAL_SIGNATURES = {
  'N1O3': ['NO3'],
  'S1O4': ['SO4'],
  'S1O3': ['SO3'],
  'C1O3': ['CO3'],
  'C1H1O3': ['HCO3'],
  'Mn1O4': ['MnO4', 'MnO4b'],
  'Cl1O3': ['ClO3'],
  'P1O4': ['PO4']
}

/** 不溶性（沉淀）产物集合：用于复分解反应可行性判断 */
export const INSOLUBLE = [
  'AgCl', 'BaSO4', 'PbSO4',
  'CaCO3', 'BaCO3', 'Ag2CO3',
  'MgCO3', 'ZnCO3',
  'Cu(OH)2', 'Fe(OH)2', 'Fe(OH)3', 'Mg(OH)2', 'Al(OH)3', 'Zn(OH)2',
  'AgBr', 'AgI', 'CaSO3', 'BaSO3',
  'PbCO3', 'Ca3(PO4)2', 'Ba3(PO4)2', 'Ag3PO4'
]

export function isInsoluble(formula) {
  return INSOLUBLE.indexOf(formula) !== -1
}

/** 微溶导致反应难以发生的组合（金属+稀硫酸） */
export const BLOCKED_METAL_ACID = [
  'Pb+H2SO4', 'Ca+H2SO4'
]

/** 可被 C/H2/CO 还原的金属氧化物 */
export const REDUCIBLE_OXIDES = ['CuO', 'Fe2O3', 'Fe3O4', 'ZnO', 'PbO', 'Ag2O']

/** 金属氧化物 + 氧气化合的产物表 */
export const METAL_O2_PRODUCTS = {
  Mg: 'MgO', Al: 'Al2O3', Fe: 'Fe3O4', Cu: 'CuO',
  Na: 'Na2O', K: 'K2O', Ca: 'CaO', Zn: 'ZnO', Ba: 'BaO'
}

/** 非金属单质 + 氧气化合的产物表 */
export const NONMETAL_O2_PRODUCTS = {
  C: 'CO2', S: 'SO2', P: 'P2O5', Si: 'SiO2', H2: 'H2O', N2: 'NO'
}

/**
 * 常见离子符号表（人教版九年级全覆盖，速查页展示用）
 * 纯展示数据：不参与方程式推导。f 为离子化学式（展示时转上下标样式文本），
 * chgText: 电荷文本（上标形式），notes: 备注（变价说明等，可空）。
 */
export const ION_TABLE = [
  { name: '氢离子', f: 'H', q: '+1' }, { name: '锂离子', f: 'Li', q: '+1' },
  { name: '钾离子', f: 'K', q: '+1' }, { name: '钠离子', f: 'Na', q: '+1' },
  { name: '银离子', f: 'Ag', q: '+1' }, { name: '铵根离子', f: 'NH4', q: '+1' },
  { name: '铍离子', f: 'Be', q: '+2' }, { name: '镁离子', f: 'Mg', q: '+2' },
  { name: '钙离子', f: 'Ca', q: '+2' }, { name: '钡离子', f: 'Ba', q: '+2' },
  { name: '锌离子', f: 'Zn', q: '+2' }, { name: '铜离子', f: 'Cu', q: '+2' },
  { name: '亚铁离子', f: 'Fe', q: '+2' }, { name: '汞离子', f: 'Hg', q: '+2' },
  { name: '铅离子', f: 'Pb', q: '+2' }, { name: '锡离子', f: 'Sn', q: '+2' },
  { name: '亚铜离子', f: 'Cu', q: '+1' },
  { name: '铝离子', f: 'Al', q: '+3' }, { name: '铁离子', f: 'Fe', q: '+3' },
  { name: '铬离子', f: 'Cr', q: '+3' },
  { name: '氟离子', f: 'F', q: '-1' }, { name: '氯离子', f: 'Cl', q: '-1' },
  { name: '溴离子', f: 'Br', q: '-1' }, { name: '碘离子', f: 'I', q: '-1' },
  { name: '氢氧根离子', f: 'OH', q: '-1' }, { name: '硝酸根离子', f: 'NO3', q: '-1' },
  { name: '碳酸氢根离子', f: 'HCO3', q: '-1' }, { name: '高锰酸根离子', f: 'MnO4', q: '-1' },
  { name: '氯酸根离子', f: 'ClO3', q: '-1' },
  { name: '氧离子', f: 'O', q: '-2' }, { name: '硫离子', f: 'S', q: '-2' },
  { name: '硫酸根离子', f: 'SO4', q: '-2' }, { name: '碳酸根离子', f: 'CO3', q: '-2' },
  { name: '亚硫酸根离子', f: 'SO3', q: '-2' }, { name: '锰酸根离子', f: 'MnO4', q: '-2' },
  { name: '磷酸根离子', f: 'PO4', q: '-3' }
]
