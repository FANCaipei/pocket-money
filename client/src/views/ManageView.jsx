/** 管理页：孩子管理 / 数据重置 / 关于 */
import { useState } from 'react';
import { ViewShell } from '../components/layout.jsx';
import { useApp } from '../context.jsx';
import { useUI } from '../components/ui.jsx';
import { api } from '../api.js';
import { money } from '../fmt.js';

const ROW_ICON = 'grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[17px]';
const ROW_BODY = 'min-w-0 flex-1';
const ROW_TITLE = 'block text-[15px] font-medium';

export default function ManageView({ active, title }) {
  const { overview, refresh, openSheet } = useApp();
  const { toast, confirm } = useUI();
  const [busy, setBusy] = useState(false);
  const kids = overview.children;

  const removeChild = async (c) => {
    const ok = await confirm({
      title: `删除「${c.name}」？`,
      message: 'TA 的所有记账和理财记录将一并删除，无法恢复。',
      okText: '删除', danger: true,
    });
    if (!ok || busy) return;
    setBusy(true);
    try {
      await api.deleteChild(c.id);
      toast('已删除');
      await refresh();
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  const resetDemo = async () => {
    const ok = await confirm({
      title: '重置演示数据？',
      message: '当前所有数据将被覆盖，恢复为初始化示例数据。',
      okText: '重置', danger: true,
    });
    if (!ok || busy) return;
    setBusy(true);
    try {
      localStorage.removeItem('pm.selected');
      await api.reset();
      toast('已恢复演示数据');
      await refresh();
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  return (
    <ViewShell title={title} active={active}>
      <h1 className="pt-3 text-[28px] font-bold tracking-tight">管理</h1>

      {/* 孩子管理 */}
      <div className="mt-4 text-[15px] font-semibold">孩子管理</div>
      <div className="mt-2 divide-y divide-black/5 rounded-2xl bg-white shadow-sm">
        {kids.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[20px]"
              style={{ backgroundColor: c.color + '22' }}>{c.avatar}</span>
            <span className={ROW_BODY}>
              <span className={ROW_TITLE}>{c.name}</span>
              <span className="num block text-[12px] text-ink2">总资产 {money(c.balances.total)}</span>
            </span>
            <button onClick={() => removeChild(c)} className="shrink-0 text-[14px] text-ink2 active:opacity-60">删除 ›</button>
          </div>
        ))}
        <button onClick={() => openSheet('addChild')} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/[0.03]">
          <span className={`${ROW_ICON} bg-ios-blue/10 text-ios-blue`}>＋</span>
          <span className={`${ROW_BODY} text-ios-blue`}>
            <span className={`${ROW_TITLE} text-ios-blue`}>添加孩子</span>
          </span>
        </button>
      </div>

      {/* 数据 */}
      <div className="mt-6 text-[15px] font-semibold">数据</div>
      <div className="mt-2 divide-y divide-black/5 rounded-2xl bg-white shadow-sm">
        <button onClick={resetDemo} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/[0.03]">
          <span className={`${ROW_ICON}`} style={{ backgroundColor: 'rgba(255,59,48,.12)' }}>♻️</span>
          <span className={ROW_BODY}>
            <span className={`${ROW_TITLE} text-ios-red`}>重置演示数据</span>
            <span className="block text-[12px] text-ink2">清空并恢复为初始化示例数据</span>
          </span>
        </button>
      </div>

      {/* 关于 */}
      <div className="mt-6 text-[15px] font-semibold">关于</div>
      <div className="mt-2 divide-y divide-black/5 rounded-2xl bg-white shadow-sm">
        <div className="px-4 py-3">
          <div className={ROW_TITLE}>零花钱管家</div>
          <div className="mt-0.5 text-[12px] text-ink2">v2.0.0 · React + Tailwind CSS / Express + SQLite</div>
        </div>
        <div className="px-4 py-3">
          <div className={ROW_TITLE}>理财产品与利率</div>
          <div className="mt-0.5 text-[12px] text-ink2">演示数据（写死），可在 server/finance.js 修改</div>
        </div>
        <div className="px-4 py-3">
          <div className={ROW_TITLE}>使用方式</div>
          <div className="mt-0.5 text-[12px] text-ink2">家庭局域网 · 手机浏览器访问</div>
        </div>
      </div>

      <p className="mt-6 text-center text-[12px] leading-relaxed text-ink2">
        所有数据保存在服务器 SQLite 数据库（data/pocket-money.db，Docker 卷持久化），
        无需登录，全家在同一网络下即可使用。
      </p>
    </ViewShell>
  );
}
