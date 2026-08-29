#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""化学工具箱 · 应用图标生成器（128×128，SDF 抗锯齿，纯 zlib PNG）。

设计：深色圆角底板 + 细白描边锥形瓶 + 蓝色渐变液体（波浪液面 + 上升气泡 + 气泡highlight）。
风格对齐应用视觉令牌：背景近黑、强调蓝 #0D6EFF 系。

用法：python3 scripts/gen_icon.py  → 覆盖写 src/common/images/icon.png
"""
import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'src' / 'common' / 'images' / 'icon.png'
W, H = 128, 128


def clamp(v, a=0.0, b=1.0):
    return a if v < a else (b if v > b else v)


def mix(c1, c2, t):
    return tuple(c1[i] + (c2[i] - c1[i]) * t for i in range(3))


def sd_round_rect(x, y, cx, cy, w, h, r):
    qx = abs(x - cx) - (w / 2 - r)
    qy = abs(y - cy) - (h / 2 - r)
    ox, oy = max(qx, 0.0), max(qy, 0.0)
    return math.hypot(ox, oy) + min(max(qx, qy), 0.0) - r


def sd_segment(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    t = clamp(((px - ax) * dx + (py - ay) * dy) / l2) if l2 else 0.0
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def sd_polygon(px, py, poly):
    """带符号多边形距离（负=内）。射线法判内外 + 最近边距离。"""
    n = len(poly)
    inside = False
    dmin = 1e9
    for i in range(n):
        ax, ay = poly[i]
        bx, by = poly[(i + 1) % n]
        dmin = min(dmin, sd_segment(px, py, ax, ay, bx, by))
        if (ay > py) != (by > py):
            xint = ax + (py - ay) / (by - ay) * (bx - ax)
            if px < xint:
                inside = not inside
    return -dmin if inside else dmin


def sd_circle(px, py, cx, cy, r):
    return math.hypot(px - cx, py - cy) - r


# ---- 几何定义（视图框 128） ----
# 锥形瓶外轮廓：细颈圆顶 → 斜肩 → 微鼓瓶身 → 圆底
NECK_HALF = 13.5      # 颈宽一半
NECK_TOP_Y = 18.0     # 瓶口
SHOULDER_Y = 58.0     # 颈底/肩线
BASE_HALF = 43.0      # 瓶底半宽
BASE_Y = 108.0        # 瓶底
CX = 64.0
FLASK_POLY = [
    (CX - NECK_HALF, NECK_TOP_Y + 6),   # 左上颈
    (CX - NECK_HALF, SHOULDER_Y),
    (CX - BASE_HALF, BASE_Y - 10),
    (CX - BASE_HALF, BASE_Y),
    (CX + BASE_HALF, BASE_Y),
    (CX + BASE_HALF, BASE_Y - 10),
    (CX + NECK_HALF, SHOULDER_Y),
    (CX + NECK_HALF, NECK_TOP_Y + 6),
]
NECK_CAP = (CX, NECK_TOP_Y + 6, NECK_HALF)          # 瓶口圆弧
LIQ_TOP = 60.0                                       # 液面中心高度
LIQ_WAVE_A, LIQ_WAVE_K = 3.2, 2 * math.pi / 56.0     # 波浪幅度/波数

BG_TOP = (0x24, 0x26, 0x2b)     # 底板顶色（微亮的石墨）
BG_BOT = (0x0a, 0x0b, 0x0d)
GLASS = (0xf2, 0xf6, 0xff)      # 玻璃描边
GLASS_A = 0.92
LIQ_TOP_C = (0x4e, 0xa6, 0xff)  # 液体顶色
LIQ_BOT_C = (0x07, 0x4c, 0xd8)  # 液体底色
BUBBLES = [                       # 液体中上升气泡 (cx, cy, r)
    (CX - 15, 97, 4.2), (CX - 5, 90, 3.0), (CX + 8, 96, 5.0),
    (CX + 14, 88, 3.4), (CX - 19, 88, 3.2), (CX - 2, 99, 2.6),
]
DROPS = [                         # 颈内小泡（玻璃内液面上方空间）
    (CX, 52, 3.0), (CX + 4, 44, 2.2),
]
MIST = [                          # 瓶口逸出泡（玻璃外）
    (CX - 3, 10, 2.6), (CX + 9, 16, 2.0),
]


def alpha_from_d(d, w=1.05):
    return clamp(0.5 - d / (2 * w))


def render():
    px = bytearray(W * H * 4)
    for y in range(H):
        for x in range(W):
            fx, fy = x + 0.5, y + 0.5
            # 1) 圆角底板（半径 30）+ 顶端微亮渐变
            d_bg = sd_round_rect(fx, fy, CX, 64, 124, 124, 30)
            a_bg = alpha_from_d(d_bg)
            t = fy / H
            bgc = mix(BG_TOP, BG_BOT, t)
            r, g, b, a = bgc[0], bgc[1], bgc[2], 255 * a_bg

            # 2) 液体：瓶身内（内缩 6px 留出玻璃壁），液面为波浪线
            wave = LIQ_TOP + LIQ_WAVE_A * math.sin((fx) * LIQ_WAVE_K + 0.6)
            d_flask_in = sd_polygon(fx, fy, FLASK_POLY) + 6.0
            liq_a = alpha_from_d(d_flask_in, 1.0) * (1.0 if fy >= wave else alpha_from_d(wave - fy, 1.4))
            if liq_a > 0:
                lt = clamp((fy - wave) / (BASE_Y - wave))
                lc = mix(LIQ_TOP_C, LIQ_BOT_C, lt)
                # 液面亮线
                edge = alpha_from_d(abs(fy - wave) - 1.2, 0.9) * 0.55
                lc = mix(lc, (0xBF, 0xE3, 0xFF), edge)
                k = liq_a * 0.96
                r = r * (1 - k) + lc[0] * k
                g = g * (1 - k) + lc[1] * k
                b = b * (1 - k) + lc[2] * k

            # 3) 液体中的气泡（白圈：浅色边环 + 微透明心）
            for (bx, by_, br) in BUBBLES:
                d_b = sd_circle(fx, fy, bx, by_, br)
                ring = alpha_from_d(sd_circle(fx, fy, bx, by_, br)) * 0.85
                rim = alpha_from_d(abs(d_b) - 0.9, 0.8)
                k = clamp(ring * 0.28 + rim * 0.6)
                hd = sd_circle(fx, fy, bx - br * 0.38, by_ - br * 0.38, br * 0.26)
                k2 = alpha_from_d(hd) * 0.95
                r = r * (1 - k) + 0xEA * k
                g = g * (1 - k) + 0xF6 * k
                b = b * (1 - k) + 0xFF * k
                r = r * (1 - k2) + 0xFF * k2
                g = g * (1 - k2) + 0xFF * k2
                b = b * (1 - k2) + 0xFF * k2

            # 4) 玻璃描边：外轮廓 + 瓶口圆帽留白处描边
            d_stroke = sd_polygon(fx, fy, FLASK_POLY)
            d_cap = sd_circle(fx, fy, *NECK_CAP)
            ds = min(d_stroke, d_cap)
            ring_d = abs(ds) - 3.2
            sa = alpha_from_d(ring_d, 1.1) * GLASS_A
            # 内壁浅色细线（玻璃厚度感）
            inner = clamp(-d_stroke)
            inner_line = alpha_from_d(inner - 7.5, 1.0) * 0.28
            sa = clamp(sa + inner_line)
            # 高光：左上肩线侧
            k = sa
            hl = GLASS
            r = r * (1 - k) + hl[0] * k
            g = g * (1 - k) + hl[1] * k
            b = b * (1 - k) + hl[2] * k

            # 5) 颈内液面小泡与瓶口逸出泡
            for (bx, by_, br) in DROPS + MIST:
                d_b = sd_circle(fx, fy, bx, by_, br)
                k = alpha_from_d(d_b) * 0.85
                r = r * (1 - k) + 0x9C * k
                g = g * (1 - k) + 0xC9 * k
                b = b * (1 - k) + 0xFF * k

            o = (y * W + x) * 4
            px[o:o + 4] = bytes((int(round(clamp(r, 0, 255))), int(round(clamp(g, 0, 255))),
                                 int(round(clamp(b, 0, 255))), int(round(clamp(a, 0, 255)))))
    return bytes(px)


def write_png(raw_rgba, path):
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    rows = b''.join(b'\x00' + raw_rgba[y * W * 4:(y + 1) * W * 4] for y in range(H))
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(rows, 9))
           + chunk(b'IEND', b''))
    path.write_bytes(png)
    print('written', path, len(png), 'bytes')


if __name__ == '__main__':
    write_png(render(), OUT)
