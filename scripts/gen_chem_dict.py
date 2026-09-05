#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
化学工具箱 · 化学专属输入词库生成器

把 InputMethod 的通用连打词库（dic_words.js + dic_words_initials.js，约 3000 词 / 110KB）
替换为化学专属词库（约 220 词 / 14KB）：
- 词汇来源：substances.NAME_MAP 全部中文物质名 + 41 个元素中文名 + 化学常用术语
- 注音：pypinyin（Style.NORMAL 无声调），ü 归一为 v，与 dic.js 的拼音键一致
- 输出格式与原库完全一致（连续全拼 → 词；简拼首字母串 → 词键列表），工厂函数惰性加载

用法：
  python3 scripts/gen_chem_dict.py
"""
import json
import re
from pathlib import Path
from pypinyin import lazy_pinyin, Style

ROOT = Path(__file__).resolve().parent.parent
SUBSTANCES = ROOT / 'src' / 'common' / 'logic' / 'substances.js'
ELEMENT_QUERY = ROOT / 'src' / 'common' / 'logic' / 'elementQuery.js'
ASSETS = ROOT / 'src' / 'components' / 'InputMethod' / 'assets'

# ---- 1) NAME_MAP 中全部中文物质名/别名 ----
src = SUBSTANCES.read_text(encoding='utf-8')
name_map_block = src[src.index('export const NAME_MAP'):src.index('/** 目录分组')]
names = re.findall(r"'([^']+)'\s*:", name_map_block)

# ---- 2) 元素中文名：自动扫描 elementQuery.js 的 ELEMENT_CN（118 全量，与源码单一数据源同步） ----
eq_src = ELEMENT_QUERY.read_text(encoding='utf-8')
ELEMENTS = re.findall(r"'([^']+)'\s*:\s*'[A-Z][a-z]?'", eq_src)

# ---- 3) 化学常用术语（反应类型 / 实验条件 / 计量与操作 / 考试考点） ----
TERMS = [
    # 反应类型（与 elementBank/reactions 中的分类一致）
    '化合反应', '分解反应', '置换反应', '复分解反应',
    '中和反应', '氧化还原反应', '氧化反应', '还原反应',
    # 实验条件
    '加热', '高温', '点燃', '通电', '电解', '催化剂', '催化',
    # 状态与现象
    '沉淀', '气体', '溶液', '固体', '液体', '浑浊', '气泡',
    '变浑浊', '白烟', '火星四射', '淡蓝色', '蓝色火焰', '红热',
    '缓慢氧化', '剧烈燃烧', '复燃', '爆鸣',
    # 计量与概念
    '质量', '摩尔', '摩尔质量', '物质的量', '相对分子质量',
    '化学式', '方程式', '化学方程式', '配平', '系数',
    '化合价', '原子', '分子', '离子', '离子符号', '原子序数',
    '元素周期表', '相对原子质量', '质量分数', '溶质质量分数',
    # 实验操作高频词
    '实验室', '制取', '收集', '检验', '验满', '验纯', '燃烧', '熄灭',
    '澄清石灰水', '过氧化氢', '排水法', '排水集气法',
    '向上排空气法', '向下排空气法',
    '制取氧气', '制取二氧化碳', '制取氢气',
    '石蕊', '酚酞', '红色石蕊试纸', '滴加', '振荡',
    # 实验仪器（中学高频）
    '试管', '烧杯', '烧瓶', '锥形瓶', '集气瓶', '量筒', '水槽',
    '漏斗', '长颈漏斗', '分液漏斗', '酒精灯', '玻璃棒', '导管',
    '胶头滴管', '药匙', '镊子', '坩埚', '蒸发皿', '石棉网',
    '铁架台', '燃烧匙', '托盘天平',
    # 溶液与基本概念
    '溶解度', '饱和溶液', '不饱和溶液', '溶质', '溶剂',
    '结晶', '结晶水', '过滤', '蒸发', '蒸馏', '吸附', '潮解', '风化',
    '难溶于水', '不易溶于水', '易溶于水', '微溶于水',
    '合金', '指示剂', '酸碱指示剂', '金属活动性顺序', '活动性顺序',
    '酸碱盐', '氧化物', '酸性氧化物', '碱性氧化物', '酸碱中和',
    '不完全燃烧', '不充分燃烧',
]


def pinyin_of(word):
    """整词连续全拼（无声调、ü→v），与 dic.js 键规范一致。"""
    parts = lazy_pinyin(word, style=Style.NORMAL, errors=lambda x: list(x))
    return ''.join(parts).replace('ü', 'v')


def build():
    # 汇总去重（保持输入顺序：物质名 → 元素 → 术语）
    seen = set()
    words = []
    for w in names + ELEMENTS + TERMS:
        if w and w not in seen:
            seen.add(w)
            words.append(w)

    # 全拼 → 词（同拼多词合并为数组，与原库格式一致）
    py_map = {}
    for w in words:
        py = pinyin_of(w)
        if not py or not py.isascii():
            continue  # 跳过无法注音的条目
        cur = py_map.get(py)
        if cur is None:
            py_map[py] = w
        elif isinstance(cur, list):
            if w not in cur:
                cur.append(w)
        else:
            if w != cur:
                py_map[py] = [cur, w]

    # 简拼（各音节首字母连写）→ 全拼键列表（仅多音节词）
    initials = {}
    for w in words:
        syls = lazy_pinyin(w, style=Style.NORMAL, errors=lambda x: list(x))
        if len(syls) < 2:
            continue
        py = ''.join(syls).replace('ü', 'v')
        if py not in py_map:
            continue
        abbr = ''.join(s[0] for s in syls if s)
        if not abbr:
            continue
        bucket = initials.setdefault(abbr, [])
        if py not in bucket:
            bucket.append(py)

    def fmt_value(v):
        return json.dumps(v, ensure_ascii=False)

    words_entries = ',\n  '.join(
        f'{json.dumps(k, ensure_ascii=False)}: {fmt_value(v)}'
        for k, v in sorted(py_map.items())
    )
    initials_entries = ',\n  '.join(
        f'{json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}'
        for k, v in sorted(initials.items())
    )

    dic_words = f'''/**
 * 化学专属整词词库（scripts/gen_chem_dict.py 自动生成，勿手改）。
 * key 为连续全拼（无空格、无隔音符，全小写，ü→v），value 为对应词。
 * 词表 = NAME_MAP 全部物质名 + 41 元素名 + 化学常用术语，共 {len(py_map)} 个全拼键。
 * 相比原通用词库（约 3000 词 / 110KB），初始化内存与 forwardIndex 构建成本大幅降低。
 * 惰性加载：对象在首次 getWords() 时才创建。
 */
let _words = null;
function getWords() {{
  if (_words) return _words;
  _words = {{
  {words_entries}
  }};
  return _words;
}}

export {{ getWords }}
'''

    dic_initials = f'''/**
 * 化学专属整词简拼倒排索引（scripts/gen_chem_dict.py 自动生成，勿手改）：首字母串 → 词键列表。
 * initDict 直接赋值 initialsIndex，避免 init 时逐词切分。
 * 由与 dicUtil.segmentPinyin 一致的贪心切分生成，仅含多音节词。
 */
let _initialsIndex = null;
function getInitialsIndex() {{
  if (_initialsIndex) return _initialsIndex;
  _initialsIndex = {{
  {initials_entries}
  }};
  return _initialsIndex;
}}

export {{ getInitialsIndex }}
'''

    (ASSETS / 'dic_words.js').write_text(dic_words, encoding='utf-8')
    (ASSETS / 'dic_words_initials.js').write_text(dic_initials, encoding='utf-8')
    print(f'words: {len(py_map)} keys, initials: {len(initials)} keys')
    print(f'dic_words.js: {(ASSETS / "dic_words.js").stat().st_size} bytes')
    print(f'dic_words_initials.js: {(ASSETS / "dic_words_initials.js").stat().st_size} bytes')


if __name__ == '__main__':
    build()
