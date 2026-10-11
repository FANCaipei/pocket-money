/** 格式化与常量（与旧版 ui.js 语义一致） */

export const CATS = [
  { key: 'snack', emoji: '🍟', name: '零食', color: '#FF9500' },
  { key: 'toy',   emoji: '🧸', name: '玩具', color: '#AF52DE' },
  { key: 'study', emoji: '✏️', name: '文具', color: '#007AFF' },
  { key: 'book',  emoji: '📚', name: '图书', color: '#34C759' },
  { key: 'fun',   emoji: '🎮', name: '娱乐', color: '#5856D6' },
  { key: 'other', emoji: '🎁', name: '其他', color: '#8E8E93' },
];
export const catOf = (k) => CATS.find((c) => c.key === k) || CATS[5];

export const AVATARS = ['👧', '👦', '🧒', '👶', '🐱', '🐶', '🦊', '🐼', '🐯', '🐸', '🦄', '🚀'];
export const AVATAR_COLORS = ['#FF7EB3', '#5AC8FA', '#FFD60A', '#B9C0FF', '#A0F0C0', '#FFB3A7'];

export const RANGE_LABEL = { 7: '近1周', 30: '近1月', 90: '近3月' };

/** 分 -> ¥字符串 */
export function money(cents, opts = {}) {
  const c = Math.round(cents || 0);
  const neg = c < 0;
  const s = (Math.abs(c) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = opts.sign ? (neg ? '−' : '+') : (neg ? '−' : '');
  return sign + '¥' + s;
}

/** 元输入 -> 分（整数）；非法返回 NaN */
export function parseAmount(v) {
  const n = parseFloat(String(v ?? '').trim());
  if (!isFinite(n) || n <= 0) return NaN;
  return Math.round(n * 100);
}

// —— 日期工具（本地时区） ——
const pad = (n) => (n < 10 ? '0' + n : '' + n);
export function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
export function dateLabel(ds) {
  const today = todayStr();
  if (ds === today) return '今天';
  const [y, m, d] = today.split('-').map(Number);
  const yest = new Date(y, m - 1, d - 1);
  if (ds === yest.getFullYear() + '-' + pad(yest.getMonth() + 1) + '-' + pad(yest.getDate())) return '昨天';
  const [yy, mm, dd] = ds.split('-').map(Number);
  const wk = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(yy, mm - 1, dd).getDay()];
  return `${mm}月${dd}日 ${wk}`;
}
export function shortDate(ds) {
  const [, m, d] = ds.split('-').map(Number);
  return `${m}月${d}日`;
}
