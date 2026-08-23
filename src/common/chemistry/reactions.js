/**
 * 反应推导引擎（纯离线）
 * 输入：一种或多种反应物（化学式或中文名称）
 * 输出：完整配平方程式 + 反应条件 + 反应类型；无法反应时给出明确原因
 *
 * 推导策略：
 *  1) 精确反应库匹配（经典反应，带条件标注）
 *  2) 通用规则推理（燃烧/还原/置换/中和/复分解/化合等），产物由化合价交叉法自动合成
 *  3) 全部候选统一送入精确配平算法验证，失败则尝试下一候选
 */
import { parseSubstance, massFromCounts } from './parser.js'
import { balance } from './balance.js'
import { resolveZhName } from './substances.js'
import { getElement } from './elements.js'

/* ==================== 基础数据表 ==================== */

const POLY_ANIONS = {
  NO3: 1, NO2: 1, SO4: 2, SO3: 2, CO3: 2, HCO3: 1, OH: 1,
  ClO3: 1, MnO4: 1, PO4: 3, HSO4: 1, SiO3: 2
}
const BIN_ANIONS = { Cl: 1, Br: 1, I: 1, F: 1, S: 2 }

const CATION_VAL = {
  K: 1, Na: 1, Ag: 1, H: 1, NH4: 1,
  Mg: 2, Ca: 2, Ba: 2, Zn: 2, Cu: 2, Hg: 2, Pb: 2, Sn: 2, Fe: 3, Al: 3
}
// 盐中 Fe 默认 +3，置换/金属+酸 场景单独按 +2 处理

const SERIES = ['K', 'Ca', 'Na', 'Mg', 'Al', 'Zn', 'Fe', 'Sn', 'Pb', 'Cu', 'Hg', 'Ag']
const BEFORE_H = ['K', 'Ca', 'Na', 'Mg', 'Al', 'Zn', 'Fe', 'Sn', 'Pb']

// 难溶（沉淀）物质
const INSOLUBLE = new Set([
  'AgCl', 'BaSO4', 'CaCO3', 'BaCO3', 'Ag2CO3', 'ZnCO3', 'CuCO3',
  'Cu(OH)2', 'Fe(OH)3', 'Fe(OH)2', 'Mg(OH)2', 'Al(OH)3', 'Zn(OH)2',
  'PbSO4'
])
const GASES_OUT = new Set(['CO2', 'H2', 'NH3', 'H2S'])

// 分解反应库（单反应物）
const DECOMP = {
  CaCO3: { cond: '高温', tag: '分解反应', p: ['CaO', 'CO2'] },
  H2CO3: { cond: '', tag: '分解反应', p: ['H2O', 'CO2'], note: '碳酸不稳定，易分解' },
  H2O2: { cond: 'MnO₂ 催化', tag: '分解反应', p: ['H2O', 'O2'] },
  H2O: { cond: '通电', tag: '分解反应', p: ['H2', 'O2'] },
  KClO3: { cond: 'MnO₂ 催化、加热', tag: '分解反应', p: ['KCl', 'O2'] },
  KMnO4: { cond: '加热', tag: '分解反应', p: ['K2MnO4', 'MnO2', 'O2'] },
  'Cu2(OH)2CO3': { cond: '加热', tag: '分解反应', p: ['CuO', 'H2O', 'CO2'] },
  NH4HCO3: { cond: '加热', tag: '分解反应', p: ['NH3', 'H2O', 'CO2'] },
  NaHCO3: { cond: '加热', tag: '分解反应', p: ['Na2CO3', 'H2O', 'CO2'] },
  'Ca(HCO3)2': { cond: '加热', tag: '分解反应', p: ['CaCO3', 'H2O', 'CO2'] },
  Ag2O: { cond: '加热', tag: '分解反应', p: ['Ag', 'O2'] },
  'CuSO4·5H2O': { cond: '加热', tag: '分解反应', p: ['CuSO4', 'H2O'] }
}

