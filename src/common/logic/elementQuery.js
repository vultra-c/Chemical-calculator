/**
 * 化学计算器 - 元素查询模块
 * 输入一个或多个元素（如 Fe、Fe O、Na C O），本地检索含有这些元素的方程式
 * （输入几个元素，方程式就必须同时含有这几个元素）
 *
 * 性能：元素集合与中文反查表在首次查询时惰性构建一次；
 * 方程式展示文本走 fmt.equationText 的挂载缓存，滚动分块渲染零重复解析。
 */
import { ELEMENT_BANK } from './elementBank.js'
import { ATOMIC_MASSES } from './elements.js'
import { parseFormula, molarMass } from './parser.js'
import { equationText } from './fmt.js'

export { equationText } from './fmt.js'

/** 已知元素符号集合（用于校验输入） */
export const ELEMENT_SYMBOLS = Object.keys(ATOMIC_MASSES)

/** 中文元素名 → 元素符号（氧→O、铁→Fe …，供元素查询输入；118 全量） */
export const ELEMENT_CN = {
  '氢': 'H', '氦': 'He', '锂': 'Li', '铍': 'Be', '硼': 'B',
  '碳': 'C', '氮': 'N', '氧': 'O', '氟': 'F', '氖': 'Ne',
  '钠': 'Na', '镁': 'Mg', '铝': 'Al', '硅': 'Si', '磷': 'P',
  '硫': 'S', '氯': 'Cl', '氩': 'Ar', '钾': 'K', '钙': 'Ca',
  '钪': 'Sc', '钛': 'Ti', '钒': 'V', '铬': 'Cr', '锰': 'Mn',
  '铁': 'Fe', '钴': 'Co', '镍': 'Ni', '铜': 'Cu', '锌': 'Zn',
  '镓': 'Ga', '锗': 'Ge', '砷': 'As', '硒': 'Se', '溴': 'Br',
  '氪': 'Kr', '铷': 'Rb', '锶': 'Sr', '钇': 'Y', '锆': 'Zr',
  '铌': 'Nb', '钼': 'Mo', '锝': 'Tc', '钌': 'Ru', '铑': 'Rh',
  '钯': 'Pd', '银': 'Ag', '镉': 'Cd', '铟': 'In', '锡': 'Sn',
  '锑': 'Sb', '碲': 'Te', '碘': 'I', '氙': 'Xe', '铯': 'Cs',
  '钡': 'Ba', '镧': 'La', '铈': 'Ce', '镨': 'Pr', '钕': 'Nd',
  '钷': 'Pm', '钐': 'Sm', '铕': 'Eu', '钆': 'Gd', '铽': 'Tb',
  '镝': 'Dy', '钬': 'Ho', '铒': 'Er', '铥': 'Tm', '镱': 'Yb',
  '镥': 'Lu', '铪': 'Hf', '钽': 'Ta', '钨': 'W', '铼': 'Re',
  '锇': 'Os', '铱': 'Ir', '铂': 'Pt', '金': 'Au', '汞': 'Hg',
  '铊': 'Tl', '铅': 'Pb', '铋': 'Bi', '钋': 'Po', '砹': 'At',
  '氡': 'Rn', '钫': 'Fr', '镭': 'Ra', '锕': 'Ac', '钍': 'Th',
  '镤': 'Pa', '铀': 'U', '镎': 'Np', '钚': 'Pu', '镅': 'Am',
  '锔': 'Cm', '锫': 'Bk', '锎': 'Cf', '锿': 'Es', '镄': 'Fm',
  '钔': 'Md', '锘': 'No', '铹': 'Lr'
}
// 104-118 号超重元素中文名为扩展区生僻字（初中不考），用标准字形收录：
// 𬬻 Rf、𬭊 Db、𬭳 Sg、𬭛 Bh、𬭶 Hs、鿏 Mt、𫟼 Ds、𬬭 Rg、鿔 Cn、鿭 Nh、𫓧 Fl、镆 Mc、𫟷 Lv、鿬 Ts、鿫 Og
ELEMENT_CN['𬬻'] = 'Rf'; ELEMENT_CN['𬭊'] = 'Db'; ELEMENT_CN['𬭳'] = 'Sg'
ELEMENT_CN['𬭛'] = 'Bh'; ELEMENT_CN['𬭶'] = 'Hs'; ELEMENT_CN['鿏'] = 'Mt'
ELEMENT_CN['𫟼'] = 'Ds'; ELEMENT_CN['𬬭'] = 'Rg'; ELEMENT_CN['鿔'] = 'Cn'
ELEMENT_CN['鿭'] = 'Nh'; ELEMENT_CN['𫓧'] = 'Fl'; ELEMENT_CN['镆'] = 'Mc'
ELEMENT_CN['𫟷'] = 'Lv'; ELEMENT_CN['鿬'] = 'Ts'; ELEMENT_CN['鿫'] = 'Og'

