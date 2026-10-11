/**
 * API 冒烟测试：node scripts/smoke-test.mjs
 * 环境变量 BASE（默认 http://localhost:3000）。会对数据做增删并最后重置演示数据。
 */
const BASE = process.env.BASE || 'http://localhost:3000';

let passed = 0;
const failed = [];
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed.push(msg); console.error('  ✗', msg); }
}

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* noop */ }
  return { status: res.status, data };
}
const yuan = (c) => Math.round(c) / 100;

console.log('→ 健康检查');
{
  const { status, data } = await call('GET', '/api/health');
  assert(status === 200 && data.ok === true, 'GET /api/health 返回 ok');
}

console.log('→ 演示数据与概览');
let initialCount = 0;
{
  const { status, data } = await call('GET', '/api/overview');
  assert(status === 200 && Array.isArray(data.children), 'GET /api/overview 返回孩子列表');
  assert(data.children.length >= 2, `演示数据包含 ${data.children.length} 个孩子`);
  initialCount = data.children.length;
  const allOk = data.children.every((c) =>
    Number.isInteger(c.balances.cash) && c.balances.cash >= 0 &&
    c.balances.total === c.balances.cash + c.balances.invested + c.balances.accrued);
  assert(allOk, '每个孩子余额非负且 总资产 = 现金 + 理财本金 + 累计收益');
  assert(data.family.total > 0, `家庭总资产为正（¥${yuan(data.family.total)}）`);
}

console.log('→ 收益序列（1周/1月/3月）');
{
  const { data: ov } = await call('GET', '/api/overview');
  const kid = ov.children.find((c) => c.balances.invested > 0);
  assert(!!kid, '存在持仓中的孩子');
  const inc7 = await call('GET', `/api/children/${kid.id}/income?days=7`);
  const inc30 = await call('GET', `/api/children/${kid.id}/income?days=30`);
  const inc90 = await call('GET', `/api/children/${kid.id}/income?days=90`);
  assert(inc7.data.series.length === 7 && inc30.data.series.length === 30 && inc90.data.series.length === 90,
    '收益序列长度分别为 7/30/90');
  const sum = (s) => s.series.reduce((a, x) => a + x.income, 0);
  assert(sum(inc7.data) === inc7.data.total && sum(inc30.data) === inc30.data.total && sum(inc90.data) === inc90.data.total,
    '区间总额 = 每日序列之和');
  assert(inc90.data.total >= inc30.data.total && inc30.data.total >= inc7.data.total, '90天 ≥ 30天 ≥ 7天收益');
  assert(inc7.data.total > 0, `近1周收益为正（¥${yuan(inc7.data.total)}）`);

  // 回归：累计收益 = min(今天, 到期日) - 起始日 的实际持有天数 × 每日收益
  // （定期未到期不得预支未来收益；活期不得把「今天+1」计入）
  const { data: kidDetail } = await call('GET', `/api/children/${kid.id}`);
  const today = new Date();
  const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000); // 均为 UTC 解析，无时区问题
  const t0 = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  const accruedOk = kidDetail.investments.filter((i) => !i.redeemedAt).every((i) => {
    const daily = Math.round(i.amount * i.rate / 365);
    const termEnd = i.termDays > 0 ? new Date(Date.parse(i.startDate) + i.termDays * 86400000).toISOString().slice(0, 10) : null;
    const holdDays = Math.max(0, dayDiff(i.startDate, termEnd && termEnd < t0 ? termEnd : t0));
    return i.accrued === daily * holdDays;
  });
  assert(accruedOk, '累计收益 = 实际持有天数 × 每日收益（定期不预支未来收益）');
}

