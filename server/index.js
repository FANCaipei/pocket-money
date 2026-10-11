'use strict';

/**
 * Express 服务：JSON API + 静态资源（client/dist 构建产物）。
 * 启动：node server/index.js   （环境变量：PORT / DATA_DIR / TZ）
 * 契约与旧版完全一致：金额单位为「分」（整数），错误信息为中文儿童语气。
 */

const fs = require('fs');
const path = require('path');
const express = require('express');

const db = require('./db');
const finance = require('./finance');
const demo = require('./demo');

const PORT = parseInt(process.env.PORT || '3000', 10);
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');

const MAX_TX_CENTS = 10000000; // 单笔上限 ¥100,000

// —— 小工具 ——
function fail(res, message, code = 400) { res.status(code).json({ error: message }); }

/** 金额 -> 分（整数）。约定：API 的金额单位一律为「分」（整数）；非法或非整数返回 NaN */
function toCents(v) {
  if (typeof v === 'string' && v.trim() !== '') v = parseFloat(v);
  if (typeof v !== 'number' || !isFinite(v)) return NaN;
  return Math.round(v) === v ? v : NaN;
}
function cleanStr(v, max) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

/** 包一层 async 错误捕获 */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function overviewPayload() {
  const children = db.listChildren()
    .map((c) => ({ ...c, balances: finance.childBalances(db.childLedger(c.id), c.id) }));
  const family = children.reduce(
    (acc, c) => ({
      cash: acc.cash + c.balances.cash,
      invested: acc.invested + c.balances.invested,
      accrued: acc.accrued + c.balances.accrued,
      total: acc.total + c.balances.total,
    }),
    { cash: 0, invested: 0, accrued: 0, total: 0 }
  );
  const monthIncome = children.reduce(
    (s, c) => s + finance.incomeSeries(db.childLedger(c.id), c.id, 30).total, 0
  );
  return { children, family: { ...family, monthIncome } };
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// —— 健康 ——
app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

// —— 概览 / 产品 / 说明 ——
app.get('/api/overview', (req, res) => res.json(overviewPayload()));

app.get('/api/products', (req, res) => res.json({ products: finance.PRODUCTS }));

app.get('/api/demo-info', (req, res) => res.json({
  productsNote: '理财产品与利率为演示数据（写死），可在 server/finance.js 修改',
}));

// —— 孩子 ——
app.post('/api/children', wrap((req, res) => {
  const name = cleanStr(req.body.name, 12);
  if (!name) return fail(res, '请给孩子起个名字');
  const avatar = cleanStr(req.body.avatar, 8) || '🧒';
  const color = cleanStr(req.body.color, 16) || '#007AFF';
  const initial = req.body.initialBalance != null ? toCents(req.body.initialBalance) : 0;
  if (!isFinite(initial) || initial < 0 || initial > MAX_TX_CENTS) return fail(res, '初始金额不正确');

  let child;
  db.withTransaction(() => {
    child = db.insertChild({ name, avatar, color });
    if (initial > 0) {
      db.insertTransaction({
        childId: child.id, type: 'deposit', amount: initial,
        item: '初始零花钱', note: '开户入账', category: null, date: finance.todayStr(),
      });
    }
  });
  res.status(201).json({ child: { ...child, balances: finance.childBalances(db.childLedger(child.id), child.id) } });
}));

app.delete('/api/children/:id', wrap((req, res) => {
  const child = db.getChild(req.params.id);
  if (!child) return fail(res, '孩子不存在', 404);
  db.deleteChild(child.id);
  res.json({ ok: true });
}));

// 孩子详情（流水 + 持仓 + 余额）
app.get('/api/children/:id', wrap((req, res) => {
  const child = db.getChild(req.params.id);
  if (!child) return fail(res, '孩子不存在', 404);
  const transactions = db.listTransactions(child.id);
  const investments = db.listInvestments(child.id)
    .filter((i) => !i.redeemedAt)
    .map(finance.investView)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  res.json({ child, balances: finance.childBalances(db.childLedger(child.id), child.id), transactions, investments });
}));

// —— 记账：入金 / 消费 ——
app.post('/api/children/:id/transactions', wrap((req, res) => {
  const child = db.getChild(req.params.id);
  if (!child) return fail(res, '孩子不存在', 404);

  const type = req.body.type;
  if (type !== 'deposit' && type !== 'expense') return fail(res, '类型必须是 deposit 或 expense');
  const amount = toCents(req.body.amount);
  if (!isFinite(amount) || amount <= 0) return fail(res, '金额要大于 0');
  if (amount > MAX_TX_CENTS) return fail(res, '单笔金额太大了');

  const date = cleanStr(req.body.date, 10) || finance.todayStr();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > finance.todayStr()) return fail(res, '日期不正确（不能是未来）');

  if (type === 'expense') {
    const item = cleanStr(req.body.item, 20);
    if (!item) return fail(res, '记一下买了什么吧');
    const cash = finance.childBalances(db.childLedger(child.id), child.id).cash;
    if (cash < amount) return fail(res, '零花钱不够啦，先入金或赎回理财');
  }
  const item = type === 'expense' ? cleanStr(req.body.item, 20) : (cleanStr(req.body.item, 20) || '入金');
  const note = cleanStr(req.body.note, 60);
  const category = type === 'expense' ? (cleanStr(req.body.category, 16) || 'other') : null;

  let tx;
  db.withTransaction(() => {
    tx = db.insertTransaction({
      childId: child.id, type,
      amount: type === 'expense' ? -amount : amount,
      item, note, category, date,
    });
  });
  res.status(201).json({ transaction: tx, balances: finance.childBalances(db.childLedger(child.id), child.id) });
}));

