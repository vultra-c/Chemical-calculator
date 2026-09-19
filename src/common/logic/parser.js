/**
 * 化学计算器 - 化学式解析器
 * 支持：标准化学式（含括号嵌套）、中文名称查询
 * 输出：元素计数、渲染分段（下标用）
 */
import { ATOMIC_MASSES } from './elements.js'

/**
 * 解析结果缓存：同一化学式会被 classify/saltIons/baseIons/molarMass 等
 * 多次重复解析（一次 solveReaction 链路同式可达 3-5 次），解析是正则+栈扫描，
 * 在手表低功耗 CPU 上是主要耗时点。缓存后重复调用退化为 Map 查表。
 * 结果对象只读共享（全库无 counts/segs 原地修改），超出上限整表清空即可。
 */
const PARSE_CACHE = new Map()
const PARSE_CACHE_MAX = 512

/**
 * 大小写互换兜底（V26.9.56）：kmno4 / KMNO4 / KMno4 / HCL / NACL / cuso4 等
 * 大小写混乱输入，按 118 元素表重排出规范书写（KMnO4 / NaCl / CuSO4）。
 * 解析为带记忆化的最优评分选择：
 *   - 常用元素（初高中范围）得分高，稀有元素（U/Ac/Lu…）得分低 → cuso4 取 CuSO4 而非 C+U+SO4
 *   - 双字母元素小加分 → naco3 取 NaCO3 而非 NaCo3
 *   - 与原文大小写完全一致的写法额外加分 → 混合输入优先保留用户已写对的部分
 * 仅在严格解析失败时启用；Co / CO2 这类本身合法的输入不受影响。
 * @returns {string} 规范化后的化学式；无法归一化返回空串
 */
const RECASE_TIER1 = ' H C N O S P K Na Ca Mg Al Fe Cu Zn Cl Ba Ag Mn Pb Sn Li '
const RECASE_TIER2 = ' Br F Si Sr Cs Rb Be Au '
const _recaseMemo = new Map()

function recaseSymbolScore(sym) {
  let s = 0
  if (RECASE_TIER1.indexOf(' ' + sym + ' ') !== -1) s += 3
  else if (RECASE_TIER2.indexOf(' ' + sym + ' ') !== -1) s += 2
  else s += 1
  if (sym.length === 2) s += 3
  return s
}

/** 带记忆化的最优评分比较：高分胜；平分保留先写入者（双字母候选先试） */
function upsertBest(s, i, score, out) {
  const key = i + '|' + s.length
  const cur = _recaseMemo.get(key)
  if (!cur || score > cur.score) {
    _recaseMemo.set(key, { score, out })
  }
}

/** 返回从位置 i 开始能完成归一化的最高分写法，失败返回 null */
function recaseBest(s, i) {
  const key = i + '|' + s.length
  const hit = _recaseMemo.get(key)
  if (hit !== undefined) return hit
  if (i >= s.length) return { score: 0, out: '' }
  const c = s[i]
  const isLetter = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
  if (isLetter) {
    // 候选 1：双字母元素（大写 + 小写），先试 → 平分时优先
    if (i + 1 < s.length && /[A-Za-z]/.test(s[i + 1])) {
      const two = c.toUpperCase() + s[i + 1].toLowerCase()
      if (two in ATOMIC_MASSES) {
        const rest = recaseBest(s, i + 2)
        if (rest) upsertBest(s, i, recaseSymbolScore(two) + rest.score, two + rest.out)
      }
    }
    // 候选 2：单字母元素
    const one = c.toUpperCase()
    if (one in ATOMIC_MASSES && one.length === 1) {
      const rest = recaseBest(s, i + 1)
      if (rest) upsertBest(s, i, recaseSymbolScore(one) + rest.score, one + rest.out)
    }
  } else if (c >= '0' && c <= '9') {
    let j = i
    while (j < s.length && s[j] >= '0' && s[j] <= '9') j++
    const rest = recaseBest(s, j)
    if (rest) _recaseMemo.set(key, { score: rest.score, out: s.slice(i, j) + rest.out })
  } else if (c === '(' || c === ')' || c === '[' || c === ']') {
    const rest = recaseBest(s, i + 1)
    if (rest) _recaseMemo.set(key, { score: rest.score, out: c + rest.out })
  } else if (c === '·' || c === '.') {
    // 结晶水点 + 紧随系数一并保留（cuso4·5h2o）
    let j = i + 1
    while (j < s.length && s[j] >= '0' && s[j] <= '9') j++
    const rest = recaseBest(s, j)
    if (rest) _recaseMemo.set(key, { score: rest.score, out: s.slice(i, j) + rest.out })
  }
  return _recaseMemo.get(key) || null
}

