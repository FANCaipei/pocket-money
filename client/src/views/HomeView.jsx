/** 首页：家庭总资产 + 孩子卡片 + 快捷操作 */
import { ViewShell } from '../components/layout.jsx';
import { useApp } from '../context.jsx';
import { CountUp, useUI } from '../components/ui.jsx';
import { money, dateLabel, todayStr } from '../fmt.js';

export default function HomeView({ active, title }) {
  const { overview, selectChild, openSheet } = useApp();
  const { toast } = useUI();
  const fam = overview.family;
  const kids = overview.children;

  const quick = (type) => {
    if (!overview.children.length) return toast('请先添加孩子', 'error');
    openSheet(type, overview.children[0].id);
  };

  return (
    <ViewShell title={title} active={active}>
      <h1 className="pt-3 text-[28px] font-bold tracking-tight">零花钱</h1>
      <p className="mt-0.5 text-[13px] text-ink2">{dateLabel(todayStr())} · 家庭共享账本</p>

      {/* 家庭总资产 */}
      <div className="mt-4 rounded-3xl bg-white p-5 shadow-sm">
        <div className="text-[13px] text-ink2">家庭总资产</div>
        <CountUp value={fam.total} className="num mt-1 block text-[38px] font-bold leading-tight tracking-tight" />
        <div className="mt-3 grid grid-cols-3 border-t border-black/5 pt-3 text-center">
          <div>
            <div className="num text-[15px] font-semibold">{money(fam.cash)}</div>
            <div className="mt-0.5 text-[11px] text-ink2">现金</div>
          </div>
          <div>
            <div className="num text-[15px] font-semibold">{money(fam.invested)}</div>
            <div className="mt-0.5 text-[11px] text-ink2">理财中</div>
          </div>
          <div>
            <div className="num text-[15px] font-semibold text-[#248A3D]">+{money(fam.monthIncome)}</div>
            <div className="mt-0.5 text-[11px] text-ink2">近30天收益</div>
          </div>
        </div>
      </div>

      {/* 快捷操作 */}
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

      {/* 我的孩子 */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-[15px] font-semibold">我的孩子们</div>
        <button onClick={() => openSheet('addChild')} className="text-[14px] font-medium text-ios-blue active:opacity-60">＋ 添加</button>
      </div>

      {kids.length === 0 ? (
        <button onClick={() => openSheet('addChild')}
          className="mt-2 w-full rounded-2xl bg-white p-8 text-center shadow-sm active:opacity-80">
          <div className="text-[40px]">🐷</div>
          <div className="mt-2 text-[15px] font-semibold">还没有孩子</div>
          <div className="mt-1 text-[13px] text-ink2">点击创建第一个孩子的账户</div>
        </button>
      ) : (
        kids.map((c) => (
          <button key={c.id}
            onClick={() => { selectChild(c.id); openSheet('childAction', c.id); }}
            className="mt-2 flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm transition-transform active:scale-[0.98]">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[22px]"
              style={{ backgroundColor: c.color + '22' }}>{c.avatar}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-semibold">{c.name}</span>
              <span className="num mt-0.5 block truncate text-[12px] text-ink2">
                理财中 {money(c.balances.invested)} · 总资产 {money(c.balances.total)}
              </span>
            </span>
            <span className="text-right">
              <span className="num block text-[17px] font-bold">{money(c.balances.cash)}</span>
              <span className="mt-0.5 block text-[11px] text-ink2">可用零花钱</span>
            </span>
          </button>
        ))
      )}

      <p className="mt-6 text-center text-[12px] leading-relaxed text-ink2">
        提示：点击孩子卡片可快速记账、入金或去理财。
      </p>
    </ViewShell>
  );
}
