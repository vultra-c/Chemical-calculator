/**
 * 化学工具箱 · 相对分子质量与元素质量分数（纯逻辑）
 * 输入：化学式或中文名（如 CuSO4·5H2O / 胆矾）
 * 输出：相对分子质量 M、各元素原子个数/相对原子质量/质量/质量分数、元素质量比
 */
import { parseFormula, molarMass, resolveToken } from './parser.js'
import { NAME_MAP } from './substances.js'
import { ATOMIC_MASSES } from './elements.js'

/** 保留 3 位小数并去尾零 */
function r3(v) {
  return Math.round(v * 1000) / 1000
}

/**
 * @param {string} input 化学式或中文名
 * @returns {{ok:boolean, error?:string, formula?:string, byName?:boolean, M?:number,
 *            rows?:Array<{sym:string, count:number, ar:number, mass:number, pct:number}>,
 *            ratioText?:string}}
 */
export function formulaMolarInfo(input) {
  const res = resolveToken(input, NAME_MAP)
  if (!res.ok) return { ok: false, error: res.error || '无法识别该化学式' }
  const pf = parseFormula(res.formula)
  if (!pf.ok) return { ok: false, error: pf.error }

  const M = molarMass(pf.counts)
  const rows = []
  let atoms = 0
  for (const sym in pf.counts) {
    const count = pf.counts[sym]
    const ar = ATOMIC_MASSES[sym] || 0
    const mass = r3(ar * count)
    atoms += count
    rows.push({
      sym,
      count,
      ar,
      mass,
      pct: M > 0 ? r3((mass / M) * 100) : 0
    })
  }

  // 元素质量比：同乘一个系数取最简整数比（如 H:O = 2.016:15.999 → 2:16 = 1:8）
  const ratioText = buildRatio(rows)

  return {
    ok: true,
    formula: res.formula,
    byName: !!res.byName,
    M: r3(M),
    atoms,
    rows,
    ratioText
  }
}

/**
 * 元素质量比文本，如 "H : O = 2 : 16"。
 * 用教科书取整相对原子质量（Cl 取 35.5）计算 —— 考试答案按取整值写，
 * 用 IUPAC 精确值时比值会变成 2016:15999 这类无法书写的形式。
 */
function buildRatio(rows) {
  if (!rows.length) return ''
  const names = []
  const vals = []
  for (let i = 0; i < rows.length; i++) {
    const ar = AR_EXAM[rows[i].sym] != null ? AR_EXAM[rows[i].sym] : rows[i].ar
    names.push(rows[i].sym)
    vals.push(r3(ar * rows[i].count))
  }
  return names.join(' : ') + ' = ' + vals.join(' : ')
}

/** 教科书取整相对原子质量（考试计算常用值，Cl 习惯取 35.5） */
const AR_EXAM = (function () {
  const t = { Cl: 35.5 }
  for (const sym in ATOMIC_MASSES) {
    if (t[sym] == null) t[sym] = Math.round(ATOMIC_MASSES[sym])
  }
  return t
})()
