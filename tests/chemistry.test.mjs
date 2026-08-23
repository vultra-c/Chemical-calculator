/**
 * 化学引擎单元测试（Node 原生 test runner，零依赖）
 * 运行：npm test / node --test tests/
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseSubstance, splitReactants, toDisplay } from '../src/common/chemistry/parser.js'
import { resolveZhName } from '../src/common/chemistry/substances.js'
import { balance } from '../src/common/chemistry/balance.js'
import { analyzeList, extractIons, calcStoich } from '../src/common/chemistry/reactions.js'
import { ELEMENTS } from '../src/common/chemistry/elements.js'

function eq(result) {
  assert.equal(result.ok, true, '应推导成功：' + JSON.stringify(result))
  return result
}
function prodNorms(r) {
  return r.substances.filter((s) => s.side === 'R').map((s) => s.norm)
}

/* ---------- 解析器 ---------- */
test('parseSubstance 基础', () => {
  const p = parseSubstance('H2SO4')
  assert.ok(p.ok)
  assert.deepEqual(p.counts, { H: 2, S: 1, O: 4 })
  const fe = parseSubstance('Fe2(SO4)3')
  assert.deepEqual(fe.counts, { Fe: 2, S: 3, O: 12 })
  const cu = parseSubstance('Cu2(OH)2CO3')
  assert.deepEqual(cu.counts, { Cu: 2, O: 2 + 3, H: 2, C: 1 })
})

test('parseSubstance 结晶水合物', () => {
  const p = parseSubstance('CuSO4·5H2O')
  assert.ok(p.ok)
  assert.deepEqual(p.counts, { Cu: 1, S: 1, O: 9, H: 10 })
  const alum = parseSubstance('KAl(SO4)2·12H2O')
  assert.deepEqual(alum.counts, { K: 1, Al: 1, S: 2, O: 8 + 12, H: 24 })
})

test('parseSubstance 全小写智能纠正', () => {
  assert.equal(parseSubstance('nahco3').norm, 'NaHCO3')
  assert.equal(parseSubstance('hcl').norm, 'HCl')
  assert.equal(parseSubstance('co').norm, 'CO') // 碳氧化物优先于钴
  assert.equal(parseSubstance('cuo').norm, 'CuO')
})

test('parseSubstance 非法输入', () => {
  assert.equal(parseSubstance('Xx123').ok, false)
  assert.equal(parseSubstance('').ok, false)
  assert.equal(parseSubstance('H2Lm').ok, false)
})

test('toDisplay 展示转换', () => {
  // 设备字体兼容：展示层使用普通数字
  assert.equal(toDisplay('H2SO4'), 'H2SO4')
  assert.equal(toDisplay('CuSO4·5H2O'), 'CuSO4·5H2O')
})

test('splitReactants', () => {
  assert.deepEqual(splitReactants('铁+硫酸铜'), ['铁', '硫酸铜'])
  assert.deepEqual(splitReactants(' HCl ＋ NaOH '), ['HCl', 'NaOH'])
})

/* ---------- 中文名词典 ---------- */
test('中文名称映射', () => {
  assert.equal(resolveZhName('盐酸'), 'HCl')
  assert.equal(resolveZhName('石灰石'), 'CaCO3')
  assert.equal(resolveZhName('胆矾'), 'CuSO4·5H2O')
  assert.equal(resolveZhName('纯碱'), 'Na2CO3')
  assert.equal(resolveZhName('双氧水'), 'H2O2')
  assert.equal(resolveZhName('不存在的物质'), null)
})

/* ---------- 配平算法 ---------- */
test('balance 直接配平', () => {
  const c2h5oh = parseSubstance('C2H5OH').counts
  const o2 = parseSubstance('O2').counts
  const co2 = parseSubstance('CO2').counts
  const h2o = parseSubstance('H2O').counts
  const r = balance([c2h5oh, o2, co2, h2o], 2)
  assert.ok(r.ok)
  assert.deepEqual(r.coefs, [1, 3, 2, 3])

  const kmno4 = balance(
    ['KMnO4', 'K2MnO4', 'MnO2', 'O2'].map((f) => parseSubstance(f).counts),
    1
  )
  assert.deepEqual(kmno4.coefs, [2, 1, 1, 1])
})

