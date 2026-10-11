'use strict';

/**
 * SQLite 数据层（Node 22+ 内置 node:sqlite，无需原生编译依赖）。
 * - 表：children / transactions / investments / counters（ID 计数器）
 * - 外键级联：删除孩子时一并删除其流水与理财记录
 * - 金额单位一律为「分」（整数），与 API 契约一致
 * - 首次启动：若库为空且存在旧版 db.json（JSON 存储时代）则自动导入；否则生成演示数据
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

let db = null;
let DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

// —— 行映射（snake_case -> camelCase，返回普通对象） ——
function mapChild(r) {
  return { id: r.id, name: r.name, avatar: r.avatar, color: r.color, createdAt: r.created_at };
}
function mapTx(r) {
  return {
    id: r.id, childId: r.child_id, type: r.type, amount: r.amount,
    item: r.item, note: r.note, category: r.category,
    date: r.date, createdAt: r.created_at,
  };
}
function mapInv(r) {
  return {
    id: r.id, childId: r.child_id, productId: r.product_id, productName: r.product_name,
    rate: r.rate, termDays: r.term_days, amount: r.amount,
    startDate: r.start_date, redeemedAt: r.redeemed_at,
  };
}

function counterValue(name) {
  const row = db.prepare('SELECT value FROM counters WHERE name = ?').get(name);
  return row ? Number(row.value) : 0;
}

/** 顺序 ID（沿用演示数据的 c1/t1/i1 风格） */
function nextId(prefix) {
  const key = prefix === 'c' ? 'child' : prefix === 't' ? 'tx' : 'invest';
  const v = counterValue(key) + 1;
  db.prepare(
    'INSERT INTO counters(name, value) VALUES(?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value'
  ).run(key, v);
  return prefix + v;
}