// 精确双反应物反应库（键：化学式排序后用 + 连接）
const DB2 = {}
function db(keyA, keyB, products, cond, tag, note) {
  const k = [keyA, keyB].sort().join('+')
  if (!DB2[k]) DB2[k] = []
  DB2[k].push({ p: products, cond: cond || '', tag, note })
}
db('C', 'CO2', ['CO'], '高温', '化合反应')
db('N2', 'O2', ['NO'], '放电', '化合反应')

// 可燃物燃烧
const COMBUST_ELEMENT = {
  C: ['CO2', '点燃'],
  S: ['SO2', '点燃'],
  P: ['P2O5', '点燃'],
  H2: ['H2O', '点燃'],
  Fe: ['Fe3O4', '点燃'],
  Mg: ['MgO', '点燃'],
  Al: ['Al2O3', '点燃'],
  Cu: ['CuO', '加热'],
  Zn: ['ZnO', '点燃'],
  Ca: ['CaO', '点燃']
}
const COMBUST_COMPOUND = {
  CO: { p: ['CO2'], cond: '点燃' },
  CH4: { p: ['CO2', 'H2O'], cond: '点燃' },
  C2H5OH: { p: ['CO2', 'H2O'], cond: '点燃' },
  CH3COOH: { p: ['CO2', 'H2O'], cond: '点燃' }
}

// 还原剂：还原剂 → 其氧化产物
const REDUCERS = { H2: 'H2O', C: 'CO2', CO: 'CO2', Al: 'Al2O3' }
const REDUCIBLE = {
  CuO: ['Cu', '加热'],
  Fe2O3: ['Fe', '高温'],
  Fe3O4: ['Fe', '高温'],
  FeO: ['Fe', '高温'],
  ZnO: ['Zn', '高温'],
  WO3: ['W', '高温'],
  SnO2: ['Sn', '高温']
}

// 溶于水的碱性氧化物 / 酸性氧化物水化
const BASIC_OXIDE_HYD = { CaO: 'Ca(OH)2', Na2O: 'NaOH', K2O: 'KOH', BaO: 'Ba(OH)2' }
const SOUR_GAS_ACID = { CO2: 'H2CO3', SO2: 'H2SO3', SO3: 'H2SO4' }

// 与酸反应的金属氧化物白名单（Fe3O4 除外，生成两种盐不处理）
const ACID_OXIDE_VAL = {
  CuO: ['Cu', 2], MgO: ['Mg', 2], CaO: ['Ca', 2], BaO: ['Ba', 2],
  Na2O: ['Na', 1], K2O: ['K', 1], Al2O3: ['Al', 3], ZnO: ['Zn', 2],
  Fe2O3: ['Fe', 3], FeO: ['Fe', 2], Ag2O: ['Ag', 1]
}

/* ==================== 工具函数 ==================== */

function gcdInt(a, b) {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) {
    const t = a % b
    a = b
    b = t
  }
  return a || 1
}

/** 化合价交叉法写盐的化学式 */
const POLY_SET = new Set(['NO3', 'NO2', 'SO4', 'SO3', 'CO3', 'HCO3', 'OH', 'ClO3', 'MnO4', 'PO4', 'HSO4', 'SiO3'])
function composeSalt(catSym, catVal, anSym, anVal) {
  const g = gcdInt(catVal, anVal)
  const nCat = anVal / g
  const nAn = catVal / g
  let cs = catSym
  if (nCat > 1 && (catSym === 'NH4' || POLY_SET.has(catSym))) cs = '(' + catSym + ')' + nCat
  else if (nCat > 1) cs = catSym + nCat
  let asStr = anSym
  if (nAn > 1 && POLY_SET.has(anSym)) asStr = '(' + anSym + ')' + nAn
  else if (nAn > 1) asStr = anSym + nAn
  return cs + asStr
}

/**
 * 离子拆分：识别阳离子/阴离子。
 * 返回 {kind:'acid'|'base'|'salt'|'other'|'element', cation:{sym,count,val}, anion:{sym,count,val}}
 */
