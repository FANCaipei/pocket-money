/** 记账页：孩子切换 + 余额统计 + 流水（点击可删除） */
import { useState } from 'react';
import { ViewShell, ChildChips } from '../components/layout.jsx';
import { useApp } from '../context.jsx';
import { useUI } from '../components/ui.jsx';
import { api } from '../api.js';
import { catOf, money, dateLabel } from '../fmt.js';

const TX_ICON = {
  deposit: { emoji: '💰', bg: 'rgba(52,199,89,.14)' },
  invest: { emoji: '🏦', bg: 'rgba(0,122,255,.12)' },
  redeem: { emoji: '🎉', bg: 'rgba(48,176,199,.14)' },
};
const SUB_DEFAULT = {
  deposit: '零花钱入账',
  invest: '买入理财产品',
  redeem: '本金与收益已到账',
};

function txVisual(tx) {
  if (tx.type === 'expense') {
    const cat = catOf(tx.category);
    return { emoji: cat.emoji, bg: cat.color + '1F' };
  }
  return TX_ICON[tx.type] || { emoji: '💸', bg: 'rgba(142,142,147,.15)' };
}

export default function LedgerView({ active, title }) {
  const { overview, detail, selectedId, openSheet, refresh } = useApp();
  const { toast, confirm } = useUI();
  const [busy, setBusy] = useState(false);
  const kid = overview.children.find((c) => c.id === selectedId) || null;
  const bal = detail?.balances;

  const quick = (type) => {
    if (!kid) return toast('请先添加孩子', 'error');
    openSheet(type, kid.id);
  };

  const removeTx = async (tx) => {
    const ok = await confirm({
      title: '删除这条记录？',
      message: `${tx.item} · ${money(tx.amount, { sign: true })}`,
      okText: '删除', danger: true,
    });
    if (!ok || busy) return;
    setBusy(true);
    try {
      await api.deleteTransaction(tx.id);
      toast('已删除');
      await refresh();
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  // 按日期分组（接口已按 date DESC 排序，相邻同日期归为一组）
  const groups = [];
  for (const tx of detail?.transactions || []) {
    const g = groups[groups.length - 1];
    if (g && g.date === tx.date) g.items.push(tx);
    else groups.push({ date: tx.date, items: [tx] });
  }

  return (
    <ViewShell title={title} active={active}>
      <div className="pt-3"><ChildChips /></div>

      {/* 余额统计 */}
      {bal ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[['可用零花钱', bal.cash], ['理财中', bal.invested], ['总资产', bal.total]].map(([label, v]) => (
            <div key={label} className="rounded-2xl bg-white p-3 text-center shadow-sm">
              <div className="num text-[16px] font-bold">{money(v)}</div>
              <div className="mt-0.5 text-[11px] text-ink2">{label}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-2xl bg-white p-4 text-center text-[13px] text-ink2 shadow-sm">添加孩子后开始记账</div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <button onClick={() => quick('expense')}
          className="h-[44px] rounded-[14px] bg-ios-red/10 text-[15px] font-semibold text-ios-red active:opacity-70">
          − 记消费
        </button>
        <button onClick={() => quick('deposit')}
          className="h-[44px] rounded-[14px] bg-ios-green/10 text-[15px] font-semibold text-ios-green active:opacity-70">
          ＋ 入金
        </button>
      </div>

      {/* 流水 */}
      {groups.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="text-[40px]">🧾</div>
          <div className="mt-2 text-[15px] font-semibold">还没有记录</div>
          <div className="mt-1 text-[13px] text-ink2">先记一笔入金吧</div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {groups.map((g) => (
            <div key={g.date}>
              <div className="mb-1.5 px-1 text-[13px] text-ink2">{dateLabel(g.date)}</div>
              <div className="divide-y divide-black/5 rounded-2xl bg-white shadow-sm">
                {g.items.map((tx) => {
                  const v = txVisual(tx);
                  const plus = tx.amount > 0;
                  return (
                    <button key={tx.id} onClick={() => removeTx(tx)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/[0.03]">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-[18px]"
                        style={{ backgroundColor: v.bg }}>{v.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{tx.item || SUB_DEFAULT[tx.type]}</span>
                        <span className="block truncate text-[12px] text-ink2">{tx.note || SUB_DEFAULT[tx.type] || catOf(tx.category).name}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={`num block text-[15px] font-semibold ${plus ? 'text-ios-green' : ''}`}>
                          {money(tx.amount, { sign: true })}
                        </span>
                        {(tx.type === 'invest' || tx.type === 'redeem') && (
                          <span className="block text-[10px] text-ink2">{tx.type === 'invest' ? '买入理财' : '理财赎回'}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-[12px] leading-relaxed text-ink2">
        点击任意记录可删除（删除后余额不能为负）。
      </p>
    </ViewShell>
  );
}