/* ---------- 反应推导 ---------- */
test('置换：铁 + 硫酸铜', () => {
  const r = eq(analyzeList(['铁', '硫酸铜']))
  assert.equal(r.tag, '置换反应')
  const pn = prodNorms(r)
  assert.ok(pn.indexOf('FeSO4') >= 0)
  assert.ok(pn.indexOf('Cu') >= 0)
})

test('复分解：碳酸钙 + 盐酸', () => {
  const r = eq(analyzeList(['碳酸钙', '盐酸']))
  assert.ok(prodNorms(r).indexOf('CO2') >= 0)
})

test('中和：氢氧化钠 + 盐酸', () => {
  const r = eq(analyzeList(['氢氧化钠', '盐酸']))
  assert.equal(r.tag, '中和反应')
  assert.ok(prodNorms(r).indexOf('NaCl') >= 0)
})

test('碳还原氧化铜', () => {
  const r = eq(analyzeList(['碳', '氧化铜']))
  const pn = prodNorms(r)
  assert.ok(pn.indexOf('Cu') >= 0 && pn.indexOf('CO2') >= 0)
})

test('分解：过氧化氢 / 水 / 高锰酸钾 / 氯酸钾', () => {
  const h2o2 = eq(analyzeList(['过氧化氢']))
  assert.equal(h2o2.cond.includes('MnO'), true)
  assert.ok(prodNorms(h2o2).indexOf('O2') >= 0)

  const water = eq(analyzeList(['水']))
  assert.equal(water.cond, '通电')

  const km = eq(analyzeList(['高锰酸钾']))
  const pn = prodNorms(km)
  for (const f of ['K2MnO4', 'MnO2', 'O2']) assert.ok(pn.indexOf(f) >= 0, '缺少产物 ' + f)

  const kc = eq(analyzeList(['氯酸钾']))
  assert.ok(prodNorms(kc).indexOf('KCl') >= 0)
})

test('燃烧：镁 / 甲烷 / 一氧化碳', () => {
  const mg = eq(analyzeList(['镁', '氧气']))
  assert.ok(prodNorms(mg).indexOf('MgO') >= 0)
  assert.equal(mg.cond, '点燃')

  const ch4 = eq(analyzeList(['甲烷', '氧气']))
  const pn = prodNorms(ch4)
  assert.ok(pn.indexOf('CO2') >= 0 && pn.indexOf('H2O') >= 0)

  const co = eq(analyzeList(['一氧化碳', '氧气']))
  assert.ok(prodNorms(co).indexOf('CO2') >= 0)
})

test('碱 + 酸性氧化物：二氧化碳 + 氢氧化钙', () => {
  const r = eq(analyzeList(['二氧化碳', '氢氧化钙']))
  assert.ok(prodNorms(r).indexOf('CaCO3') >= 0)
})

test('金属 + 酸：锌 + 稀硫酸（硫酸锌正确）', () => {
  const r = eq(analyzeList(['锌', '稀硫酸']))
  assert.ok(prodNorms(r).indexOf('ZnSO4') >= 0)
  assert.ok(prodNorms(r).indexOf('H2') >= 0)
})

test('金属 + 酸：铁 + 盐酸 得氯化亚铁', () => {
  const r = eq(analyzeList(['铁粉', '稀硫酸']))
  assert.ok(prodNorms(r).indexOf('FeSO4') >= 0, '铁与稀酸应生成 +2 价亚铁盐')
  const r2 = eq(analyzeList(['铁粉', '盐酸']))
  assert.ok(prodNorms(r2).indexOf('FeCl2') >= 0)
})

test('不活泼金属 + 稀酸 → 明确不反应', () => {
  const r = analyzeList(['铜', '稀硫酸'])
  assert.equal(r.ok, false)
  assert.match(r.message, /弱于氢|不能/)
})

test('金属 + 盐溶液：铁 + 硫酸铜 / 铜 + 硝酸银', () => {
  const a = eq(analyzeList(['铁粉', '硫酸铜']))
  assert.ok(prodNorms(a).indexOf('FeSO4') >= 0)
  const b = eq(analyzeList(['铜', '硝酸银']))
  assert.ok(prodNorms(b).indexOf('Ag') >= 0)
})

test('难溶盐不能发生置换：铜 + 氯化银', () => {
  const r = analyzeList(['铜', '氯化银'])
  assert.equal(r.ok, false)
  assert.match(r.message, /难溶/)
})

