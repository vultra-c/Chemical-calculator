/**
 * 化学工具箱 · 气体计量换算（纯逻辑）
 * 标准状况（0 ℃、101 kPa）下 V_m = 22.4 L/mol。
 * 体积 ↔ 物质的量 ↔ 质量 ↔ 分子个数 四向互算，考试常考。
 */
import { parseFormula, molarMass, resolveToken } from './parser.js'
import { NAME_MAP } from './substances.js'

/** 标准状况气体摩尔体积 L/mol */
export const V_M = 22.4
/** 阿伏伽德罗常数 /mol */
export const N_A = 6.022e23

function lookup(input) {
  const res = resolveToken(input, NAME_MAP)
  if (!res.ok) return { ok: false, error: res.error || '无法识别该化学式' }
  const pf = parseFormula(res.formula)
  if (!pf.ok) return { ok: false, error: pf.error }
  return { ok: true, formula: res.formula, byName: !!res.byName, counts: pf.counts, M: molarMass(pf.counts) }
}

/**
 * 已知标准状况体积求物质的量/质量/分子数
 * @param {string} input 化学式或中文名
 * @param {number} volumeL 标准状况体积 L
 */
export function gasFromVolume(input, volumeL) {
  const base = lookup(input)
  if (!base.ok) return base
  const V = Number(volumeL)
  if (!(V > 0)) return { ok: false, error: '请输入大于 0 的体积' }
  const n = V / V_M
  return {
    ok: true,
    formula: base.formula,
    byName: base.byName,
    M: base.M,
    n,
    volume: V,
    mass: n * base.M,
    molecules: n * N_A
  }
}

/**
 * 已知质量求标准状况体积/物质的量/分子数
 * @param {string} input 化学式或中文名
 * @param {number} massG 质量 g
 */
export function gasFromMass(input, massG) {
  const base = lookup(input)
  if (!base.ok) return base
  const m = Number(massG)
  if (!(m > 0)) return { ok: false, error: '请输入大于 0 的质量' }
  if (!(base.M > 0)) return { ok: false, error: '该物质相对分子质量异常' }
  const n = m / base.M
  return {
    ok: true,
    formula: base.formula,
    byName: base.byName,
    M: base.M,
    n,
    mass: m,
    volume: n * V_M,
    molecules: n * N_A
  }
}