export function extractIons(norm) {
  if (norm.indexOf('·') >= 0) {
    // 结晶水合物；氨水视作碱
    if (norm === 'NH3·H2O') {
      return { kind: 'base', cation: { sym: 'NH4', count: 1, val: 1 }, anion: { sym: 'OH', count: 1, val: 1 } }
    }
    return { kind: 'other' }
  }

  // 阳离子头部
  let cation = null
  let rest = norm
  const mNH4a = /^\(NH4\)(\d*)/.exec(norm)
  const mNH4b = /^NH4(\d*)/.exec(norm)
  const mEl = /^([A-Z][a-z]?)(\d*)/.exec(norm)
  if (mNH4a) {
    cation = { sym: 'NH4', count: parseInt(mNH4a[1] || '1', 10), val: 1 }
    rest = norm.slice(mNH4a[0].length)
  } else if (mNH4b) {
    cation = { sym: 'NH4', count: parseInt(mNH4b[1] || '1', 10), val: 1 }
    rest = norm.slice(mNH4b[0].length)
  } else if (mEl) {
    const sym = mEl[1]
    cation = { sym, count: parseInt(mEl[2] || '1', 10), val: CATION_VAL[sym] != null ? CATION_VAL[sym] : null }
    rest = norm.slice(mEl[0].length)
  }
  if (!cation) return { kind: 'other' }

  // 阴离子尾部
  let anion = null
  const keys = Object.keys(POLY_ANIONS).concat(Object.keys(BIN_ANIONS))
  keys.sort(function (a, b) { return b.length - a.length })
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    const re1 = new RegExp('^\\(' + k + '\\)(\\d*)$')
    const m1 = re1.exec(rest)
    if (m1) {
      anion = { sym: k, count: parseInt(m1[1] || '1', 10) }
      break
    }
    const re2 = new RegExp('^' + k + '(\\d*)$')
    const m2 = re2.exec(rest)
    if (m2) {
      anion = { sym: k, count: parseInt(m2[1] || '1', 10) }
      break
    }
  }
  if (!anion) return { kind: 'other' }
  const aVal = POLY_ANIONS[anion.sym] != null ? POLY_ANIONS[anion.sym] : BIN_ANIONS[anion.sym]
  anion.val = aVal

  // 阳离子价态按电荷守恒反推（如 FeSO4 中 Fe 为 +2，Fe2(SO4)3 中为 +3）
  const need = (anion.count * anion.val) / cation.count
  if (!Number.isInteger(need) || need < 1 || need > 4) {
    return { kind: 'other' }
  }
  cation.val = need

  if (cation.sym === 'H') return { kind: 'acid', cation, anion }
  if (anion.sym === 'OH') return { kind: 'base', cation, anion }
  return { kind: 'salt', cation, anion }
}

/** 形态分类补充：单质 / 金属氧化物 / 酸性氧化物等 */
export function classifyShape(norm, counts) {
  const keys = Object.keys(counts)
  if (keys.length === 1) return { kind: 'element', sym: keys[0] }
  if (keys.length === 2 && counts.O) {
    const other = keys[0] === 'O' ? keys[1] : keys[0]
    if (getElement(other)) {
      const oCnt = counts.O
      const mCnt = counts[other]
      const val = (oCnt * 2) / mCnt
      return { kind: 'oxide', metal: other, metalCount: mCnt, valence: Number.isInteger(val) ? val : null }
    }
  }
  return { kind: 'molecule' }
}

function isInsoluble(norm) {
  return INSOLUBLE.has(norm)
}

/* ==================== 候选生成规则 ==================== */

function tryDecompose(one) {
  const hit = DECOMP[one.norm]
  if (!hit) return null
  return { p: hit.p, cond: hit.cond, tag: hit.tag, note: hit.note }
}

function tryDB2(list) {
  const key = list.map((x) => x.norm).sort().join('+')
  const hits = DB2[key]
  if (!hits) return []
  return hits.map((h) => ({ p: h.p, cond: h.cond, tag: h.tag, note: h.note }))
}