test('氧化还原：一氧化碳还原氧化铁', () => {
  const r = eq(analyzeList(['一氧化碳', '氧化铁']))
  assert.equal(r.cond, '高温')
  const pn = prodNorms(r)
  assert.ok(pn.indexOf('Fe') >= 0 && pn.indexOf('CO2') >= 0)
})

test('铝热反应：铝 + 氧化铁', () => {
  const r = eq(analyzeList(['铝', '氧化铁']))
  const pn = prodNorms(r)
  assert.ok(pn.indexOf('Al2O3') >= 0 && pn.indexOf('Fe') >= 0)
})

test('化合：生石灰 + 水 / 二氧化碳 + 水 / 碳 + 二氧化碳', () => {
  const a = eq(analyzeList(['生石灰', '水']))
  assert.ok(prodNorms(a).indexOf('Ca(OH)2') >= 0)
  const b = eq(analyzeList(['二氧化碳', '水']))
  assert.ok(prodNorms(b).indexOf('H2CO3') >= 0)
  const c = eq(analyzeList(['碳', '二氧化碳']))
  assert.ok(prodNorms(c).indexOf('CO') >= 0)
  assert.equal(c.cond, '高温')
})

test('酸 + 金属氧化物：氧化铁 + 盐酸 得 FeCl3', () => {
  const r = eq(analyzeList(['氧化铁', '盐酸']))
  assert.ok(prodNorms(r).indexOf('FeCl3') >= 0)
})

test('酸 + 盐：盐酸 + 硝酸银；硫酸 + 氯化钡', () => {
  const a = eq(analyzeList(['盐酸', '硝酸银']))
  assert.ok(prodNorms(a).indexOf('AgCl') >= 0)
  const b = eq(analyzeList(['硫酸', '氯化钡']))
  assert.ok(prodNorms(b).indexOf('BaSO4') >= 0)
})

test('碱 + 盐：碳酸钠 + 氢氧化钙；氢氧化钠 + 氯化铁', () => {
  const a = eq(analyzeList(['纯碱', '熟石灰']))
  assert.ok(prodNorms(a).indexOf('CaCO3') >= 0)
  const b = eq(analyzeList(['烧碱', '氯化铁']))
  assert.ok(prodNorms(b).indexOf('Fe(OH)3') >= 0)
})

test('结晶水分解：胆矾加热', () => {
  const r = eq(analyzeList(['胆矾']))
  assert.ok(prodNorms(r).indexOf('CuSO4') >= 0)
})

test('无法识别的物质给出明确提示', () => {
  const r = analyzeList(['xyzq'])
  assert.equal(r.code, 'BAD_SUBSTANCE')
  const r2 = analyzeList(['氯化钠', '乱写的'])
  assert.equal(r2.code, 'BAD_SUBSTANCE')
})

test('三种及以上反应物暂不支持', () => {
  const r = analyzeList(['盐酸', '氢氧化钠', '氧气'])
  assert.equal(r.code, 'TOO_MANY')
})

test('无规则可匹配时不乱生成', () => {
  const r = analyzeList(['氯化钠', '硝酸钾'])
  assert.equal(r.ok, false)
  assert.equal(r.code, 'NO_REACTION')
})

/* ---------- 计量计算 ---------- */
test('计量：5.6g 铁 完全反应生成铜的质量为 6.4g', () => {
  const r = eq(analyzeList(['铁', '硫酸铜']))
  const refIdx = r.substances.findIndex((s) => s.norm === 'Fe')
  const out = calcStoich(r, refIdx, 5.6)
  assert.ok(out.ok)
  const cuRow = out.rows.find((row) => row.norm === 'Cu')
  // 精确原子量：m(Cu) = 5.6 × 63.546 / 55.845 ≈ 6.372（教材取整数质量时为 6.4）
  const expected = (5.6 * 63.546) / 55.845
  assert.ok(Math.abs(cuRow.grams - expected) < 0.01, 'Cu 质量应约 ' + expected.toFixed(3) + 'g，实际 ' + cuRow.grams)
})

/* ---------- 元素库 ---------- */
test('元素库包含常见元素且质量合理', () => {
  assert.ok(ELEMENTS.length > 60)
  const fe = ELEMENTS.find((e) => e.symbol === 'Fe')
  assert.equal(fe.name, '铁')
  assert.equal(fe.mass, 55.845)
})
