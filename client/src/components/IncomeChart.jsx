/** 收益柱状图：最近 N 天每日收益 */
import { money, shortDate } from '../fmt.js';

export function IncomeChart({ series }) {
  if (!series?.length) {
    return <div className="mt-4 grid h-[140px] place-items-center rounded-xl bg-black/[0.03] text-[13px] text-ink2">暂无数据</div>;
  }
  const max = Math.max(...series.map((x) => x.income), 1);
  return (
    <>
      <div className="mt-4 flex h-[140px] items-end gap-[3px]">
        {series.map((x, i) => {
          const today = i === series.length - 1;
          const h = x.income > 0 ? Math.max(4, (x.income / max) * 100) : 2;
          return (
            <div
              key={x.date}
              title={`${x.date} ${money(x.income)}`}
              className={`flex-1 rounded-t-[3px] ${x.income > 0 ? (today ? 'bg-ios-blue' : 'bg-ios-blue/45') : 'bg-black/[0.08]'}`}
              style={{ height: `${h}%` }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-ink2">
        <span>{shortDate(series[0].date)}</span>
        <span>今天</span>
      </div>
    </>
  );
}