function tryCombustion(a, b) {
  const o2 = a.norm === 'O2' ? a : b.norm === 'O2' ? b : null
  if (!o2) return null
  const x = o2 === a ? b : a
  const shape = classifyShape(x.norm, x.counts)
  if (shape.kind === 'element') {
    const hit = COMBUST_ELEMENT[x.norm]
    if (!hit) return null
    const note = x.norm === 'C' ? '注：若氧气不足，碳不完全燃烧生成 CO' : undefined
    return { p: [hit[0]], cond: hit[1], tag: '氧化还原', note }
  }
  const hit = COMBUST_COMPOUND[x.norm]
  if (hit) return { p: hit.p, cond: hit.cond, tag: '氧化还原' }
  return null
}

function tryReduction(a, b) {
  const redA = REDUCERS[a.norm]
  const redB = REDUCERS[b.norm]
  const reducerNorm = redA ? a.norm : redB ? b.norm : null
  if (!reducerNorm) return null
  const oxide = redA ? b : a
  const info = REDUCIBLE[oxide.norm]
  if (!info) return null
  const byproduct = REDUCERS[reducerNorm]
  const isDisplace = reducerNorm === 'H2' || reducerNorm === 'C'
  return {
    p: [info[0], byproduct],
    cond: info[1],
    tag: isDisplace ? '置换反应' : '氧化还原',
    note: reducerNorm === 'CO' ? 'CO 有毒，实验需尾气处理' : undefined
  }
}

function tryWaterPairs(a, b) {
  // 酸性氧化物 + 水 → 含氧酸
  if ((SOUR_GAS_ACID[a.norm] && b.norm === 'H2O') || (SOUR_GAS_ACID[b.norm] && a.norm === 'H2O')) {
    const gasNorm = SOUR_GAS_ACID[a.norm] ? a.norm : b.norm
    return { p: [SOUR_GAS_ACID[gasNorm]], cond: '', tag: '化合反应' }
  }
  // 碱性氧化物 + 水 → 碱
  if ((BASIC_OXIDE_HYD[a.norm] && b.norm === 'H2O') || (BASIC_OXIDE_HYD[b.norm] && a.norm === 'H2O')) {
    const oxNorm = BASIC_OXIDE_HYD[a.norm] ? a.norm : b.norm
    return { p: [BASIC_OXIDE_HYD[oxNorm]], cond: '', tag: '化合反应' }
  }
  return null
}

function tryMetalAcid(metal, acid) {
  const m = extractIons(acid.norm)
  if (m.kind !== 'acid' || (m.anion.sym !== 'Cl' && m.anion.sym !== 'SO4')) return null
  if (metal.norm === 'H2') return null
  const shape = classifyShape(metal.norm, metal.counts)
  if (shape.kind !== 'element') return null

  const posInBefore = BEFORE_H.indexOf(metal.norm)
  if (posInBefore < 0) {
    const posInSeries = SERIES.indexOf(metal.norm)
    if (posInSeries >= 0) {
      return { blocked: metal.norm + ' 的金属活动性弱于氢，不能与稀酸发生置换反应' }
    }
    return null
  }
  if (metal.norm === 'K' || metal.norm === 'Ca' || metal.norm === 'Na') {
    return { blocked: 'K / Ca / Na 活泼性过强，与酸反应极为剧烈，不适合用于此计算场景' }
  }
  const val = metal.norm === 'Fe' ? 2 : CATION_VAL[metal.norm]
  const salt = composeSalt(metal.norm, val, m.anion.sym, m.anion.val)
  return { p: [salt, 'H2'], cond: '', tag: '置换反应' }
}

