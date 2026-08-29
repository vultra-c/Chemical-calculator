// 化学计算器核心逻辑 Node 冒烟测试
import { parseFormula, molarMass, splitInputTokens, resolveToken } from '../src/common/logic/parser.js'
import { balance } from '../src/common/logic/balance.js'
import { solveReaction } from '../src/common/logic/reactions.js'
import { computeMasses } from '../src/common/logic/stoich.js'
import { NAME_MAP } from '../src/common/logic/substances.js'
import assert from 'node:assert'

let pass = 0, fail = 0
function T(name, fn) {
  try { fn(); pass++; console.log('PASS', name) }
  catch (e) { fail++; console.log('FAIL', name, '::', e.message) }
}

// ---- 解析器 ----
T('parse H2O', () => {
  const r = parseFormula('H2O')
  assert.equal(r.ok, true)
  assert.deepEqual(r.counts, { H: 2, O: 1 })
})
T('parse Cu2(OH)2CO3', () => {
  const r = parseFormula('Cu2(OH)2CO3')
  assert.equal(r.ok, true)
  assert.equal(r.counts.Cu, 2); assert.equal(r.counts.O, 5); assert.equal(r.counts.H, 2); assert.equal(r.counts.C, 1)
})
T('parse Fe3O4', () => {
  const r = parseFormula('Fe3O4')
  assert.equal(r.counts.Fe, 3)
})
T('parse (NH4)2SO4', () => {
  const r = parseFormula('(NH4)2SO4')
  assert.equal(r.counts.N, 2); assert.equal(r.counts.H, 8); assert.equal(r.counts.S, 1)
})
T('parse Ca(HCO3)2', () => {
  const r = parseFormula('Ca(HCO3)2')
  assert.equal(r.counts.Ca, 1); assert.equal(r.counts.H, 2); assert.equal(r.counts.C, 2); assert.equal(r.counts.O, 6)
})
T('parse bad symbol rejected', () => {
  const r = parseFormula('Xx1')
  assert.equal(r.ok, false)
})
T('molar H2O ~18', () => {
  const m = molarMass(parseFormula('H2O').counts)
  assert(Math.abs(m - 18.015) < 0.01)
})

// ---- 名称解析 ----
T('name 盐酸→HCl', () => {
  const r = resolveToken('盐酸', NAME_MAP)
  assert.equal(r.formula, 'HCl')
})
T('name 熟石灰→Ca(OH)2', () => {
  const r = resolveToken('熟石灰', NAME_MAP)
  assert.equal(r.formula, 'Ca(OH)2')
})
T('unknown token error', () => {
  const r = resolveToken('XYZ疑', NAME_MAP)
  assert.equal(r.ok, false)
})

// ---- 配平 ----
T('balance 2H2+O2', () => {
  const sp = [{ H: 2 }, { O: 2 }, { H: 2, O: 1 }]
  assert.deepEqual(balance(sp, 2), [2, 1, 2])
})
T('balance Fe+O2->Fe3O4: 3Fe+2O2', () => {
  const sp = [{ Fe: 1 }, { O: 2 }, { Fe: 3, O: 4 }]
  assert.deepEqual(balance(sp, 2), [3, 2, 1])
})
T('balance C2H5OH combustion', () => {
  const sp = [{ C: 2, H: 6, O: 1 }, { O: 2 }, { C: 1, O: 2 }, { H: 2, O: 1 }]
  assert.deepEqual(balance(sp, 2), [1, 3, 2, 3])
})
T('balance Al2O3 electrolysis 2Al2O3->4Al+3O2', () => {
  const sp = [{ Al: 2, O: 3 }, { Al: 1 }, { O: 2 }]
  assert.deepEqual(balance(sp, 1), [2, 4, 3])
})

// ---- 反应推导 ----
function eq(f, p, type) {
  const r = solveReaction(f)
  if (!r.ok) throw new Error(f.join('+') + ' -> ' + r.error.replace(/\n/g, ' '))
  const gotP = r.reaction.products.join(',')
  assert.equal(gotP, p.join(','), f.join('+') + ' got products ' + gotP + ' expect ' + p.join(','))
  if (type) assert.equal(r.reaction.type.indexOf(type) !== -1 || type === '*', true, 'type=' + r.reaction.type)
  return r.reaction
}

