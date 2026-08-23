/**
 * 零依赖应用图标生成器：分子主题图标 → src/icon.png（192×192 PNG）
 * 运行：npm run gen:icon
 */
import zlib from 'node:zlib'
import fs from 'node:fs'

const SIZE = 192
const SS = 3 // 超采样倍数
const W = SIZE * SS

function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

// 颜色
const BG_TOP = [13, 20, 30]
const BG_BOT = [18, 36, 43]
const TEAL = [52, 211, 153]
const AMBER = [251, 191, 36]
const BLUE = [96, 165, 250]
const BOND = [154, 230, 196]

function insideRounded(x, y) {
  const r = 44 * SS
  const max = W - 1
  if (x < r && y < r && Math.hypot(x - r, y - r) > r) return false
  if (x > max - r && y < r && Math.hypot(x - (max - r), y - r) > r) return false
  if (x < r && y > max - r && Math.hypot(x - r, y - (max - r)) > r) return false
  if (x > max - r && y > max - r && Math.hypot(x - (max - r), y - (max - r)) > r) return false
  return true
}

function inCircle(px, py, cx, cy, r) {
  const d = Math.hypot(px - cx, py - cy)
  return d <= r
}

function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ]
}

// 场景坐标（基于 W）
const A = { x: 0.34 * W, y: 0.60 * W, r: 0.155 * W } // 主原子（大）
const B = { x: 0.66 * W, y: 0.38 * W, r: 0.10 * W } // 原子（中）
const C = { x: 0.63 * W, y: 0.72 * W, r: 0.072 * W } // 原子（小）
const BOND_W = 0.030 * W / 2

function sample(px, py) {
  if (!insideRounded(px, py)) return [0, 0, 0, 0]
  let col = mix(BG_TOP, BG_BOT, py / W)
  // 化学键
  if (segDist(px, py, A.x, A.y, B.x, B.y) < BOND_W) col = BOND
  else if (segDist(px, py, A.x, A.y, C.x, C.y) < BOND_W * 0.9) col = BOND
  // 原子
  if (inCircle(px, py, A.x, A.y, A.r)) {
    col = TEAL
    if (Math.hypot(px - (A.x - A.r * 0.35), py - (A.y - A.r * 0.38)) < A.r * 0.22) col = [214, 255, 238]
  }
  if (inCircle(px, py, B.x, B.y, B.r)) {
    col = AMBER
    if (Math.hypot(px - (B.x - B.r * 0.3), py - (B.y - B.r * 0.35)) < B.r * 0.2) col = [253, 230, 158]
  }
  if (inCircle(px, py, C.x, C.y, C.r)) col = BLUE
  return [col[0], col[1], col[2], 255]
}

/* 渲染 + 超采样降采样 */
const raw = Buffer.alloc(SIZE * SIZE * 4)
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0
    let g = 0
    let b = 0
    let a = 0
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const p = sample(x * SS + sx + 0.5, y * SS + sy + 0.5)
        r += p[0]
        g += p[1]
        b += p[2]
        a += p[3]
      }
    }
    const n = SS * SS
    const o = (y * SIZE + x) * 4
    raw[o] = clamp(Math.round(r / n))
    raw[o + 1] = clamp(Math.round(g / n))
    raw[o + 2] = clamp(Math.round(b / n))
    raw[o + 3] = clamp(Math.round(a / n))
  }
}

/* PNG 编码 */
const CRC_TABLE = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c
}
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // RGBA
const stride = SIZE * 4
const scanlined = Buffer.alloc((stride + 1) * SIZE)
for (let y = 0; y < SIZE; y++) {
  scanlined[y * (stride + 1)] = 0
  raw.copy(scanlined, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(scanlined, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])
fs.writeFileSync(new URL('../src/icon.png', import.meta.url).pathname, png)
console.log('icon.png generated:', png.length, 'bytes')