function recaseFormula(s) {
  _recaseMemo.clear()
  const best = recaseBest(s, 0)
  return best ? best.out : ''
}

/** 解析结果是否含「单字母且非初高中常用」元素（U/I/W/V/Y…，常为大小写误切的产物） */
function hasRareSingle(parsed) {
  for (const k in parsed.counts) {
    if (k.length === 1 &&
        RECASE_TIER1.indexOf(' ' + k + ' ') === -1 &&
        RECASE_TIER2.indexOf(' ' + k + ' ') === -1) return true
  }
  return false
}

/**
 * 解析化学式
 * @param {string} f 化学式，如 Cu2(OH)2CO3 / Fe3O4 / H2O / kmno4
 * @returns {{ok:boolean, error?:string, counts?:Object, segs?:Array, canon?:string}}
 *   counts: { 元素符号: 个数 }
 *   segs:   渲染分段 [{t:'el'|'ch', s:'Cu'}] / [{t:'num', s:'2'}]
 *   canon:  规范化书写（大小写互换后）/ 原样
 */
export function parseFormula(f) {
  const s = String(f || '').trim()
  if (!s) return { ok: false, error: '化学式为空' }
  const hit = PARSE_CACHE.get(s)
  if (hit) return hit
  let result = parseFormulaImpl(s)
  // 大小写互换：严格失败必试；严格成功但含稀有单字母元素（如 cuso4 里的 U、
  // sio2 里的 I）也试 —— 重排结果不含稀有元素且能解析时才采纳，
  // 保证 Co / CO2 / UO2 / WO3 / I2 这类本就合法的输入不被误改
  const needsRecase = !result.ok || hasRareSingle(result)
  if (needsRecase && /[A-Za-z]/.test(s)) {
    const recased = recaseFormula(s)
    if (recased && recased !== s) {
      const r2 = parseFormulaImpl(recased)
      if (r2.ok && (result.ok ? !hasRareSingle(r2) : true)) result = r2
    }
  }
  if (result.ok) {
    let canon = ''
    for (const sg of result.segs) canon += sg.s
    result.canon = canon
  }
  if (PARSE_CACHE.size >= PARSE_CACHE_MAX) PARSE_CACHE.clear()
  PARSE_CACHE.set(s, result)
  return result
}