T('Fe + O2', () => { const r = eq(['Fe', 'O2'], ['Fe3O4']); assert.deepEqual(r.coefs, [3, 2, 1]) })
T('S + O2', () => eq(['S', 'O2'], ['SO2']))
T('C 完全燃烧', () => eq(['C', 'O2'], ['CO2']))
T('P 燃烧', () => eq(['P', 'O2'], ['P2O5']))
T('H2 燃烧', () => eq(['H2', 'O2'], ['H2O']))
T('Cu 加热氧化', () => eq(['Cu', 'O2'], ['CuO']))
T('Al 氧化', () => eq(['Al', 'O2'], ['Al2O3']))
T('CaO + 水', () => eq(['CaO', 'H2O'], ['Ca(OH)2']))
T('CO2 溶水', () => eq(['CO2', 'H2O'], ['H2CO3']))
T('NaOH + CO2', () => eq(['CO2', 'NaOH'], ['Na2CO3', 'H2O']))
T('中和 NaOH+HCl', () => { const r = eq(['HCl', 'NaOH'], ['NaCl', 'H2O']); assert.deepEqual(r.coefs, [1, 1, 1, 1]) })
T('中和 H2SO4+NaOH', () => { const r = eq(['H2SO4', 'NaOH'], ['Na2SO4', 'H2O']); assert.deepEqual(r.coefs, [1, 2, 1, 2]) })
T('Zn + HCl', () => { const r = eq(['Zn', 'HCl'], ['ZnCl2', 'H2']); assert.deepEqual(r.coefs, [1, 2, 1, 1]) })
T('Fe + HCl → 亚铁盐', () => eq(['Fe', 'HCl'], ['FeCl2', 'H2']))
T('Cu + HCl 不反应', () => {
  const r = solveReaction(['Cu', 'HCl'])
  assert.equal(r.ok, false); assert(/氢/.test(r.error))
})
T('Fe + CuSO4 置换', () => eq(['Fe', 'CuSO4'], ['FeSO4', 'Cu']))
T('Cu + AgNO3', () => { const r = eq(['Cu', 'AgNO3'], ['Cu(NO3)2', 'Ag']); assert.deepEqual(r.coefs, [1, 2, 1, 2]) })
T('K 放入盐溶液被拒', () => {
  const r = solveReaction(['K', 'CuSO4'])
  assert.equal(r.ok, false); assert(/太活泼|水/.test(r.error))
})
T('CaCO3 高温分解', () => eq(['CaCO3'], ['CaO', 'CO2']))
T('KMnO4 分解', () => { const r = eq(['KMnO4'], ['K2MnO4', 'MnO2', 'O2']); assert.deepEqual(r.coefs, [2, 1, 1, 1]) })
T('KClO3 分解', () => { const r = eq(['KClO3'], ['KCl', 'O2']); assert.deepEqual(r.coefs, [2, 2, 3]) })
T('H2O2 分解', () => eq(['H2O2'], ['H2O', 'O2']))
T('水电解', () => eq(['H2O'], ['H2', 'O2']))
T('HCl + CaCO3 产气', () => { const r = eq(['HCl', 'CaCO3'], ['CaCl2', 'H2O', 'CO2']); assert.deepEqual(r.coefs, [2, 1, 1, 1, 1]) })
T('H2SO4 + Na2CO3', () => eq(['H2SO4', 'Na2CO3'], ['Na2SO4', 'H2O', 'CO2']))
T('HCl + NaHCO3', () => eq(['HCl', 'NaHCO3'], ['NaCl', 'H2O', 'CO2']))
T('NaOH + CuSO4 沉淀', () => eq(['NaOH', 'CuSO4'], ['Na2SO4', 'Cu(OH)2']))
T('Ca(OH)2 + Na2CO3', () => { const r = eq(['Ca(OH)2', 'Na2CO3'], ['CaCO3', 'NaOH']); assert.deepEqual(r.coefs, [1, 1, 1, 2]) })
T('AgNO3 + NaCl', () => eq(['AgNO3', 'NaCl'], ['AgCl', 'NaNO3']))
T('BaCl2 + Na2SO4', () => eq(['BaCl2', 'Na2SO4'], ['BaSO4', 'NaCl']))
T('H2SO4 + BaCl2', () => eq(['H2SO4', 'BaCl2'], ['HCl', 'BaSO4']))
T('NaCl + HNO3 不反应', () => {
  const r = solveReaction(['NaCl', 'HNO3'])
  assert.equal(r.ok, false)
})
T('NaOH + KNO3 不反应', () => {
  const r = solveReaction(['NaOH', 'KNO3'])
  assert.equal(r.ok, false)
})
T('CuO + H2', () => eq(['H2', 'CuO'], ['Cu', 'H2O']))
T('C 还原 CuO', () => { const r = eq(['C', 'CuO'], ['Cu', 'CO2']); assert.deepEqual(r.coefs, [1, 2, 2, 1]) })
T('CO 还原 Fe2O3', () => { const r = eq(['CO', 'Fe2O3'], ['Fe', 'CO2']); assert.deepEqual(r.coefs, [3, 1, 2, 3]) })
T('CH4 燃烧', () => { const r = eq(['CH4', 'O2'], ['CO2', 'H2O']); assert.deepEqual(r.coefs, [1, 2, 1, 2]) })
T('酒精燃烧', () => eq(['C2H5OH', 'O2'], ['CO2', 'H2O']))
T('葡萄糖燃烧', () => { const r = eq(['C6H12O6', 'O2'], ['CO2', 'H2O']); assert.deepEqual(r.coefs, [1, 6, 6, 6]) })
T('NH4Cl + Ca(OH)2 产氨', () => { eq(['Ca(OH)2', 'NH4Cl'], ['NH3', 'H2O', 'CaCl2']) })
T('Mg + CO2', () => eq(['Mg', 'CO2'], ['MgO', 'C']))
T('Na2O2 + H2O', () => eq(['Na2O2', 'H2O'], ['NaOH', 'O2']))
T('三物质 CaCO3+CO2+H2O', () => eq(['CaCO3', 'CO2', 'H2O'], ['Ca(HCO3)2']))
// ---- 扩充反应库（V26.8.41） ----
T('Fe + S 加热', () => eq(['Fe', 'S'], ['FeS']))
T('Fe + Cl2 生成 FeCl3 而非 FeCl2', () => { eq(['Fe', 'Cl2'], ['FeCl3']) })
T('Na + Cl2', () => { const r = eq(['Na', 'Cl2'], ['NaCl']); assert.deepEqual(r.coefs, [2, 1, 2]) })
T('H2 + Cl2', () => { const r = eq(['H2', 'Cl2'], ['HCl']); assert.deepEqual(r.coefs, [1, 1, 2]) })
T('Cu + Cl2', () => eq(['Cu', 'Cl2'], ['CuCl2']))
T('NO 氧化', () => { const r = eq(['NO', 'O2'], ['NO2']); assert.deepEqual(r.coefs, [2, 1, 2]) })
T('SO2 催化氧化', () => { const r = eq(['SO2', 'O2'], ['SO3']); assert.deepEqual(r.coefs, [2, 1, 2]) })
T('NH3 催化氧化', () => { const r = eq(['NH3', 'O2'], ['NO', 'H2O']); assert.deepEqual(r.coefs, [4, 5, 4, 6]) })
T('NO2 溶水', () => { const r = eq(['NO2', 'H2O'], ['HNO3', 'NO']); assert.deepEqual(r.coefs, [1, 3, 2, 1]) })
T('MnO2 + 浓盐酸制氯气', () => { const r = eq(['MnO2', 'HCl'], ['MnCl2', 'Cl2', 'H2O']); assert.deepEqual(r.coefs, [4, 1, 1, 1, 2]) })
T('Mg(OH)2 分解', () => eq(['Mg(OH)2'], ['MgO', 'H2O']))
T('Cu(OH)2 分解', () => eq(['Cu(OH)2'], ['CuO', 'H2O']))
T('NH4Cl 分解', () => eq(['NH4Cl'], ['NH3', 'HCl']))
T('KNO3 分解', () => { const r = eq(['KNO3'], ['KNO2', 'O2']); assert.deepEqual(r.coefs, [2, 2, 1]) })
T('HNO3 光照分解', () => { const r = eq(['HNO3'], ['NO2', 'O2', 'H2O']); assert.deepEqual(r.coefs, [4, 4, 1, 2]) })
T('MgCO3 高温分解', () => eq(['MgCO3'], ['MgO', 'CO2']))
T('三物质 Na2CO3+CO2+H2O', () => { const r = eq(['Na2CO3', 'CO2', 'H2O'], ['NaHCO3']); assert.deepEqual(r.coefs, [1, 1, 1, 2]) })
T('乙烯燃烧', () => { const r = eq(['C2H4', 'O2'], ['CO2', 'H2O']); assert.deepEqual(r.coefs, [1, 3, 2, 2]) })
T('丙烷燃烧', () => { const r = eq(['C3H8', 'O2'], ['CO2', 'H2O']); assert.deepEqual(r.coefs, [1, 5, 3, 4]) })
T('回归：C + O2 仍完全燃烧产 CO2', () => eq(['C', 'O2'], ['CO2']))
T('名称输入 乙烯+氧气', () => {
  const toks = splitInputTokens('乙烯+氧气')
  const fs = toks.map(t => resolveToken(t, NAME_MAP).formula)
  eq(fs, ['CO2', 'H2O'])
})
// ---- 扩充反应库 结束 ----
T('名称输入组合 盐酸+碳酸钙', () => {
  const toks = splitInputTokens('盐酸+碳酸钙')
  const fs = toks.map(t => resolveToken(t, NAME_MAP).formula)
  const r = eq(fs, ['CaCl2', 'H2O', 'CO2'])
  void r
})
T('乱输入报错不崩溃', () => {
  const r = solveReaction(['NaCl', 'Au'])
  assert.equal(r.ok, false)
  console.log('   msg:', r.error.split('\n')[0])
})