// —— 初始化 ——
function init(dataDir = DATA_DIR) {
  DATA_DIR = dataDir;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(path.join(DATA_DIR, 'pocket-money.db'));
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS children (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      avatar     TEXT NOT NULL DEFAULT '🧒',
      color      TEXT NOT NULL DEFAULT '#007AFF',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id         TEXT PRIMARY KEY,
      child_id   TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      type       TEXT NOT NULL CHECK (type IN ('deposit','expense','invest','redeem')),
      amount     INTEGER NOT NULL,
      item       TEXT NOT NULL DEFAULT '',
      note       TEXT NOT NULL DEFAULT '',
      category   TEXT,
      date       TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tx_child ON transactions(child_id, date);
    CREATE TABLE IF NOT EXISTS investments (
      id           TEXT PRIMARY KEY,
      child_id     TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      product_id   TEXT NOT NULL,
      product_name TEXT NOT NULL,
      rate         REAL NOT NULL,
      term_days    INTEGER NOT NULL,
      amount       INTEGER NOT NULL,
      start_date   TEXT NOT NULL,
      redeemed_at  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_inv_child ON investments(child_id);
    CREATE TABLE IF NOT EXISTS counters (
      name  TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO counters(name, value) VALUES ('child', 0), ('tx', 0), ('invest', 0);
  `);
  bootstrapData();
}

/** 空库时的初始数据：优先导入旧版 db.json，否则生成演示数据 */
function bootstrapData() {
  if (countChildren() > 0) return;
  const legacy = path.join(DATA_DIR, 'db.json');
  if (fs.existsSync(legacy)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(legacy, 'utf8'));
      if (parsed && Array.isArray(parsed.children)) {
        insertSnapshot(parsed);
        console.log('[db] 已从旧版 db.json 导入数据 ->', path.join(DATA_DIR, 'pocket-money.db'));
        return;
      }
    } catch (e) {
      console.warn('[db] 旧版 db.json 解析失败，改用演示数据:', e.message);
    }
  }
  const demo = require('./demo').build();
  insertSnapshot(demo);
  console.log('[db] 已生成初始化演示数据 ->', path.join(DATA_DIR, 'pocket-money.db'));
}

// —— 事务 ——
function withTransaction(fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* 忽略 */ }
    throw e;
  }
}

// —— 快照写入（导入 / 演示数据重置） ——
function insertSnapshot(snap) {
  const insChild = db.prepare('INSERT INTO children (id, name, avatar, color, created_at) VALUES (?,?,?,?,?)');
  const insTx = db.prepare('INSERT INTO transactions (id, child_id, type, amount, item, note, category, date, created_at) VALUES (?,?,?,?,?,?,?,?,?)');
  const insInv = db.prepare('INSERT INTO investments (id, child_id, product_id, product_name, rate, term_days, amount, start_date, redeemed_at) VALUES (?,?,?,?,?,?,?,?,?)');

  withTransaction(() => {
    clearAll();
    for (const c of snap.children || []) {
      insChild.run(c.id, c.name, c.avatar, c.color, c.createdAt || Date.now());
    }
    for (const t of snap.transactions || []) {
      insTx.run(t.id, t.childId, t.type, t.amount, t.item || '', t.note || '', t.category ?? null, t.date, t.createdAt || Date.now());
    }
    for (const i of snap.investments || []) {
      insInv.run(i.id, i.childId, i.productId, i.productName, i.rate, i.termDays, i.amount, i.startDate, i.redeemedAt ?? null);
    }
    const ct = snap.counters || {};
    for (const [key, val] of [['child', ct.child], ['tx', ct.tx], ['invest', ct.invest]]) {
      if (Number.isFinite(val)) {
        db.prepare('UPDATE counters SET value = ? WHERE name = ?').run(val, key);
      }
    }
  });
}

// —— 查询 ——
function countChildren() {
  const r = db.prepare('SELECT COUNT(*) AS n FROM children').get();
  return Number(r.n);
}

function listChildren() {
  return db.prepare('SELECT * FROM children ORDER BY created_at ASC, rowid ASC').all().map(mapChild);
}

function getChild(id) {
  const r = db.prepare('SELECT * FROM children WHERE id = ?').get(id);
  return r ? mapChild(r) : null;
}

function listTransactions(childId) {
  return db.prepare('SELECT * FROM transactions WHERE child_id = ? ORDER BY date DESC, created_at DESC, rowid DESC')
    .all(childId).map(mapTx);
}

function getTransaction(id) {
  const r = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  return r ? mapTx(r) : null;
}

function listInvestments(childId) {
  return db.prepare('SELECT * FROM investments WHERE child_id = ? ORDER BY start_date DESC, rowid DESC')
    .all(childId).map(mapInv);
}

function getInvestment(id) {
  const r = db.prepare('SELECT * FROM investments WHERE id = ?').get(id);
  return r ? mapInv(r) : null;
}

/**
 * 某孩子的全部数据视图（供 finance.childBalances / incomeSeries 使用，
 * 与旧版传整个 db 的形状兼容：{ transactions, investments }）
 */
function childLedger(childId) {
  return { transactions: listTransactions(childId), investments: listInvestments(childId) };
}

// —— 写入 ——
function insertChild({ name, avatar, color, createdAt }) {
  const id = nextId('c');
  const ts = createdAt || Date.now();
  db.prepare('INSERT INTO children (id, name, avatar, color, created_at) VALUES (?,?,?,?,?)')
    .run(id, name, avatar, color, ts);
  return { id, name, avatar, color, createdAt: ts };
}

function deleteChild(id) {
  db.prepare('DELETE FROM children WHERE id = ?').run(id); // 外键级联删除流水与理财
}

function insertTransaction(tx) {
  const id = nextId('t');
  const row = { ...tx, id, createdAt: tx.createdAt || Date.now() };
  db.prepare('INSERT INTO transactions (id, child_id, type, amount, item, note, category, date, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, row.childId, row.type, row.amount, row.item || '', row.note || '', row.category ?? null, row.date, row.createdAt);
  return { id, childId: row.childId, type: row.type, amount: row.amount, item: row.item || '', note: row.note || '', category: row.category ?? null, date: row.date, createdAt: row.createdAt };
}

function deleteTransaction(id) {
  db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
}

function insertInvestment(inv) {
  const id = nextId('i');
  db.prepare('INSERT INTO investments (id, child_id, product_id, product_name, rate, term_days, amount, start_date, redeemed_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, inv.childId, inv.productId, inv.productName, inv.rate, inv.termDays, inv.amount, inv.startDate, inv.redeemedAt ?? null);
  return { id, ...inv, redeemedAt: inv.redeemedAt ?? null };
}

function setInvestmentRedeemed(id, dateStr) {
  db.prepare('UPDATE investments SET redeemed_at = ? WHERE id = ?').run(dateStr, id);
}

function clearAll() {
  db.exec('DELETE FROM transactions; DELETE FROM investments; DELETE FROM children;');
  db.exec("UPDATE counters SET value = 0 WHERE name IN ('child','tx','invest')");
}

module.exports = {
  init,
  DATA_DIR,
  withTransaction,
  insertSnapshot,
  countChildren,
  listChildren,
  getChild,
  listTransactions,
  getTransaction,
  listInvestments,
  getInvestment,
  childLedger,
  insertChild,
  deleteChild,
  insertTransaction,
  deleteTransaction,
  insertInvestment,
  setInvestmentRedeemed,
  clearAll,
};
