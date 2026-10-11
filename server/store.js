'use strict';

/**
 * 数据存储：单个 JSON 文件（DATA_DIR/db.json），原子写入（临时文件 + rename）。
 * 家庭记账场景写入频率很低，JSON 存储零依赖、易备份、易迁移。
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let db = null;

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (parsed && Array.isArray(parsed.children)) db = parsed;
    } catch (e) {
      console.error('[store] db.json 解析失败，将重新生成演示数据:', e.message);
      db = null;
    }
  }
  if (!db) {
    db = require('./demo').build();
    save();
    console.log('[store] 已生成初始化演示数据 ->', DB_FILE);
  }
  return db;
}

function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function get() {
  if (!db) load();
  return db;
}

/** 整体替换数据库（用于「重置演示数据」） */
function replace(next) {
  db = next;
  save();
  return db;
}

module.exports = { load, save, get, replace, DB_FILE, DATA_DIR };
