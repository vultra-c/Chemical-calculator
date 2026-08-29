/**
 * 化学工具箱 · 应用设置（@system.storage 持久化）
 *
 * 存储键 chem_settings → JSON：{ precision: 1|2|3 }
 * precision = 质量/相对分子质量等「计算结果」显示的小数位数（默认 3，与旧行为一致）。
 *
 * 用法：
 *   loadSettings(cb)  页面 onInit 调一次（带缓存，后续秒回）
 *   saveSettings(obj) 设置页写入
 *   fmtOut(v)         代替 parser.fmtNum 做最终展示格式化
 *
 * 注意：本模块依赖 @system.storage，只能在页面（.ux）里 import，
 * common/logic 下被 Node 冒烟测试 import 的模块（parser/reactions 等）
 * 不得依赖本模块（Node 环境没有 @system.*）。
 */
import storage from '@system.storage'

const KEY = 'chem_settings'
const DEF = { precision: 3 }
let cache = null

export function loadSettings(cb) {
  if (cache) { cb && cb(cache); return }
  storage.get({
    key: KEY,
    success: (data) => {
      cache = Object.assign({}, DEF)
      try { if (data) Object.assign(cache, JSON.parse(data)) } catch (e) { /* 数据损坏回默认 */ }
      cb && cb(cache)
    },
    fail: () => {
      cache = Object.assign({}, DEF)
      cb && cb(cache)
    }
  })
}

export function saveSettings(next, cb) {
  cache = Object.assign({}, DEF, next)
  storage.set({
    key: KEY,
    value: JSON.stringify(cache),
    success: () => cb && cb(true),
    fail: () => cb && cb(false)
  })
}

export function getPrecision() {
  return (cache && cache.precision) || DEF.precision
}

/** 按当前精度格式化展示数值（未加载完成时先用默认 3 位，与旧 fmtNum 输出一致） */
export function fmtOut(v) {
  if (!isFinite(v)) return '--'
  const k = Math.pow(10, getPrecision())
  return String(Math.round(v * k) / k)
}