function tryMetalSalt(metal, salt) {
  const s = extractIons(salt.norm)
  if (s.kind !== 'salt') return null
  if (['Cl', 'SO4', 'NO3'].indexOf(s.anion.sym) < 0) return null
  if (isInsoluble(salt.norm)) {
    return { blocked: salt.norm + ' 难溶于水，无法在溶液中发生金属置换' }
  }
  const shape = classifyShape(metal.norm, metal.counts)
  if (shape.kind !== 'element') return null
  const posM = SERIES.indexOf(metal.norm)
  const posC = SERIES.indexOf(s.cation.sym)
  if (posM < 0 || posC < 0) return null
  if (metal.norm === 'K' || metal.norm === 'Ca' || metal.norm === 'Na') {
    return { blocked: 'K / Ca / Na 放入盐溶液时会先与水反应，不能直接置换出金属' }
  }
  if (posM >= posC) {
    return { blocked: metal.norm + ' 的金属活动性不弱于 ' + (getElement(s.cation.sym) ? getElement(s.cation.sym).name : s.cation.sym) + '，不能从其盐溶液中置换出金属' }
  }
  const valM = metal.norm === 'Fe' ? 2 : CATION_VAL[metal.norm]
  const newSalt = composeSalt(metal.norm, valM, s.anion.sym, s.anion.val)
  return { p: [newSalt, s.cation.sym], cond: '', tag: '置换反应' }
}

function tryAcidBase(acid, base) {
  const a = extractIons(acid.norm)
  const b = extractIons(base.norm)
  if (a.kind !== 'acid' || b.kind !== 'base') return null
  const salt = composeSalt(b.cation.sym, b.cation.val, a.anion.sym, a.anion.val)
  return { p: [salt, 'H2O'], cond: '', tag: '中和反应', note: '属于复分解反应（中和反应）' }
}

function tryAcidMetalOxide(acid, oxide) {
  const a = extractIons(acid.norm)
  if (a.kind !== 'acid') return null
  const info = ACID_OXIDE_VAL[oxide.norm]
  if (!info) return null
  const salt = composeSalt(info[0], info[1], a.anion.sym, a.anion.val)
  return { p: [salt, 'H2O'], cond: '', tag: '复分解反应' }
}

function tryAcidCarbonate(acid, carb) {
  const a = extractIons(acid.norm)
  const c = extractIons(carb.norm)
  if (a.kind !== 'acid' || c.kind !== 'salt') return null
  if (c.anion.sym !== 'CO3' && c.anion.sym !== 'HCO3') return null
  const salt = composeSalt(c.cation.sym, c.cation.val, a.anion.sym, a.anion.val)
  let note
  if (acid.norm === 'H2SO4' && (carb.norm === 'CaCO3' || carb.norm === 'BaCO3')) {
    note = '注：生成的硫酸盐微溶于水，会覆盖在固体表面使反应逐渐停止'
  }
  return { p: [salt, 'H2O', 'CO2'], cond: '', tag: '复分解反应', note }
}

function tryBaseSourGas(base, gas) {
  const b = extractIons(base.norm)
  if (b.kind !== 'base') return null
  const target = SOUR_GAS_ACID[gas.norm]
  if (!target) return null
  const anMap = { CO2: 'CO3', SO2: 'SO3', SO3: 'SO4' }
  const salt = composeSalt(b.cation.sym, b.cation.val, anMap[gas.norm], gas.norm === 'SO3' ? 2 : 2)
  let note
  if (base.norm === 'NaOH' && gas.norm === 'CO2') {
    note = '注：CO₂ 过量时产物为 NaHCO₃'
  }
  return { p: [salt, 'H2O'], cond: '', tag: '其他反应', note }
}