console.log('→ 记账与余额守恒');
const name = '测试宝宝' + Date.now() % 1000;
let childId, depositId, expenseId, investId;
{
  const add = await call('POST', '/api/children', { name, avatar: '🚀', initialBalance: 10000 });
  assert(add.status === 201 && add.data.child.balances.cash === 10000, '创建孩子并带 ¥100 初始零花钱');
  childId = add.data.child.id;

  const dep = await call('POST', `/api/children/${childId}/transactions`, { type: 'deposit', amount: 5000, item: '入金', note: '测试' });
  assert(dep.status === 201 && dep.data.balances.cash === 15000, '入金 ¥50 → 余额 ¥150');
  depositId = dep.data.transaction.id;

  const exp = await call('POST', `/api/children/${childId}/transactions`,
    { type: 'expense', amount: 3000, item: '冰淇淋', category: 'snack' });
  assert(exp.status === 201 && exp.data.balances.cash === 12000, '消费 ¥30 → 余额 ¥120');
  expenseId = exp.data.transaction.id;

  const over = await call('POST', `/api/children/${childId}/transactions`,
    { type: 'expense', amount: 40000, item: '太贵了' });
  assert(over.status === 400, '余额不足的消费被拒绝（400）');

  const fractional = await call('POST', `/api/children/${childId}/transactions`,
    { type: 'expense', amount: 12.5, item: '非整数分' });
  assert(fractional.status === 400, '非整数分金额被拒绝（400）');

  const future = await call('POST', `/api/children/${childId}/transactions`,
    { type: 'expense', amount: 1, item: '未来', date: '2099-01-01' });
  assert(future.status === 400, '未来日期被拒绝（400）');
}

console.log('→ 理财买入与赎回');
{
  const inv = await call('POST', `/api/children/${childId}/investments`, { productId: 'demand', amount: 8000 });
  assert(inv.status === 201 && inv.data.balances.cash === 4000, '买入 ¥80 活期 → 现金 ¥40');
  assert(inv.data.investment.accrued === 0, '当天买入当日不计息');
  investId = inv.data.investment.id;

  const badInv = await call('POST', `/api/children/${childId}/investments`, { productId: 'demand', amount: 999999 });
  assert(badInv.status === 400, '可用余额不足的买入被拒绝（400）');

  const red = await call('POST', `/api/investments/${investId}/redeem`);
  assert(red.status === 200 && red.data.balances.cash === 12000, '赎回本息 ¥80 → 现金 ¥120');
  assert(red.data.gain === 0, '当日赎回收益为 0');

  const red2 = await call('POST', `/api/investments/${investId}/redeem`);
  assert(red2.status === 400, '重复赎回被拒绝（400）');
}

console.log('→ 删除流水');
{
  const d1 = await call('DELETE', `/api/transactions/${expenseId}`);
  assert(d1.status === 200 && d1.data.balances.cash === 15000, '删除消费 ¥30 → 余额 ¥150');

  // 买入一笔理财锁定 ¥120（现金剩 ¥30），再尝试删除 ¥50 入金 → 现金将变为 -¥20，应被拒绝
  await call('POST', `/api/children/${childId}/investments`, { productId: 'demand', amount: 12000 });
  const d2 = await call('DELETE', `/api/transactions/${depositId}`);
  assert(d2.status === 400, '删除会导致余额为负的入金被拒绝（400）');

  const detail = await call('GET', `/api/children/${childId}`);
  const initialTx = detail.data.transactions.find((t) => t.item === '初始零花钱');
  const d3 = await call('DELETE', `/api/transactions/${initialTx.id}`);
  assert(d3.status === 400, '删除初始入金（理财占用资金）被拒绝（400）');
}

console.log('→ 删除孩子与重置');
{
  const del = await call('DELETE', `/api/children/${childId}`);
  assert(del.status === 200, '删除测试孩子');
  const { data: ov } = await call('GET', '/api/overview');
  assert(!ov.children.some((c) => c.id === childId), '孩子已被移除');

  const reset = await call('POST', '/api/demo/reset');
  assert(reset.status === 200 && reset.data.children.length === initialCount, `重置后恢复 ${initialCount} 个演示孩子`);
  const inc = await call('GET', `/api/children/${reset.data.children[0].id}/income?days=7`);
  assert(inc.data.total > 0, '重置后收益数据可用');
}

console.log(`\n结果: ${passed} 通过, ${failed.length} 失败`);
if (failed.length) { failed.forEach((m) => console.error('  FAILED:', m)); process.exit(1); }