// ---- 计量 ----
T('计量 2H2+O2: 4g H2 → 全部', () => {
  const r = solveReaction(['H2', 'O2'])
  assert.equal(r.ok, true)
  // all: [H2,O2,H2O] coefs [2,1,2]
  const out = computeMasses(r.reaction, 0, 4)
  // 理想化值 32/36 基于整数原子量；真实原子量下允许 <1.5% 偏差
  assert(Math.abs(out[1].mass - 32) / 32 < 0.015, 'O2 应约 32，实际 ' + out[1].mass)
  assert(Math.abs(out[2].mass - 36) / 36 < 0.015, 'H2O 应约 36，实际 ' + out[2].mass)
})
T('计量 反推：已知 88g CO2 求 CH4（甲烷燃烧）', () => {
  const r = solveReaction(['CH4', 'O2'])
  const out = computeMasses(r.reaction, 2, 88) // index2=CO2
  assert(Math.abs(out[0].mass - 32) / 32 < 0.01, 'CH4 应约 32，实际 ' + out[0].mass)
})
T('计量 Zn+HCl 已知锌求氢气', () => {
  const r = solveReaction(['Zn', 'HCl'])
  const out = computeMasses(r.reaction, 0, 65.38)
  assert(Math.abs(out[3].mass - 2.016) / 2.016 < 0.001, 'H2 应约 2.016，实际 ' + out[3].mass)
})