/** 通用复分解：酸+盐 / 碱+盐 / 盐+盐 */
function tryMetathesis(x, y) {
  const ix = extractIons(x.norm)
  const iy = extractIons(y.norm)
  if (!ix || !iy) return null
  const okKind = function (k) { return k === 'acid' || k === 'base' || k === 'salt' }
  if (!okKind(ix.kind) || !okKind(iy.kind)) return null
  // 必须是不同类别间的组合（同类不反应）
  if (ix.kind === iy.kind && ix.kind !== 'salt') return null
  if (ix.kind === 'acid' && iy.kind === 'base') return null
  if (ix.kind === 'base' && iy.kind === 'acid') return null
  // 反应物可溶性要求（碱+盐 / 盐+盐 时双方都要可溶）
  const bothSolidSensitive = ix.kind === 'salt' || iy.kind === 'salt'
  if (bothSolidSensitive) {
    if (ix.kind === 'salt' && isInsoluble(x.norm)) return { blocked: x.norm + ' 难溶于水，复分解反应需要在溶液中进行' }
    if (iy.kind === 'salt' && isInsoluble(y.norm)) return { blocked: y.norm + ' 难溶于水，复分解反应需要在溶液中进行' }
  }
  // 交换成分：x阳+y阴、y阳+x阴
  const p1 = composeSalt(ix.cation.sym, ix.cation.val, iy.anion.sym, iy.anion.val)
  const p2 = composeSalt(iy.cation.sym, iy.cation.val, ix.anion.sym, ix.anion.val)
  const feasible =
    INSOLUBLE.has(p1) || INSOLUBLE.has(p2) ||
    GASES_OUT.has(p1) || GASES_OUT.has(p2) ||
    p1 === 'H2O' || p2 === 'H2O'
  if (!feasible) return null
  return { p: [p1, p2], cond: '', tag: '复分解反应' }
}

/* ==================== 主入口 ==================== */

/** 解析并解析用户输入的一种反应物（支持中文） */
function resolveToken(raw) {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return { error: '存在空输入' }
  let formula = resolveZhName(trimmed)
  if (!formula) formula = trimmed
  const parsed = parseSubstance(formula)
  if (!parsed.ok) {
    const reason = parsed.error === '输入为空'
      ? '不是合法的化学式，也不在物质名称表中'
      : parsed.error
    return { error: '「' + trimmed + '」' + reason }
  }
  return { norm: parsed.norm, display: parsed.display, counts: Object.assign({}, parsed.counts), mass: parsed.mass, raw: trimmed }
}

/**
 * 分析一组反应物（已拆分好的字符串数组），返回结果对象。
 */