function parseFormulaImpl(s) {

  const counts = {}
  const segs = []
  // 栈：每层记录 {counts, startSegIndex}
  const stack = [{ counts: {}, segs: [] }]
  let i = 0
  const n = s.length

  function commitUnit(unitCounts, unitSegs, mult) {
    const top = stack[stack.length - 1]
    for (const k in unitCounts) {
      top.counts[k] = (top.counts[k] || 0) + unitCounts[k] * mult
    }
    if (mult === 1) {
      for (const sg of unitSegs) top.segs.push(sg)
    } else {
      top.segs.push({ t: 'ch', s: '(' })
      for (const sg of unitSegs) top.segs.push(sg)
      top.segs.push({ t: 'ch', s: ')' })
      top.segs.push({ t: 'num', s: String(mult) })
    }
  }

  while (i < n) {
    const c = s[i]
    if (c >= 'A' && c <= 'Z') {
      // 元素符号：大写开头 + 可选小写
      let sym = c
      i++
      if (i < n && s[i] >= 'a' && s[i] <= 'z') {
        sym += s[i]
        i++
      }
      if (!(sym in ATOMIC_MASSES)) {
        return { ok: false, error: '未知元素符号：' + sym + '（' + s + '）' }
      }
      // 数字
      let numStr = ''
      while (i < n && s[i] >= '0' && s[i] <= '9') {
        numStr += s[i]
        i++
      }
      const cnt = numStr ? parseInt(numStr) : 1
      const top = stack[stack.length - 1]
      top.counts[sym] = (top.counts[sym] || 0) + cnt
      top.segs.push({ t: 'el', s: sym })
      if (cnt > 1) top.segs.push({ t: 'num', s: numStr })
    } else if (c === '(' || c === '[') {
      stack.push({ counts: {}, segs: [] })
      stack[stack.length - 1]._openCh = '('
      i++
    } else if (c === ')' || c === ']') {
      if (stack.length <= 1) {
        return { ok: false, error: '括号不匹配（' + s + '）' }
      }
      const done = stack.pop()
      let numStr = ''
      while (i + 1 < n && s[i + 1] >= '0' && s[i + 1] <= '9') {
        numStr += s[i + 1]
        i++
        void numStr.length
      }
      // 注意上面循环从 i+1 开始，需要同步 i
      const mult = numStr ? parseInt(numStr) : 1
      commitUnit(done.counts, done.segs, mult)
      i++
    } else if (c === '·' || c === '.') {
      // 结晶水：·[系数] 后的内容按系数倍并入（CuSO4·5H2O / KAl(SO4)2·12H2O）。
      // 点只允许一层水合单元：若已存在水合帧则先结算（防止歧义嵌套）。
      if (stack[stack.length - 1]._dotMult != null) {
        const done = stack.pop()
        commitHydrate(done, done._dotMult)
      }
      i++
      let multStr = ''
      while (i < n && s[i] >= '0' && s[i] <= '9') { multStr += s[i]; i++ }
      stack.push({ counts: {}, segs: [], _dotMult: multStr ? parseInt(multStr) : 1 })
    } else if (c === '+' || c === '=' || c === ' ') {
      return { ok: false, error: '化学式内不能含有 ' + c + '，请分开输入' }
    } else {
      return { ok: false, error: '非法字符：' + c + '（' + s + '）' }
    }
  }

  /** 结晶水单元并入上层：segs 用 ·N 前缀而非括号 */
  function commitHydrate(unit, mult) {
    const top = stack[stack.length - 1]
    for (const k in unit.counts) {
      top.counts[k] = (top.counts[k] || 0) + unit.counts[k] * mult
    }
    top.segs.push({ t: 'ch', s: '·' })
    if (mult > 1) top.segs.push({ t: 'num', s: String(mult) })
    for (const sg of unit.segs) top.segs.push(sg)
  }

  if (stack.length > 1) {
    // 收尾：仅剩结晶水帧则逐个并入；含未闭合括号帧则报错
    let bad = false
    while (stack.length > 1) {
      const done = stack.pop()
      if (done._dotMult != null && !bad) {
        commitHydrate(done, done._dotMult)
      } else {
        bad = true
      }
    }
    if (bad) return { ok: false, error: '括号不匹配（' + s + '）' }
  }

  const final = stack[0]
  if (Object.keys(final.counts).length === 0) {
    return { ok: false, error: '化学式为空' }
  }
  return { ok: true, counts: final.counts, segs: final.segs }
}

/** 相对分子质量 */
export function molarMass(counts) {
  let m = 0
  for (const k in counts) m += ATOMIC_MASSES[k] * counts[k]
  return m
}

/** 数值格式化：最多保留 3 位小数，去尾零 */
export function fmtNum(v) {
  if (!isFinite(v)) return '--'
  let r = Math.round(v * 1000) / 1000
  let str = String(r)
  return str
}

/**
 * 把输入串拆成单个物质 token：
 * 支持全角加号、中文顿号等分隔；返回 token 数组
 */
export function splitInputTokens(input) {
  return String(input || '')
    .replace(/＋/g, '+')
    .split('+')
    .map(t => t.trim())
    .filter(t => t.length > 0)
}

/**
 * 解析一个 token：先按化学式，失败后查中文名称表
 * @returns {{ok:boolean, formula?:string, error?:string}}
 */
export function resolveToken(token, nameMap) {
  const t = token.trim()
  // 化学式形态：字母数字括号（含结晶水点 ·）
  if (/^[A-Za-z0-9()\[\]·]+$/.test(t)) {
    const r = parseFormula(t.replace(/[\[\]]/g, m => (m === '[' ? '(' : ')')))
    if (r.ok) return { ok: true, formula: r.canon || normalizeFormula(t, r) }
    return r
  }
  // 中文名称
  if (nameMap && nameMap[t]) {
    return { ok: true, formula: nameMap[t], byName: true }
  }
  return { ok: false, error: '无法识别 "' + t + '"：不是合法化学式，也不在名称库中' }
}

/**
 * 规范化化学式书写：Co 与 CO 区分依赖用户大小写。
 * 这里仅做括号统一（[]→()），其余保持原样。
 */
function normalizeFormula(raw, parsed) {
  void parsed
  return raw.replace(/[\[\]]/g, m => (m === '[' ? '(' : ')'))
}
