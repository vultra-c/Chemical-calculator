/**
 * 产物逆推（合成查询）：纯逻辑模块，可被 Node 冒烟测试直接导入。
 * 数据源：ELEMENT_BANK（r 反应物 / p 产物 / c 系数 / t 类型 / n 条件）。
 */
import { ELEMENT_BANK } from './elementBank.js'

function coefSum(entry) {
  let s = 0
  for (let i = 0; i < entry.c.length; i++) s += entry.c[i]
  return s
}

/** 所有能生成 productFormula 的反应；反应物少（直接合成）在前，同类按系数和升序 */
function producers(productFormula) {
  const hits = []
  for (let i = 0; i < ELEMENT_BANK.length; i++) {
    const e = ELEMENT_BANK[i]
    if (e.p.indexOf(productFormula) >= 0) hits.push(e)
  }
  hits.sort((a, b) => (a.r.length - b.r.length) || (coefSum(a) - coefSum(b)))
  return hits
}

/**
 * 查询「哪些物质反应可合成 productFormula」
 * @returns {Array} 命中的库条目（至多 limit 条）
 */
export function findProducers(productFormula, limit = 50) {
  return producers(productFormula).slice(0, limit)
}

/**
 * 已知产物与部分反应物，求缺失的反应物。
 * @param {string} productFormula 产物化学式
 * @param {string[]|string} knownReactants 已知反应物化学式（一个或多个）
 * @returns {Array<{entry:object, missing:string[]}>} missing 为还需加入的反应物
 */
export function findCompletions(productFormula, knownReactants, limit = 50) {
  const known = Array.isArray(knownReactants) ? knownReactants : [knownReactants]
  const out = []
  const all = producers(productFormula)
  for (let i = 0; i < all.length; i++) {
    const e = all[i]
    let covered = true
    for (let k = 0; k < known.length; k++) {
      if (e.r.indexOf(known[k]) < 0) { covered = false; break }
    }
    if (!covered) continue
    const missing = []
    for (let j = 0; j < e.r.length; j++) {
      if (known.indexOf(e.r[j]) < 0) missing.push(e.r[j])
    }
    out.push({ entry: e, missing })
  }
  out.sort((a, b) => a.missing.length - b.missing.length)
  return out.slice(0, limit)
}
