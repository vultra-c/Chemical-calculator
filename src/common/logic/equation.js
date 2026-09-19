/**
 * 化学工具箱 · 自定义方程式配平（纯逻辑，无 @system.* 依赖，Node 可直接测试）
 * 输入：未配平方程式文本（化学式或中文名、+ 与 = 分隔、容忍全角符号与 → 箭头）
 * 输出：配平后的完整方程式 + 每种物质的系数与相对分子质量
 */
import { parseFormula, molarMass, resolveToken } from './parser.js'
import { NAME_MAP } from './substances.js'
import { balance } from './balance.js'
import { segsToText } from './fmt.js'

/** 把一整条方程式拆成左右两侧的 token 数组 */
export function splitEquation(text) {
  const raw = String(text || '')
    .replace(/＋/g, '+')
    .replace(/＝/g, '=')
    .replace(/→|->|⇒|⟶|=>/g, '=')
  const parts = raw.split('=')
  if (parts.length < 2) {
    return { ok: false, error: '请用 = 连接左右两边，如 Fe+O2=Fe3O4' }
  }
  const left = splitSide(parts[0])
  const right = splitSide(parts.slice(1).join('='))
  if (!left.length) return { ok: false, error: '左边（反应物）不能为空' }
  if (!right.length) return { ok: false, error: '右边（生成物）不能为空' }
  return { ok: true, left, right }
}

function splitSide(side) {
  return String(side)
    .split('+')
    .map(t => t.trim())
    .filter(t => t.length > 0)
}

/**
 * 配平用户输入的方程式
 * @param {string} text 如 "fe+o2=fe3o4" / "kmno4+hcl=kcl+mncl2+cl2+h2o" / "碳酸钙=氧化钙+二氧化碳"
 * @returns {{ok:boolean, error?:string, left?:Array, right?:Array, rows?:Array, text?:string, leftCount?:number}}
 *   rows: [{ formula, coef, M, segs, side }] side: 'left' 反应物 / 'right' 生成物
 */
export function balanceEquation(text) {
  const sp = splitEquation(text)
  if (!sp.ok) return sp

  const tokens = sp.left.concat(sp.right)
  const leftCount = sp.left.length
  const rows = []
  const countsList = []
  const segsList = []

  for (let i = 0; i < tokens.length; i++) {
    const res = resolveToken(tokens[i], NAME_MAP)
    if (!res.ok) return { ok: false, error: res.error || ('无法识别 ' + tokens[i]) }
    const pf = parseFormula(res.formula)
    if (!pf.ok) return { ok: false, error: pf.error }
    rows.push({ formula: res.formula, segs: pf.segs, byName: !!res.byName, side: i < leftCount ? 'left' : 'right' })
    countsList.push(pf.counts)
    segsList.push(pf.segs)
  }

  let coefs = null
  try {
    coefs = balance(countsList, leftCount)
  } catch (err) {
    coefs = null
  }
  if (!coefs) {
    return { ok: false, error: '该方程式无法配平：请检查左右物质是否写全、化学式是否正确' }
  }

  for (let i = 0; i < rows.length; i++) {
    rows[i].coef = coefs[i]
    rows[i].M = molarMass(countsList[i])
  }

  let eqText = ''
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) eqText += (i === leftCount ? ' = ' : ' + ')
    eqText += segsToText(segsList[i], rows[i].coef)
  }

  return {
    ok: true,
    left: rows.slice(0, leftCount),
    right: rows.slice(leftCount),
    rows,
    leftCount,
    text: eqText
  }
}
