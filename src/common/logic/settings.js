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
import brightness from '@system.brightness'
import app from '@system.app'

const KEY = 'chem_settings'
// keepScreenOn 常亮显示（应用内保屏）；vibrate 键盘振动反馈
const DEF = { precision: 3, keepScreenOn: false, vibrate: true }
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

export function getKeepScreenOn() {
  return cache ? !!cache.keepScreenOn : DEF.keepScreenOn
}

export function getVibrate() {
  return cache ? cache.vibrate !== false : DEF.vibrate
}

/**
 * 应用常亮设置（立即生效）。洛汐文档规约：先 canIUse 探能力再调接口，
 * 不支持/失败时回调 false 并带原因，调用方据此提示，不靠异常绕过。
 * 注意：快应用 setKeepScreenOn 仅约束本应用前台期间，退出后系统自动恢复，
 * 「记忆」靠应用启动时按持久化设置重新应用（见 app.ux onCreate）。
 */
export function applyKeepScreenOn(on, cb) {
  let usable = true
  try {
    usable = !!(app.canIUse && app.canIUse('@system.brightness.setKeepScreenOn'))
  } catch (e) { usable = true }
  if (!usable) { cb && cb(false, '当前设备不支持常亮设置'); return }
  brightness.setKeepScreenOn({
    keepScreenOn: !!on,
    success: () => cb && cb(true),
    fail: () => cb && cb(false, '常亮设置失败')
  })
}

/** 按当前精度格式化展示数值（未加载完成时先用默认 3 位，与旧 fmtNum 输出一致） */
export function fmtOut(v) {
  if (!isFinite(v)) return '--'
  const k = Math.pow(10, getPrecision())
  return String(Math.round(v * k) / k)
}