/**
 * 英文符号联想前缀索引：已下沉至 elements.js（englishSymbolIndex），
 * 键盘组件直接引用轻量 elements.js，避免本模块牵入完整反应库进键盘 bundle。
 */

/** 元素符号规范化：fe → Fe，h2o 里的输入不管；只处理单个符号 */
export function normalizeSymbol(s) {
  const t = String(s || '').trim()
  if (!t) return ''
  // 首字母大写、其余小写
  const sym = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
  return ELEMENT_SYMBOLS.indexOf(sym) !== -1 ? sym : ''
}

/**
 * 解析元素查询输入
 * 支持英文元素符号（Fe / fe+o）与中文物质名（铁 / 氧气 / 碳酸钙），可混输。
 * @param {string} raw 如 "Fe O" / "fe+o" / "铁 氧" / "氧气 铁"
 * @param {Object} [nameMap] 中文名 → 化学式 映射（substances.NAME_MAP）
 * @returns {{ok:true, elems:string[]}|{ok:false, error:string}}
 */
export function parseElementQuery(raw, nameMap) {
  const s = String(raw || '').trim()
  if (!s) return { ok: false, error: '请输入元素或名称，如 Fe O 或 铁 氧' }
  const tokens = s.split(/[\s+,，]+/).filter(Boolean)
  if (tokens.length === 0) return { ok: false, error: '请输入元素或名称' }
  const elems = []
  const pushElem = (sym) => {
    if (elems.indexOf(sym) === -1) elems.push(sym)
  }
  for (const t of tokens) {
    // 中文物质名 → 化学式 → 组成元素（如 氧气 → O；碳酸钙 → Ca,C,O）
    if (/[\u4e00-\u9fa5]/.test(t)) {
      const formula = nameMap ? nameMap[t] : null
      if (formula) {
        const pr = parseFormula(formula)
        if (!pr.ok) return { ok: false, error: '无法识别物质：' + t }
        for (const k in pr.counts) pushElem(k)
        continue
      }
      // 单个元素的中文名（氧 → O、铁 → Fe）
      const sym = ELEMENT_CN[t]
      if (sym && ELEMENT_SYMBOLS.indexOf(sym) !== -1) {
        pushElem(sym)
        continue
      }
      return { ok: false, error: '无法识别物质：' + t }
    }
    const sym = normalizeSymbol(t)
    if (!sym) return { ok: false, error: '无法识别元素：' + t }
    pushElem(sym)
  }
  return { ok: true, elems }
}

/**
 * 搜索含有全部指定元素的方程式
 * 元素集合索引在首次搜索时构建一次（每条 entry 预存为数组，避免重复 split）。
 * @param {string[]} elems 如 ['Fe','O']
 * @param {number} limit 返回条数上限
 * @returns {Array} 匹配的方程式条目 [{r,p,c,t,n,e, full}]
 */
let _ready = false
function ensureIndex() {
  if (_ready) return
  _ready = true
  for (let i = 0; i < ELEMENT_BANK.length; i++) {
    const entry = ELEMENT_BANK[i]
    // 挂载非序列化辅助字段；entry 仅作本地数据用，不参与传输
    try { entry._elems = entry.e.split(' ') } catch (err) { /* ignore */ }
  }
}

export function searchEquations(elems, limit = 30) {
  if (!elems || elems.length === 0) return []
  ensureIndex()
  const results = []
  for (const entry of ELEMENT_BANK) {
    const inSet = entry._elems
    let all = true
    for (const e of elems) {
      if (inSet.indexOf(e) === -1) { all = false; break }
    }
    if (all) results.push(entry)
    if (results.length >= limit) break
  }
  return results
}

/** 把元素集合（空格分隔）转成逗号分隔显示，如 "Fe O" → "Fe、O" */
export function formatElems(elemStr) {
  return elemStr.split(' ').join('、')
}

/**
 * 由银行条目重建 reaction 对象（供结果页/质量页使用）
 * segs 缓存在 entry._segs 上，mr 缓存在 entry._mr 上：
 * 同一条目从「方程式列表」进入结果页再进质量页，解析只发生一次。
 * @returns {Object} {reactants, products, coefs, mr, segs, type, cond}
 */
export function buildReactionFromBank(entry) {
  if (!entry._segs) {
    const all = entry.r.concat(entry.p)
    try {
      const parsed = all.map(f => parseFormula(f))
      entry._segs = parsed.map(p => p.segs)
      entry._mr = parsed.map(p => molarMass(p.counts))
    } catch (err) { /* ignore */ }
  }
  return {
    reactants: entry.r.slice(),
    products: entry.p.slice(),
    coefs: entry.c.slice(),
    mr: entry._mr.slice(),
    segs: entry._segs,
    type: entry.t,
    cond: entry.n
  }
}
