/**
 * 元素相对原子质量数据库（纯离线）
 * mass 采用 IUPAC 常用标准值，保留 3~4 位有效精度，满足中学/常规计算。
 */
export const ELEMENTS = [
  { z: 1, symbol: 'H', name: '氢', mass: 1.008 },
  { z: 2, symbol: 'He', name: '氦', mass: 4.003 },
  { z: 3, symbol: 'Li', name: '锂', mass: 6.94 },
  { z: 4, symbol: 'Be', name: '铍', mass: 9.012 },
  { z: 5, symbol: 'B', name: '硼', mass: 10.81 },
  { z: 6, symbol: 'C', name: '碳', mass: 12.011 },
  { z: 7, symbol: 'N', name: '氮', mass: 14.007 },
  { z: 8, symbol: 'O', name: '氧', mass: 15.999 },
  { z: 9, symbol: 'F', name: '氟', mass: 18.998 },
  { z: 10, symbol: 'Ne', name: '氖', mass: 20.18 },
  { z: 11, symbol: 'Na', name: '钠', mass: 22.99 },
  { z: 12, symbol: 'Mg', name: '镁', mass: 24.305 },
  { z: 13, symbol: 'Al', name: '铝', mass: 26.982 },
  { z: 14, symbol: 'Si', name: '硅', mass: 28.085 },
  { z: 15, symbol: 'P', name: '磷', mass: 30.974 },
  { z: 16, symbol: 'S', name: '硫', mass: 32.06 },
  { z: 17, symbol: 'Cl', name: '氯', mass: 35.45 },
  { z: 18, symbol: 'Ar', name: '氩', mass: 39.948 },
  { z: 19, symbol: 'K', name: '钾', mass: 39.098 },
  { z: 20, symbol: 'Ca', name: '钙', mass: 40.078 },
  { z: 21, symbol: 'Sc', name: '钪', mass: 44.956 },
  { z: 22, symbol: 'Ti', name: '钛', mass: 47.867 },
  { z: 23, symbol: 'V', name: '钒', mass: 50.942 },
  { z: 24, symbol: 'Cr', name: '铬', mass: 51.996 },
  { z: 25, symbol: 'Mn', name: '锰', mass: 54.938 },
  { z: 26, symbol: 'Fe', name: '铁', mass: 55.845 },
  { z: 27, symbol: 'Co', name: '钴', mass: 58.933 },
  { z: 28, symbol: 'Ni', name: '镍', mass: 58.693 },
  { z: 29, symbol: 'Cu', name: '铜', mass: 63.546 },
  { z: 30, symbol: 'Zn', name: '锌', mass: 65.38 },
  { z: 31, symbol: 'Ga', name: '镓', mass: 69.723 },
  { z: 32, symbol: 'Ge', name: '锗', mass: 72.63 },
  { z: 33, symbol: 'As', name: '砷', mass: 74.922 },
  { z: 34, symbol: 'Se', name: '硒', mass: 78.971 },
  { z: 35, symbol: 'Br', name: '溴', mass: 79.904 },
  { z: 36, symbol: 'Kr', name: '氪', mass: 83.798 },
  { z: 37, symbol: 'Rb', name: '铷', mass: 85.468 },
  { z: 38, symbol: 'Sr', name: '锶', mass: 87.62 },
  { z: 39, symbol: 'Y', name: '钇', mass: 88.906 },
  { z: 40, symbol: 'Zr', name: '锆', mass: 91.224 },
  { z: 41, symbol: 'Nb', name: '铌', mass: 92.906 },
  { z: 42, symbol: 'Mo', name: '钼', mass: 95.95 },
  { z: 44, symbol: 'Ru', name: '钌', mass: 101.07 },
  { z: 45, symbol: 'Rh', name: '铑', mass: 102.906 },
  { z: 46, symbol: 'Pd', name: '钯', mass: 106.42 },
  { z: 47, symbol: 'Ag', name: '银', mass: 107.868 },
  { z: 48, symbol: 'Cd', name: '镉', mass: 112.411 },
  { z: 49, symbol: 'In', name: '铟', mass: 114.818 },
  { z: 50, symbol: 'Sn', name: '锡', mass: 118.71 },
  { z: 51, symbol: 'Sb', name: '锑', mass: 121.76 },
  { z: 52, symbol: 'Te', name: '碲', mass: 127.6 },
  { z: 53, symbol: 'I', name: '碘', mass: 126.905 },
  { z: 54, symbol: 'Xe', name: '氙', mass: 131.293 },
  { z: 55, symbol: 'Cs', name: '铯', mass: 132.905 },
  { z: 56, symbol: 'Ba', name: '钡', mass: 137.327 },
  { z: 57, symbol: 'La', name: '镧', mass: 138.905 },
  { z: 58, symbol: 'Ce', name: '铈', mass: 140.116 },
  { z: 74, symbol: 'W', name: '钨', mass: 183.84 },
  { z: 78, symbol: 'Pt', name: '铂', mass: 195.084 },
  { z: 79, symbol: 'Au', name: '金', mass: 196.967 },
  { z: 80, symbol: 'Hg', name: '汞', mass: 200.59 },
  { z: 81, symbol: 'Tl', name: '铊', mass: 204.383 },
  { z: 82, symbol: 'Pb', name: '铅', mass: 207.2 },
  { z: 83, symbol: 'Bi', name: '铋', mass: 208.98 },
  { z: 88, symbol: 'Ra', name: '镭', mass: 226 },
  { z: 90, symbol: 'Th', name: '钍', mass: 232.038 },
  { z: 92, symbol: 'U', name: '铀', mass: 238.029 }
]

const bySymbol = new Map(ELEMENTS.map((e) => [e.symbol, e]))

export function getElement(symbol) {
  return bySymbol.get(symbol) || null
}

export function isKnownElement(symbol) {
  return bySymbol.has(symbol)
}