export function analyzeList(tokensRaw) {
  if (!tokensRaw || !tokensRaw.length) {
    return { ok: false, code: 'EMPTY_INPUT', message: '请先输入反应物' }
  }

  // 解析每个反应物
  const bad = []
  const resolved = []
  tokensRaw.forEach((t) => {
    const r = resolveToken(t)
    if (r.error) bad.push(r.error)
    else resolved.push(r)
  })
  if (bad.length) {
    return { ok: false, code: 'BAD_SUBSTANCE', message: '无法识别的物质：' + bad.join('；'), detail: bad }
  }

  // 合并重复物质
  const merged = []
  resolved.forEach((r) => {
    const found = merged.find(function (m) { return m.norm === r.norm })
    if (found) {
      Object.keys(r.counts).forEach(function (k) {
        found.counts[k] = (found.counts[k] || 0) + r.counts[k]
      })
      found.mass = massFromCounts(found.counts)
    } else {
      merged.push(r)
    }
  })

  // 收集候选
  const candidates = []
  if (merged.length === 1) {
    const c = tryDecompose(merged[0])
    if (c) candidates.push(c)
  } else if (merged.length === 2) {
    candidates.push.apply(candidates, tryDB2(merged))
    const seq = [
      function () { return tryCombustion(merged[0], merged[1]) },
      function () { return tryReduction(merged[0], merged[1]) },
      function () { return tryWaterPairs(merged[0], merged[1]) },
      function () { return tryMetalAcid(merged[0], merged[1]) || tryMetalAcid(merged[1], merged[0]) },
      function () { return tryMetalSalt(merged[0], merged[1]) || tryMetalSalt(merged[1], merged[0]) },
      function () { return tryAcidBase(merged[0], merged[1]) || tryAcidBase(merged[1], merged[0]) },
      function () { return tryAcidMetalOxide(merged[0], merged[1]) || tryAcidMetalOxide(merged[1], merged[0]) },
      function () { return tryAcidCarbonate(merged[0], merged[1]) || tryAcidCarbonate(merged[1], merged[0]) },
      function () { return tryBaseSourGas(merged[0], merged[1]) || tryBaseSourGas(merged[1], merged[0]) },
      function () { return tryMetathesis(merged[0], merged[1]) || tryMetathesis(merged[1], merged[0]) }
    ]
    let blockedMsg = null
    for (let i = 0; i < seq.length; i++) {
      const r = seq[i]()
      if (!r) continue
      if (r.blocked) {
        blockedMsg = r.blocked
        continue
      }
      candidates.push(r)
    }
    // 若有明确“不能反应”的原因且没有其它候选，优先返回原因
    if (!candidates.length && blockedMsg) {
      return { ok: false, code: 'NO_REACTION', message: '这两种物质不能发生该反应：' + blockedMsg }
    }
  } else if (merged.length > 2) {
    return {
      ok: false,
      code: 'TOO_MANY',
      message: '暂不支持同时推导三种及以上物质的组合反应，请减少到一至两种'
    }
  }

  if (!candidates.length) {
    return {
      ok: false,
      code: 'NO_REACTION',
      message: '未找到这些物质之间可以发生的化学反应，请检查输入或更换反应物'
    }
  }

  // 依次尝试配平验证
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i]
    const productsParsed = []
    let allOk = true
    cand.p.forEach(function (f) {
      const pp = parseSubstance(f)
      if (!pp.ok) allOk = false
      else productsParsed.push(pp)
    })
    if (!allOk) continue
    const countsList = merged.map(function (m) { return m.counts }).concat(productsParsed.map(function (p) { return p.counts }))
    const bal = balance(countsList, merged.length)
    if (!bal.ok) continue

    const subs = []
    merged.forEach(function (m, idx) {
      subs.push({ coef: bal.coefs[idx], norm: m.norm, display: m.display, mass: m.mass, side: 'L' })
    })
    productsParsed.forEach(function (p, idx) {
      subs.push({ coef: bal.coefs[merged.length + idx], norm: p.norm, display: p.display, mass: p.mass, side: 'R' })
    })
    return {
      ok: true,
      cond: cand.cond || '',
      tag: cand.tag,
      note: cand.note,
      substances: subs,
      leftCount: merged.length
    }
  }

  return {
    ok: false,
    code: 'NO_REACTION',
    message: '这些物质虽然可能参与反应，但暂时无法给出配平的方程式，请调整输入'
  }
}

/** 直接分析一行输入（含加号分隔） */
export function analyze(line) {
  const parts = String(line || '')
    .replace(/＋/g, '+')
    .split('+')
    .map(function (x) { return x.trim() })
    .filter(function (x) { return x.length > 0 })
  return analyzeList(parts)
}

/** 计量计算：已知某一物质质量，求其余所有物质质量/摩尔数 */
export function calcStoich(result, refIndex, grams) {
  if (!result || !result.ok) return { ok: false, message: '请先完成方程式配平' }
  const g = Number(grams)
  if (!(g > 0) || !isFinite(g)) return { ok: false, message: '请输入有效的质量（克）' }
  const ref = result.substances[refIndex]
  if (!ref) return { ok: false, message: '选择的物质无效' }
  const nRef = g / ref.mass // 参考物的摩尔数（以相对分子质量近似摩尔质量）
  const rows = result.substances.map(function (s, idx) {
    const moles = s.coef * (nRef / ref.coef)
    const mass = (g * s.coef * s.mass) / (ref.coef * ref.mass)
    return {
      index: idx,
      norm: s.norm,
      display: s.display,
      coef: s.coef,
      side: s.side,
      moles: Math.round(moles * 10000) / 10000,
      grams: Math.round(mass * 10000) / 10000,
      isRef: idx === refIndex
    }
  })
  return { ok: true, rows }
}
