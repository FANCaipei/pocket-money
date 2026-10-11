'use strict';

/**
 * 理财产品与收益计算。
 * 产品利率/周期为演示用途写死；金额单位一律为「分」（整数），避免浮点误差。
 * 收益按「天」结算：每持有满一天记 amount * rate / 365 分（四舍五入到分），
 * 当天买入不计息，次日开始产生收益（与真实银行计息习惯一致）。
 */

// —— 理财产品（利率写死，仅供演示） ——
const PRODUCTS = [
  { id: 'demand', name: '活期存钱罐', tag: '活期', rate: 0.010, termDays: 0,   risk: '低风险',   color: '#30B0C7', desc: '随存随取，每天产生收益' },
  { id: 'fix3',   name: '定期 3 个月', tag: '定期', rate: 0.020, termDays: 90,  risk: '低风险',   color: '#007AFF', desc: '到期后可赎回本息' },
  { id: 'fix6',   name: '定期 6 个月', tag: '定期', rate: 0.026, termDays: 180, risk: '低风险',   color: '#5856D6', desc: '利率更高，适合长期存' },
  { id: 'fix12',  name: '定期 1 年',   tag: '定期', rate: 0.032, termDays: 365, risk: '低风险',   color: '#AF52DE', desc: '长期定存，收益更高' },
  { id: 'fin90',  name: '稳健理财 90 天', tag: '理财', rate: 0.042, termDays: 90,  risk: '中低风险', color: '#FF9500', desc: '进阶理财，收益更高' },
  { id: 'fin180', name: '稳健理财 180 天', tag: '理财', rate: 0.048, termDays: 180, risk: '中低风险', color: '#FF375F', desc: '长期理财，坐享收益' },
];

function productById(id) {
  return PRODUCTS.find((p) => p.id === id) || null;
}

// —— 本地日期工具（YYYY-MM-DD 字符串，避免时区/夏令时坑） ——
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function fmtDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function todayStr() { return fmtDate(new Date()); }
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return fmtDate(new Date(y, m - 1, d + n));
}
/** b - a 的天数（用 UTC 计算，无夏令时干扰） */
function diffDays(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}
/** 返回较早 / 较晚的日期（diffDays(a,b) = b - a） */
function minDate(a, b) { return diffDays(a, b) <= 0 ? b : a; }
function maxDate(a, b) { return diffDays(a, b) >= 0 ? b : a; }

/**
 * 一笔投资在 [from, toExclusive) 区间内的收益（分）。
 * 计息上界自动取：赎回日 / 定期到期日 / 今天 三者的最小值。
 * 逐日累加（每天单独四舍五入），保证「收益序列之和 === 累计收益」。
 */
function incomeInDays(inv, from, toExclusive) {
  const today = todayStr();
  // 计息截止（不含）：赎回日、定期到期日、今天 三者取最小
  let end = inv.redeemedAt ? minDate(inv.redeemedAt, today) : today;
  if (inv.termDays > 0) end = minDate(end, addDays(inv.startDate, inv.termDays));
  let start = maxDate(inv.startDate, from);
  const last = minDate(toExclusive, end);
  if (diffDays(start, last) <= 0) return 0;
  const daily = Math.round(inv.amount * inv.rate / 365);
  let sum = 0;
  for (let d = start; diffDays(d, last) > 0; d = addDays(d, 1)) sum += daily;
  return sum;
}

/** 至今累计已产生收益（分），持有第一天到昨天 */
function accruedCents(inv) {
  return incomeInDays(inv, inv.startDate, addDays(todayStr(), 1));
}

/** 孩子的资产：现金（交易流水合计）+ 理财本金 + 理财累计收益 */
function childBalances(db, childId) {
  const cash = db.transactions
    .filter((t) => t.childId === childId)
    .reduce((s, t) => s + t.amount, 0);
  const active = db.investments.filter((i) => i.childId === childId && !i.redeemedAt);
  const invested = active.reduce((s, i) => s + i.amount, 0);
  const accrued = active.reduce((s, i) => s + accruedCents(i), 0);
  return { cash, invested, accrued, total: cash + invested + accrued };
}

/** 收益序列：最近 days 天（含今天），每天合计收益 + 区间总额 */
function incomeSeries(db, childId, days) {
  const today = todayStr();
  const from = addDays(today, -(days - 1));
  const items = db.investments.filter((i) => i.childId === childId);
  const series = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const next = addDays(date, 1);
    let income = 0;
    for (const inv of items) income += incomeInDays(inv, date, next);
    series.push({ date, income });
  }
  return { days, from, to: today, series, total: series.reduce((s, x) => s + x.income, 0) };
}

/** 投资记录的展示视图（附累计收益 / 到期信息） */
function investView(inv) {
  const today = todayStr();
  const view = {
    ...inv,
    accrued: accruedCents(inv),
    ratePct: Math.round(inv.rate * 10000) / 100,
  };
  if (inv.termDays > 0) {
    view.matureDate = addDays(inv.startDate, inv.termDays);
    view.daysLeft = diffDays(today, view.matureDate); // >0 剩余天数；<=0 已到期
    view.matured = view.daysLeft <= 0;
  } else {
    view.matureDate = null;
    view.daysLeft = null;
    view.matured = false;
  }
  return view;
}

module.exports = {
  PRODUCTS,
  productById,
  todayStr,
  addDays,
  diffDays,
  minDate,
  maxDate,
  incomeInDays,
  accruedCents,
  childBalances,
  incomeSeries,
  investView,
};