// ---- 产物逆推（合成查询） ----
import { findProducers, findCompletions } from '../src/common/logic/reverseQuery.js'
T('逆推 H2O：含 2H2+O2 且反应物少优先', () => {
  const hits = findProducers('H2O', 50)
  assert(hits.length > 0, '应有合成水的反应')
  const idx = hits.findIndex(e => e.r.join('+') === 'H2+O2')
  assert(idx >= 0, '应含氢气+氧气化合')
  for (let i = 1; i < hits.length; i++) {
    assert(hits[i - 1].r.length <= hits[i].r.length, '应按反应物个数升序')
  }
})
T('逆推 Fe3O4：含 3Fe+2O2', () => {
  const hits = findProducers('Fe3O4', 50)
  assert(hits.some(e => e.r.indexOf('Fe') >= 0 && e.r.indexOf('O2') >= 0))
})
T('逆推不存在的产物为空', () => {
  assert.equal(findProducers('Xx9Yy9', 50).length, 0)
})
T('逆推 CO2 已知 C：缺 O2', () => {
  const comps = findCompletions('CO2', ['C'], 50)
  assert(comps.length > 0)
  const top = comps[0]
  assert.deepEqual(top.missing, ['O2'])
  assert.equal(top.entry.t, '化合反应')
})
T('逆推 H2O 已知 O2：缺 H2 且不漏已知物', () => {
  const comps = findCompletions('H2O', ['O2'], 50)
  assert(comps.length > 0)
  // 已知 O2 绝不会再出现在缺失列表；氢气化合路径缺失恰为 H2
  assert(comps.every(c => c.missing.indexOf('O2') < 0))
  assert(comps.some(c => c.missing.join('+') === 'H2'))
})
T('逆推 已知反应物未参与则无结果', () => {
  assert.equal(findCompletions('Fe3O4', ['Cu'], 50).length, 0)
})
T('逆推 已知多个反应物全匹配才命中', () => {
  const comps = findCompletions('H2O', ['H2', 'O2'], 50)
  assert(comps.length === 1 && comps[0].missing.length === 0)
})

