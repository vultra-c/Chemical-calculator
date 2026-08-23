/**
 * 化学式解析器（纯离线）
 * 支持：普通式 H2SO4、括号嵌套 Fe2(SO4)3 / Cu2(OH)2CO3、
 *       结晶水合物 CuSO4·5H2O、KAl(SO4)2·12H2O、NH3·H2O，
 *       以及全角括号、多余空白、常见中点符号的自动纠正。
 * 全小写输入（如 nahco3）会做智能大小写纠正。
 */
import { getElement } from './elements.js'

const DOT_CHARS = ['·', '・', '•', '∙', '*', '.', '．']

function normalizeInput(raw) {
  let s = String(raw == null ? '' : raw)
  s = s.replace(/\s+/g, '')
  s = s.replace(/（/g, '(').replace(/）/g, ')')
  s = s.replace(/【/g, '[').replace(/】/g, ']')
  s = s.replace(/[－–—―]/g, '-')
  DOT_CHARS.forEach((d, i) => {
    s = s.split(d).join('·')
  })
  // 连续多个点视为一个
  s = s.replace(/·{2,}/g, '·')
  // 去掉开头结尾的加减点号等非法字符
  s = s.replace(/^[^A-Za-z(\[·]+/, '').replace(/[^A-Za-z0-9)\]]+$|·$/g, '')
  return s
}

/** 元素权重：用于全小写输入的智能分段打分 */
const SYMBOL_WEIGHT = {
  H: 5, C: 5, N: 5, O: 5, S: 4, P: 4, K: 4, Cl: 4, F: 2, I: 1, Br: 2,
  Na: 4, Ca: 4, Mg: 4, Al: 4, Zn: 4, Fe: 5, Cu: 4, Ba: 3, Ag: 3,
  Mn: 3, Pb: 2, Sn: 1, Li: 2, Si: 2, He: 1, Ne: 1, Ar: 1, Hg: 2
}
const TWO_LETTER_BONUS = new Set(['Na', 'Ca', 'Mg', 'Al', 'Si', 'Zn', 'Fe', 'Cu', 'Br', 'Ba', 'Ag'])

function symScore(sym) {
  const base = SYMBOL_WEIGHT[sym] != null ? SYMBOL_WEIGHT[sym] : 0
  return base + (TWO_LETTER_BONUS.has(sym) ? 3 : 0)
}

/** 对一段纯字母串做所有合法元素切分，返回得分最高的切分 */
function segmentLetters(letters) {
  const results = []
  function walk(pos, acc, score) {
    if (pos >= letters.length) {
      results.push({ syms: acc.slice(), score })
      return
    }
    // 大写字母开头：大写+后续小写
    const up = letters[pos].toUpperCase()
    let two = null
    if (pos + 1 < letters.length && letters[pos + 1] === letters[pos + 1].toLowerCase()) {
      const cand = up + letters[pos + 1].toLowerCase()
      if (getElement(cand)) two = cand
    }
    const one = getElement(up) ? up : null
    const tries = []
    if (two) tries.push(two)
    if (one && one !== two) tries.push(one)
    tries.forEach((sym) => {
      acc.push(sym)
      walk(pos + sym.length, acc, score + symScore(sym))
      acc.pop()
    })
  }
  walk(0, [], 0)
  if (!results.length) return null
  results.sort((a, b) => b.score - a.score || a.syms.length - b.syms.length)
  return results[0].syms
}

/**
 * 解析单个化学式字符串。
 * 返回 { ok, norm, counts, mass, display } 或 { ok:false, error }
 */
