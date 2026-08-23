/**
 * 化学方程式配平引擎（纯离线）
 * 方法：构造元素守恒矩阵 A（元素 × 物质），求 Ax=0 的正有理数解，
 *       使用 BigInt 精确分数做高斯消元，得到最简正整数系数。
 */

function gcd(a, b) {
  a = a < 0n ? -a : a
  b = b < 0n ? -b : b
  while (b) {
    const t = a % b
    a = b
    b = t
  }
  return a
}

class Frac {
  constructor(n, d) {
    if (d === 0n) throw new Error('分母为 0')
    if (d < 0n) {
      n = -n
      d = -d
    }
    const g = gcd(n, d) || 1n
    this.n = n / g
    this.d = d / g
  }
  add(o) {
    return new Frac(this.n * o.d + o.n * this.d, this.d * o.d)
  }
  sub(o) {
    return new Frac(this.n * o.d - o.n * this.d, this.d * o.d)
  }
  mul(o) {
    return new Frac(this.n * o.n, this.d * o.d)
  }
  div(o) {
    if (o.n === 0n) throw new Error('除以 0')
    return new Frac(this.n * o.d, this.d * o.n)
  }
  isZero() {
    return this.n === 0n
  }
  isNeg() {
    return this.n < 0n
  }
}

/**
 * balance(countsList)
 * @param countsList {Array<Object<string,number>>} 每种物质的元素计数（前 leftN 种为反应物）
 * @param leftN {number} 反应物数量
 * @returns {ok:true, coefs:number[]} 或 { ok:false, error }
 */
export function balance(countsList, leftN) {
  const n = countsList.length
  if (n < 2) return { ok: false, error: '物质数量不足' }

  // 元素集合
  const elemSet = new Set()
  countsList.forEach((c) => Object.keys(c).forEach((k) => elemSet.add(k)))
  const elems = Array.from(elemSet)

  // 构造增广矩阵（齐次）
  const rows = elems.length
  const cols = n
  const A = []
  for (let r = 0; r < rows; r++) {
    const row = []
    for (let c = 0; c < cols; c++) {
      const v = countsList[c][elems[r]] || 0
      // 反应物为负、生成物为正 → A x = 0 表示两边守恒
      row.push(new Frac(BigInt(c < leftN ? -v : v), 1n))
    }
    A.push(row)
  }

  // 高斯消元 → 行最简形，记录主元列
  const pivotCols = []
  let r = 0
  for (let c = 0; c < cols && r < rows; c++) {
    // 找主元
    let pr = -1
    for (let rr = r; rr < rows; rr++) {
      if (!A[rr][c].isZero()) {
        pr = rr
        break
      }
    }
    if (pr === -1) continue
    const tmp = A[r]
    A[r] = A[pr]
    A[pr] = tmp
    const pv = A[r][c]
    for (let cc = 0; cc < cols; cc++) A[r][cc] = A[r][cc].div(pv)
    for (let rr = 0; rr < rows; rr++) {
      if (rr !== r && !A[rr][c].isZero()) {
        const f = A[rr][c]
        for (let cc = 0; cc < cols; cc++) {
          A[rr][cc] = A[rr][cc].sub(f.mul(A[r][cc]))
        }
      }
    }
    pivotCols.push(c)
    r++
  }

  const rank = pivotCols.length
  const freeCols = []
  for (let c = 0; c < cols; c++) {
    if (pivotCols.indexOf(c) < 0) freeCols.push(c)
  }
  if (freeCols.length !== 1) {
    // 零空间维数 ≠ 1：无法唯一配平（多解或无解）
    return { ok: false, error: '无法唯一配平该方程式' }
  }

  // 取自由变量 = 1，回代求主元变量
  const free = freeCols[0]
  const x = new Array(cols).fill(null)
  x[free] = new Frac(1n, 1n)
  for (let i = pivotCols.length - 1; i >= 0; i--) {
    const pc = pivotCols[i]
    let val = new Frac(0n, 1n)
    for (const fc of freeCols) {
      val = val.sub(A[i][fc].mul(x[fc]))
    }
    x[pc] = val
  }

  // 全部必须为正
  for (let i = 0; i < cols; i++) {
    if (x[i] === null || x[i].isZero() || x[i].isNeg()) {
      return { ok: false, error: '系数非正，反应不成立' }
    }
  }

  // 通分取最小公倍，化为最简正整数
  let L = 1n
  for (let i = 0; i < cols; i++) {
    L = L * x[i].d / gcd(L, x[i].d)
  }
  const coefs = x.map((f) => Number((f.n * (L / f.d))))
  let g = 0
  coefs.forEach((v) => {
    g = gcd(BigInt(v), BigInt(g)).valueOf()
  })
  if (g > 1) {
    for (let i = 0; i < coefs.length; i++) coefs[i] = coefs[i] / g
  }
  return { ok: true, coefs }
}