// ---- 数据速查（reference.js） ----
import { REFERENCE_SECTIONS, flattenReference, cnName } from '../src/common/logic/reference.js'
T('速查 五组齐备', () => {
  const titles = REFERENCE_SECTIONS.map(s => s.title)
  for (const t of ['金属活动性顺序', '常见元素化合价', '常见根 / 酸根化合价', '常见不溶物（沉淀）', '相对原子质量表']) {
    assert(titles.indexOf(t) !== -1, '缺组 ' + t)
  }
})
T('速查 原子质量 38 元素成对成行', () => {
  const sec = REFERENCE_SECTIONS.find(s => s.title === '相对原子质量表')
  assert.equal(sec.rows.length, 19)
  assert(sec.rows[0].main.indexOf('氢 H') !== -1)
  assert(sec.rows[0].sub.indexOf('氦 He') !== -1)
})
T('速查 活动性三行序列', () => {
  const sec = REFERENCE_SECTIONS.find(s => s.title === '金属活动性顺序')
  assert(sec.rows.joined === undefined)
  const joined = sec.rows.map(r => r.main).join(' ')
  assert(joined.indexOf('K > Ca > Na') !== -1 && joined.indexOf('Pt > Au') !== -1)
})
T('速查 化合价含 K+1 Al+3 与铁变价', () => {
  const sec = REFERENCE_SECTIONS.find(s => s.title === '常见元素化合价')
  const mains = sec.rows.map(r => r.main + '|' + r.sub)
  assert(mains.some(m => m.indexOf('钾 K') >= 0 && m.indexOf('+1') >= 0))
  assert(mains.some(m => m.indexOf('铝 Al') >= 0 && m.indexOf('+3') >= 0))
  assert(mains.some(m => m.indexOf('变价·低价') >= 0) && mains.some(m => m.indexOf('变价·高价') >= 0))
})
T('速查 酸根含硫酸根-2/磷酸根-3', () => {
  const sec = REFERENCE_SECTIONS.find(s => s.title === '常见根 / 酸根化合价')
  const t = sec.rows.map(r => r.main + r.sub).join(' ')
  assert(t.indexOf('硫酸根') !== -1 && t.indexOf('-2') !== -1)
  assert(t.indexOf('磷酸根') !== -1 && t.indexOf('-3') !== -1)
})
T('速查 沉淀表含碳酸钙/氯化银', () => {
  const sec = REFERENCE_SECTIONS.find(s => s.title === '常见不溶物（沉淀）')
  const t = sec.rows.map(r => r.main + r.sub).join(' ')
  assert(t.indexOf('碳酸钙') !== -1 && t.indexOf('氯化银') !== -1)
  assert(sec.rows.length >= 15)
})
T('速查 flattenReference 行流带标题行', () => {
  const rows = flattenReference()
  assert.equal(rows.filter(r => r.kind === 'title').length, 5)
  assert(rows.length > 70)
  assert.equal(cnName('Fe'), '铁')
})

// ---- 化学专属输入词库（gen_chem_dict.py 生成；防回归） ----
const { SimpleInputMethod } = await import('../src/components/InputMethod/assets/dicUtil.js')
const { getWords } = await import('../src/components/InputMethod/assets/dic_words.js')
SimpleInputMethod.initDict()
T('词库 yangqi→氧气', () => {
  const r = SimpleInputMethod.getHanzi('yangqi', 'cn')
  assert((r.multi.words || []).indexOf('氧气') !== -1, 'yangqi 应出整词氧气')
})
T('词库 tsg→碳酸钙（简拼）', () => {
  const r = SimpleInputMethod.getHanzi('tsg', 'cn')
  assert((r.multi.words || []).indexOf('碳酸钙') !== -1, 'tsg 应出整词碳酸钙')
})
T('词库 tansuangai→碳酸钙（全拼连打）', () => {
  const r = SimpleInputMethod.getHanzi('tansuangai', 'cn')
  assert((r.multi.words || []).indexOf('碳酸钙') !== -1)
})
T('词库 lv→铝（多词同拼合并）', () => {
  const w = getWords()
  assert(Array.isArray(w['lv']) && w['lv'].indexOf('铝') !== -1)
})
T('词库 fanying 反应族齐备', () => {
  const w = getWords()
  for (const k of ['fenjiefanying', 'huahefanying', 'zhihuanfanying', 'fufenjiefanying']) {
    assert(w[k], k + ' 应在词库中')
  }
})
T('词库 仪器与概念词齐备', () => {
  const w = getWords()
  for (const k of ['shiguan', 'rongjiedu', 'jiqiping', 'jiujingdeng', 'baoherongye']) {
    assert(w[k], k + ' 应在词库中')
  }
})

console.log('\n==== RESULT:', pass, 'passed,', fail, 'failed ====')
process.exit(fail ? 1 : 0)
