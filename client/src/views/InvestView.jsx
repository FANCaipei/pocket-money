/** 理财页：收益曲线 + 持仓列表（点击赎回） */
import { useState } from 'react';
import { ViewShell, ChildChips } from '../components/layout.jsx';
import { useApp } from '../context.jsx';
import { Segmented, useUI } from '../components/ui.jsx';
import { IncomeChart } from '../components/IncomeChart.jsx';
import { api } from '../api.js';
import { money, shortDate, RANGE_LABEL } from '../fmt.js';

const RANGE_ITEMS = ['近1周', '近1月', '近3月'];
const RANGE_DAYS = [7, 30, 90];

export default function InvestView({ active, title }) {
  const { overview, detail, income, incomeDays, selectedId, products, openSheet, changeIncomeRange, refresh } = useApp();
  const { toast, confirm } = useUI();
  const [busy, setBusy] = useState(false);
  const kid = overview.children.find((c) => c.id === selectedId) || null;
  const bal = detail?.balances;
  const holdings = detail?.investments || [];
  const productOf = (inv) => (products || []).find((p) => p.id === inv.productId) || null;

  const redeem = async (inv) => {
    const ok = await confirm({
      title: `赎回 ${inv.productName}？`,
      message: `本金 ${money(inv.amount)}，已产生收益 ${money(inv.accrued)}。\n赎回后 ${money(inv.amount + inv.accrued)} 将立即回到零花钱余额。`,
      okText: '赎回', cancelText: '再想想',
    });
    if (!ok || busy) return;
    setBusy(true);
    try {
      const r = await api.redeem(inv.id);
      toast(`已赎回，到账 ${money(inv.amount + r.gain)}`);
      await refresh();
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  return (
    <ViewShell title={title} active={active}>
      <div className="pt-3"><ChildChips /></div>

      {/* 收益区间 */}
      <div className="mt-3 rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <div className="text-[13px] text-ink2">{RANGE_LABEL[incomeDays] || '近1周'}理财收益</div>
          <div className="num text-[24px] font-bold text-[#248A3D]">+{money(income?.total || 0)}</div>
        </div>
        <div className="mt-3">
          <Segmented
            items={RANGE_ITEMS}
            value={RANGE_LABEL[incomeDays] || '近1周'}
            onChange={(label) => changeIncomeRange(RANGE_DAYS[RANGE_ITEMS.indexOf(label)])}
          />
        </div>
        <div className="mt-4">
          <IncomeChart series={income?.series || []} />
        </div>
        {bal && (
          <div className="mt-4 grid grid-cols-3 border-t border-black/5 pt-3 text-center">
            <div>
              <div className="num text-[15px] font-semibold">{money(bal.invested)}</div>
              <div className="mt-0.5 text-[11px] text-ink2">理财中本金</div>
            </div>
            <div>
              <div className="num text-[15px] font-semibold">{money(bal.cash)}</div>
              <div className="mt-0.5 text-[11px] text-ink2">可用现金</div>
            </div>
            <div>
              <div className="num text-[15px] font-semibold text-[#248A3D]">+{money(bal.accrued)}</div>
              <div className="mt-0.5 text-[11px] text-ink2">累计收益</div>
            </div>
          </div>
        )}
      </div>

      {/* 持仓 */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-[15px] font-semibold">我的持仓</div>
        <button onClick={() => kid && openSheet('invest', kid.id)}
          className={`text-[14px] font-medium active:opacity-60 ${kid ? 'text-ios-blue' : 'text-ink2'}`}>＋ 买入</button>
      </div>

      {holdings.length === 0 ? (
        <div className="mt-2 rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="text-[40px]">🌱</div>
          <div className="mt-2 text-[15px] font-semibold">还没有持仓</div>
          <div className="mt-1 text-[13px] text-ink2">把闲钱存进来，让它慢慢长大</div>
          {kid && (
            <button onClick={() => openSheet('invest', kid.id)}
              className="mt-4 rounded-full bg-ios-blue px-5 py-2 text-[13px] font-semibold text-white active:opacity-80">
              去买入
            </button>
          )}
        </div>
      ) : (
        <div className="mt-2 divide-y divide-black/5 rounded-2xl bg-white shadow-sm">
          {holdings.map((inv) => {
            const p = productOf(inv);
            const color = p?.color || '#007AFF';
            const termText = inv.termDays > 0
              ? (inv.matured
                ? `已于 ${shortDate(inv.matureDate)} 到期`
                : `剩余 ${inv.daysLeft} 天到期（${shortDate(inv.matureDate)}）`)
              : '随存随取';
            return (
              <button key={inv.id} onClick={() => redeem(inv)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/[0.03]">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-[18px]"
                  style={{ backgroundColor: color + '1A' }}>📈</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[15px] font-medium">{inv.productName}</span>
                    {p && (
                      <span className="shrink-0 rounded-full px-1.5 py-px text-[10px] text-white" style={{ backgroundColor: color }}>{p.tag}</span>
                    )}
                    {inv.matured && (
                      <span className="shrink-0 rounded-full bg-ios-red/10 px-1.5 py-px text-[10px] text-ios-red">已到期</span>
                    )}
                    {!inv.matured && inv.daysLeft != null && inv.daysLeft <= 7 && (
                      <span className="shrink-0 rounded-full bg-ios-orange/10 px-1.5 py-px text-[10px] text-ios-orange">{inv.daysLeft}天后到期</span>
                    )}
                  </span>
                  <span className="num mt-0.5 block truncate text-[12px] text-ink2">年化 {inv.ratePct}% · {termText}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="num block text-[15px] font-semibold">{money(inv.amount)}</span>
                  <span className="num block text-[11px] font-semibold text-[#248A3D]">已赚 +{money(inv.accrued)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-[12px] leading-relaxed text-ink2">
        收益按天结算：每日收益 = 本金 × 年化利率 ÷ 365。
        <br />
        定期到期后可赎回本息，也可提前赎回（演示环境不罚息）。
      </p>
    </ViewShell>
  );
}
