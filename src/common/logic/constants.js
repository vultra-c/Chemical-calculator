/**
 * 化学工具箱 · 常量显示（设置中心 → 常量显示）
 * 纯数据模块，无 @system.* 依赖，Node 可直接测试。
 * name：常量名（含符号说明）；value：数值与单位；note：适用条件备注（可为空）。
 */
export const CONSTANTS = [
  { name: '阿伏伽德罗常数 N_A', value: '6.022×10²³ /mol', note: '' },
  { name: '气体摩尔体积 V_m', value: '22.4 L/mol', note: '标准状况（0 ℃、101 kPa）' },
  { name: '摩尔气体常数 R', value: '8.314 J·mol⁻¹·K⁻¹', note: '' },
  { name: '法拉第常数 F', value: '96485 C/mol', note: '' },
  { name: '标准状况温度', value: '273.15 K（0 ℃）', note: '' },
  { name: '水的离子积 K_w', value: '1.0×10⁻¹⁴', note: '25 ℃' }
]
