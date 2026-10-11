'use strict';

/**
 * 初始化演示数据。
 * 事件按日期从早到晚回放，并维护现金流水账：
 * 入金无条件入账；消费/买入理财在现金不足时跳过（保证任何时刻余额 >= 0）。
 * 理财产品跨越 1 周 / 1 月 / 3 月收益窗口，打开即可看到收益图表。
 */

const finance = require('./finance');

// 消费分类（与前端保持一致：key / emoji / 颜色）
const CATS = {
  snack: { emoji: '🍟', color: '#FF9500' },
  toy:   { emoji: '🧸', color: '#AF52DE' },
  study: { emoji: '✏️', color: '#007AFF' },
  book:  { emoji: '📚', color: '#34C759' },
  fun:   { emoji: '🎮', color: '#5856D6' },
  other: { emoji: '🎁', color: '#8E8E93' },
};

function build() {
  const today = finance.todayStr();
  const db = { children: [], transactions: [], investments: [], counters: { child: 0, tx: 0, invest: 0 } };

  const idTx = () => 't' + (++db.counters.tx);
  const idInv = () => 'i' + (++db.counters.invest);
  const idChild = () => 'c' + (++db.counters.child);

  // 让同一天的多条记录有稳定且递增的时间戳（用于排序）
  let seq = 0;
  function ts(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 8 + ((seq++ % 14)), (seq * 7) % 60, 0).getTime();
  }

  function addTx(childId, date, type, amount, item, note, category) {
    db.transactions.push({
      id: idTx(), childId, type, amount,
      item: item || (type === 'deposit' ? '入金' : type === 'expense' ? '消费' : '理财'),
      note: note || '', category: category || null,
      date, createdAt: ts(date),
    });
  }

  // 每周零花钱：最近 weeks 周，每周一笔（最近一笔在「今天」）
  function weekly(amount, weeks, note) {
    const events = [];
    for (let i = 0; i < weeks; i++) {
      events.push({ d: i * 7, kind: 'deposit', amount, item: '每周零花钱', note: note || '每周零花钱' });
    }
    return events;
  }

  function investEvent(d, productId, amount, redeemDaysAgo) {
    const p = finance.productById(productId);
    return { d, kind: 'invest', productId, productName: p.name, rate: p.rate, termDays: p.termDays, amount, redeemDaysAgo };
  }

  const defs = [
    {
      name: '朵朵', avatar: '👧', color: '#FF7EB3',
      events: [
        { d: 140, kind: 'deposit', amount: 60000, item: '开户红包', note: '欢迎来到零花钱银行！' },
        { d: 137, kind: 'deposit', amount: 300000, item: '生日红包', note: '爷爷奶奶给的大红包' },
        ...weekly(5000, 18),
        { d: 132, kind: 'deposit', amount: 30000, item: '儿童节红包', note: '爸爸妈妈的节日礼物' },
        { d: 66, kind: 'deposit', amount: 5000, item: '考试奖励', note: '数学考了100分' },
        { d: 22, kind: 'deposit', amount: 5000, item: '考试奖励', note: '听写全对' },
        // 消费
        { d: 112, kind: 'expense', amount: 1200, item: '自动铅笔+橡皮', note: '开学文具', category: 'study' },
        { d: 105, kind: 'expense', amount: 800, item: '校门口零食', note: '', category: 'snack' },
        { d: 98, kind: 'expense', amount: 3500, item: '《夏洛的网》', note: '老师推荐的书', category: 'book' },
        { d: 90, kind: 'expense', amount: 650, item: '冰淇淋', note: '', category: 'snack' },
        { d: 83, kind: 'expense', amount: 4500, item: '拼图', note: '500片的！', category: 'toy' },
        { d: 76, kind: 'expense', amount: 1000, item: '辣条', note: '', category: 'snack' },
        { d: 69, kind: 'expense', amount: 1500, item: '荧光笔', note: '', category: 'study' },
        { d: 62, kind: 'expense', amount: 4000, item: '看电影', note: '和妈妈一起', category: 'fun' },
        { d: 55, kind: 'expense', amount: 900, item: '薯片', note: '', category: 'snack' },
        { d: 48, kind: 'expense', amount: 2900, item: '乐高小人', note: '', category: 'toy' },
        { d: 41, kind: 'expense', amount: 1200, item: '奶茶', note: '三分糖', category: 'snack' },
        { d: 34, kind: 'expense', amount: 2800, item: '漫画书', note: '', category: 'book' },
        { d: 27, kind: 'expense', amount: 700, item: '软糖', note: '', category: 'snack' },
        { d: 20, kind: 'expense', amount: 2000, item: '游戏币', note: '电玩城', category: 'fun' },
        { d: 13, kind: 'expense', amount: 850, item: '小饼干', note: '', category: 'snack' },
        { d: 6, kind: 'expense', amount: 1800, item: '水彩笔', note: '美术课要用', category: 'study' },
        { d: 2, kind: 'expense', amount: 500, item: '果冻', note: '', category: 'snack' },
        // 理财
        investEvent(90, 'demand', 200000),
        investEvent(75, 'fix3', 100000),
        investEvent(55, 'fin90', 50000),
      ],
    },
    {
      name: '小虎', avatar: '👦', color: '#5AC8FA',
      events: [
        { d: 140, kind: 'deposit', amount: 60000, item: '开户红包', note: '欢迎来到零花钱银行！' },
        { d: 137, kind: 'deposit', amount: 250000, item: '考级奖励', note: '钢琴五级通过，姥姥的奖励' },
        ...weekly(3000, 20),
        { d: 110, kind: 'deposit', amount: 20000, item: '生日红包', note: '八岁生日快乐' },
        { d: 55, kind: 'deposit', amount: 3000, item: '劳动奖励', note: '帮忙做家务一周' },
        { d: 25, kind: 'deposit', amount: 3000, item: '考试奖励', note: '进步明显' },
        // 消费
        { d: 100, kind: 'expense', amount: 2500, item: '玩具车', note: '', category: 'toy' },
        { d: 93, kind: 'expense', amount: 500, item: '干脆面', note: '', category: 'snack' },
        { d: 86, kind: 'expense', amount: 800, item: '作业本', note: '', category: 'study' },
        { d: 79, kind: 'expense', amount: 600, item: '汽水', note: '', category: 'snack' },
        { d: 72, kind: 'expense', amount: 1500, item: '桌游', note: '和爸爸下棋输了买冰棍', category: 'fun' },
        { d: 65, kind: 'expense', amount: 800, item: '辣条', note: '', category: 'snack' },
        { d: 58, kind: 'expense', amount: 3500, item: '陀螺', note: '对战用的', category: 'toy' },
        { d: 51, kind: 'expense', amount: 400, item: '冰棍', note: '', category: 'snack' },
        { d: 44, kind: 'expense', amount: 1000, item: '中性笔', note: '', category: 'study' },
        { d: 37, kind: 'expense', amount: 550, item: '方便面', note: '', category: 'snack' },
        { d: 30, kind: 'expense', amount: 2500, item: '《昆虫记》', note: '', category: 'book' },
        { d: 23, kind: 'expense', amount: 600, item: '汽水', note: '', category: 'snack' },
        { d: 16, kind: 'expense', amount: 1500, item: '游戏币', note: '', category: 'fun' },
        { d: 9, kind: 'expense', amount: 1200, item: '巧克力', note: '', category: 'snack' },
        { d: 3, kind: 'expense', amount: 2000, item: '卡牌包', note: '奥特曼卡', category: 'toy' },
        // 理财（含一笔已到期赎回，用于展示历史收益）
        investEvent(120, 'fin90', 20000, 30),
        investEvent(95, 'demand', 150000),
        investEvent(70, 'fix6', 100000),
        investEvent(25, 'fin180', 50000),
      ],
    },
    {
      name: '果果', avatar: '🧒', color: '#FFD60A',
      events: [
        { d: 140, kind: 'deposit', amount: 30000, item: '开户红包', note: '欢迎来到零花钱银行！' },
        ...weekly(2000, 9),
        { d: 30, kind: 'expense', amount: 300, item: '棒棒糖', note: '', category: 'snack' },
        { d: 15, kind: 'expense', amount: 600, item: '贴纸', note: '', category: 'study' },
        { d: 5, kind: 'expense', amount: 400, item: '小面包', note: '', category: 'snack' },
      ],
    },
  ];

  for (const def of defs) {
    const cid = idChild();
    db.children.push({ id: cid, name: def.name, avatar: def.avatar, color: def.color, createdAt: Date.now() });

    let cash = 0;
    // 从早到晚回放（daysAgo 大的在前）；同一天内：入金 -> 赎回 -> 买入 -> 消费
    const order = { deposit: 0, redeem: 1, invest: 2, expense: 3 };
    const events = def.events
      .slice()
      .sort((a, b) => (b.d - a.d) || (order[a.kind] - order[b.kind]));

    for (const ev of events) {
      const date = finance.addDays(today, -ev.d);
      if (ev.kind === 'deposit') {
        cash += ev.amount;
        addTx(cid, date, 'deposit', ev.amount, ev.item, ev.note);
      } else if (ev.kind === 'expense') {
        if (cash < ev.amount) { console.warn('[demo] 跳过消费（余额不足）:', def.name, ev.item); continue; }
        cash -= ev.amount;
        addTx(cid, date, 'expense', -ev.amount, ev.item, ev.note, ev.category);
      } else if (ev.kind === 'invest') {
        if (cash < ev.amount) { console.warn('[demo] 跳过买入理财（余额不足）:', def.name, ev.productName); continue; }
        cash -= ev.amount;
        addTx(cid, date, 'invest', -ev.amount, '买入 ' + ev.productName, '');
        const inv = {
          id: idInv(), childId: cid,
          productId: ev.productId, productName: ev.productName,
          rate: ev.rate, termDays: ev.termDays,
          amount: ev.amount,
          startDate: date,
          redeemedAt: ev.redeemDaysAgo != null ? finance.addDays(today, -ev.redeemDaysAgo) : null,
        };
        db.investments.push(inv);
        if (inv.redeemedAt) {
          const gain = finance.incomeInDays(inv, inv.startDate, finance.addDays(inv.redeemedAt, 1));
          cash += inv.amount + gain;
          addTx(cid, inv.redeemedAt, 'redeem', inv.amount + gain, '赎回 ' + ev.productName,
            '本金 ¥' + (inv.amount / 100).toFixed(2) + '，收益 ¥' + (gain / 100).toFixed(2));
        }
      }
    }
  }

  return db;
}

module.exports = { build };