export function parseSubstance(raw) {
  const s = normalizeInput(raw)
  if (!s) return { ok: false, error: '输入为空' }

  // 词法切分：字母段 / 数字段 / ( ) [ ] ·
  const tokens = []
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (/[A-Za-z]/.test(ch)) {
      let j = i
      while (j < s.length && /[A-Za-z]/.test(s[j])) j++
      tokens.push({ t: 'L', v: s.slice(i, j) })
      i = j
    } else if (/[0-9]/.test(ch)) {
      let j = i
      while (j < s.length && /[0-9]/.test(s[j])) j++
      tokens.push({ t: 'N', v: parseInt(s.slice(i, j), 10) })
      i = j
    } else if (ch === '(' || ch === '[') {
      tokens.push({ t: '(' })
      i++
    } else if (ch === ')' || ch === ']') {
      tokens.push({ t: ')' })
      i++
    } else if (ch === '·') {
      tokens.push({ t: 'DOT' })
      i++
    } else {
      return { ok: false, error: '含有无法识别的字符「' + ch + '」' }
    }
  }

  const counts = Object.create(null)
  let hasDotGroup = false

  /** 解析一段普通式（不含结晶水），返回该段贡献的元素计数；失败返回 null */
  function parseSegment(tkStart, tkEnd, mult) {
    const local = Object.create(null)
    const stack = [local]
    let idx = tkStart
    while (idx < tkEnd) {
      const tk = tokens[idx]
      if (tk.t === 'L') {
        const seg = segmentLetters(tk.v)
        if (!seg) {
          throw new Error('「' + tk.v + '」不是合法的元素组合')
        }
        for (const sym of seg) {
          stack[stack.length - 1][sym] = (stack[stack.length - 1][sym] || 0) + 1
        }
        idx++
        // 紧跟数字只修饰最后一个元素符号（如 SO4 中 4 属于 O）
        if (idx < tkEnd && tokens[idx].t === 'N') {
          const n = tokens[idx].v
          const lastSym = seg[seg.length - 1]
          stack[stack.length - 1][lastSym] += (n - 1)
          idx++
        }
      } else if (tk.t === '(') {
        const inner = Object.create(null)
        stack.push(inner)
        idx++
      } else if (tk.t === ')') {
        if (stack.length === 1) throw new Error('括号不匹配')
        const inner = stack.pop()
        idx++
        let n = 1
        if (idx < tkEnd && tokens[idx].t === 'N') {
          n = tokens[idx].v
          idx++
        }
        const top = stack[stack.length - 1]
        for (const k of Object.keys(inner)) {
          top[k] = (top[k] || 0) + inner[k] * n
        }
      } else {
        throw new Error('格式错误')
      }
    }
    if (stack.length !== 1) throw new Error('括号不匹配')
    for (const k of Object.keys(local)) {
      counts[k] = (counts[k] || 0) + local[k] * mult
    }
    return true
  }

  try {
    // 按 DOT 切成若干段
    let segStart = 0
    let cursor = 0
    let firstSeg = true
    while (cursor <= tokens.length) {
      if (cursor === tokens.length || tokens[cursor].t === 'DOT') {
        if (firstSeg) {
          parseSegment(segStart, cursor, 1)
          firstSeg = false
        } else {
          // 点后段可带系数（如 ·5H2O），缺省为 1
          let mult = 1
          let st = segStart
          if (st < cursor && tokens[st].t === 'N') {
            mult = tokens[st].v
            st++
          }
          if (st >= cursor) throw new Error('结晶水符号「·」后缺少化学式')
          hasDotGroup = true
          parseSegment(st, cursor, mult)
        }
        segStart = cursor + 1
      }
      cursor++
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }

  // 校验所有元素均已知并计算相对分子质量
  let mass = 0
  for (const k of Object.keys(counts)) {
    const el = getElement(k)
    if (!el) return { ok: false, error: '含有未知元素「' + k + '」' }
    if (counts[k] <= 0) return { ok: false, error: '元素计数异常' }
    mass += el.mass * counts[k]
  }

  const norm = rebuildNorm(tokens)
  return {
    ok: true,
    norm,
    counts: Object.assign({}, counts),
    mass: Math.round(mass * 100) / 100,
    display: toDisplay(norm),
    hasDotGroup
  }
}

/** 由词法单元重建规范化的化学式字符串 */
function rebuildNorm(tokens) {
  let out = ''
  let expectSegment = true
  for (let idx = 0; idx < tokens.length; idx++) {
    const tk = tokens[idx]
    if (tk.t === 'L') {
      const seg = segmentLetters(tk.v)
      out += seg.join('')
    } else if (tk.t === 'N') {
      out += String(tk.v)
    } else if (tk.t === '(') {
      out += '('
    } else if (tk.t === ')') {
      out += ')'
    } else if (tk.t === 'DOT') {
      out += '·'
      // 点后的系数数字保留在原位
    }
    void expectSegment
  }
  return out
}

/**
 * 规范式 → 展示用字符串。
 * 注：穿戴设备字体对下标 Unicode 支持不稳定，为保证渲染可靠性，
 * 展示层使用普通数字（H2SO4），后续如需可在此统一切换为下标样式。
 */
export function toDisplay(norm) {
  return String(norm || '')
}

/** 相对分子质量（基于已解析 counts） */
export function massFromCounts(counts) {
  let m = 0
  for (const k of Object.keys(counts)) {
    const el = getElement(k)
    if (el) m += el.mass * counts[k]
  }
  return Math.round(m * 100) / 100
}

/**
 * 将整行输入按加号拆分为多种反应物。
 * 支持半角 + 与全角 ＋。
 */
export function splitReactants(line) {
  return String(line || '')
    .replace(/＋/g, '+')
    .split('+')
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
}