app.delete('/api/transactions/:id', wrap((req, res) => {
  const tx = db.getTransaction(req.params.id);
  if (!tx) return fail(res, '记录不存在', 404);
  // 删除后现金不能为负（理财投入视同已花掉）
  const cash = finance.childBalances(db.childLedger(tx.childId), tx.childId).cash - tx.amount;
  if (cash < 0) return fail(res, '删除后余额会变成负数，请先调整消费或赎回理财');
  db.deleteTransaction(tx.id);
  res.json({ ok: true, balances: finance.childBalances(db.childLedger(tx.childId), tx.childId) });
}));

// —— 收益序列 ——
app.get('/api/children/:id/income', wrap((req, res) => {
  const child = db.getChild(req.params.id);
  if (!child) return fail(res, '孩子不存在', 404);
  let days = parseInt(req.query.days || '7', 10);
  if (![7, 30, 90].includes(days)) days = 7;
  res.json(finance.incomeSeries(db.childLedger(child.id), child.id, days));
}));

// —— 理财：买入 / 赎回 ——
app.post('/api/children/:id/investments', wrap((req, res) => {
  const child = db.getChild(req.params.id);
  if (!child) return fail(res, '孩子不存在', 404);
  const product = finance.productById(cleanStr(req.body.productId, 16));
  if (!product) return fail(res, '理财产品不存在', 404);
  const amount = toCents(req.body.amount);
  if (!isFinite(amount) || amount < 100) return fail(res, '最低买入 ¥1');
  if (amount > MAX_TX_CENTS) return fail(res, '单笔金额太大了');
  const cash = finance.childBalances(db.childLedger(child.id), child.id).cash;
  if (cash < amount) return fail(res, '可用零花钱不足');

  const today = finance.todayStr();
  let inv;
  db.withTransaction(() => {
    inv = db.insertInvestment({
      childId: child.id, productId: product.id, productName: product.name,
      rate: product.rate, termDays: product.termDays,
      amount, startDate: today, redeemedAt: null,
    });
    db.insertTransaction({
      childId: child.id, type: 'invest', amount: -amount,
      item: '买入 ' + product.name, note: '', category: null, date: today,
    });
  });
  res.status(201).json({ investment: finance.investView(inv), balances: finance.childBalances(db.childLedger(child.id), child.id) });
}));

app.post('/api/investments/:id/redeem', wrap((req, res) => {
  const inv = db.getInvestment(req.params.id);
  if (!inv) return fail(res, '理财不存在', 404);
  if (inv.redeemedAt) return fail(res, '该笔理财已赎回');
  const gain = finance.accruedCents(inv); // 赎回前先结清收益
  const today = finance.todayStr();
  db.withTransaction(() => {
    db.setInvestmentRedeemed(inv.id, today);
    db.insertTransaction({
      childId: inv.childId, type: 'redeem', amount: inv.amount + gain,
      item: '赎回 ' + inv.productName,
      note: '本金 ¥' + (inv.amount / 100).toFixed(2) + '，收益 ¥' + (gain / 100).toFixed(2),
      category: null, date: today,
    });
  });
  const updated = { ...inv, redeemedAt: today };
  res.json({
    investment: finance.investView(updated),
    balances: finance.childBalances(db.childLedger(inv.childId), inv.childId),
    gain,
  });
}));

// —— 重置演示数据 ——
app.post('/api/demo/reset', wrap((req, res) => {
  db.insertSnapshot(demo.build());
  res.json({ ok: true, ...overviewPayload() });
}));

// —— API 404 ——
app.use('/api', (req, res) => {
  fail(res, '接口不存在: ' + req.method + ' ' + req.path, 404);
});

// —— 静态资源（client/dist 构建产物，单页回退） ——
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, { index: 'index.html', maxAge: 0 }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, '不支持的请求方法', 405);
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
} else {
  console.warn('[server] 未找到 client/dist，请先运行: npm run build');
  app.use((req, res) => res.status(503).send('<meta charset="utf-8">前端尚未构建，请先运行 <b>npm run build</b> 再重启服务。'));
}

// —— 错误处理 ——
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.type === 'entity.parse.failed') return fail(res, 'JSON 格式错误', 400);
  if (err.type === 'entity.too.large') return fail(res, '请求体过大', 413);
  console.error('[server]', err);
  fail(res, err.message || '服务器开小差了', err.status || 500);
});

// —— 服务入口 ——
db.init();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`零花钱管家已启动: http://localhost:${PORT}  （数据目录: ${db.DATA_DIR}）`);
});
