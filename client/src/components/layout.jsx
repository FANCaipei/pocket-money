/** 视图骨架 / 孩子切换 chips / 底部 TabBar */
import { useState } from 'react';
import { useApp } from '../context.jsx';
import { IconHome, IconLedger, IconInvest, IconManage } from './icons.jsx';

/**
 * 单个视图容器：绝对定位 + 独立滚动。
 * 非激活视图用 invisible（而非卸载或 display:none）保持滚动位置。
 */
export function ViewShell({ title, active, children }) {
  const [scrolled, setScrolled] = useState(false);
  return (
    <main
      className={`absolute inset-0 overflow-y-auto overscroll-contain transition-opacity duration-200 ${active ? '' : 'pointer-events-none invisible opacity-0'}`}
      onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 24)}
    >
      <div className={`sticky top-0 z-20 flex h-11 items-center justify-center bg-[#F2F2F7]/80 text-[16px] font-semibold backdrop-blur-xl transition-opacity duration-200 ${scrolled ? 'border-b border-black/5 opacity-100' : 'border-b border-transparent opacity-0'}`}>
        {title}
      </div>
      <div className="mx-auto w-full max-w-[520px] px-4 pb-32">{children}</div>
    </main>
  );
}

/** 孩子横向切换 chips（记账 / 理财页顶部） */
export function ChildChips() {
  const { overview, selectedId, selectChild } = useApp();
  const children = overview?.children || [];
  if (!children.length) return null;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children.map((c) => (
        <button key={c.id} onClick={() => selectChild(c.id)}
          className={`flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3.5 text-[14px] font-medium transition-colors ${selectedId === c.id ? 'bg-ios-blue text-white' : 'bg-white text-ink'}`}>
          <span className="grid h-6 w-6 place-items-center rounded-full text-[14px]" style={{ backgroundColor: c.color + '33' }}>{c.avatar}</span>
          {c.name}
        </button>
      ))}
    </div>
  );
}

const TABS = [
  { key: 'home', label: '首页', Icon: IconHome },
  { key: 'records', label: '记账', Icon: IconLedger },
  { key: 'invest', label: '理财', Icon: IconInvest },
  { key: 'manage', label: '管理', Icon: IconManage },
];

export function TabBar() {
  const { tab, switchTab } = useApp();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto grid max-w-[520px] grid-cols-4 border-t border-black/[0.06] bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => switchTab(key)}
            className={`flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10px] ${tab === key ? 'text-ios-blue' : 'text-ink2'}`}>
            <Icon size={26} />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
