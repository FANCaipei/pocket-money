/** 应用外壳：全局状态 / 视图切换 / 弹层调度 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppCtx } from './context.jsx';
import { useUI } from './components/ui.jsx';
import { Sheet } from './components/ui.jsx';
import { TabBar } from './components/layout.jsx';
import { ExpenseForm, DepositForm, AddChildForm, InvestForm, ChildActionSheet } from './components/forms.jsx';
import HomeView from './views/HomeView.jsx';
import LedgerView from './views/LedgerView.jsx';
import InvestView from './views/InvestView.jsx';
import ManageView from './views/ManageView.jsx';
import { api } from './api.js';

const VIEWS = [
  { key: 'home', title: '零花钱管家', Comp: HomeView },
  { key: 'records', title: '记账', Comp: LedgerView },
  { key: 'invest', title: '理财', Comp: InvestView },
  { key: 'manage', title: '管理', Comp: ManageView },
];

const SHEET_TITLES = {
  expense: '记一笔消费',
  deposit: '入金',
  addChild: '添加孩子',
  invest: '买入理财',
};

function SheetHost({ sheet, closeSheet, kids }) {
  if (!sheet) return null;
  const kid = kids.find((c) => c.id === sheet.id) || null;
  const title = sheet.type === 'childAction'
    ? `${kid ? kid.avatar + ' ' + kid.name : ''}`
    : SHEET_TITLES[sheet.type];

  let body = null;
  if (sheet.type === 'expense') body = <ExpenseForm child={kid} />;
  else if (sheet.type === 'deposit') body = <DepositForm child={kid} />;
  else if (sheet.type === 'addChild') body = <AddChildForm />;
  else if (sheet.type === 'invest') body = <InvestForm child={kid} />;
  else if (sheet.type === 'childAction') body = <ChildActionSheet kid={kid} />;

  return (
    <Sheet title={title} onClosed={closeSheet}>{body}</Sheet>
  );
}

export default function App() {
  const { toast } = useUI();
  const [overview, setOverview] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem('pm.selected') || null);
  const [detail, setDetail] = useState(null);
  const [income, setIncome] = useState(null);
  const [incomeDays, setIncomeDays] = useState(() => Number(localStorage.getItem('pm.incomeDays')) || 7);
  const [tab, setTab] = useState('home');
  const [sheet, setSheet] = useState(null); // { type, id }
  const [version, setVersion] = useState(0);
  const [error, setError] = useState(null);

  // 修正选中的孩子（不存在则取第一个）
  const fixSelected = useCallback((ov) => {
    setSelectedId((cur) => {
      const ok = cur && ov.children.some((c) => c.id === cur);
      const next = ok ? cur : (ov.children[0]?.id ?? null);
      if (next) localStorage.setItem('pm.selected', next);
      else localStorage.removeItem('pm.selected');
      return next;
    });
  }, []);

  // 首次加载：概览 + 产品
  useEffect(() => {
    let alive = true;
    Promise.all([api.overview(), api.products()])
      .then(([ov, pr]) => {
        if (!alive) return;
        setOverview(ov);
        setProducts(pr.products);
        fixSelected(ov);
        setError(null);
      })
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [fixSelected]);

  /** 全量刷新（任何写操作后调用） */
  const refresh = useCallback(async () => {
    const ov = await api.overview();
    setOverview(ov);
    fixSelected(ov);
    setVersion((v) => v + 1);
  }, [fixSelected]);

  // 选中孩子 / 收益区间 / 数据版本 变化 -> 重取详情与收益
  useEffect(() => {
    if (!selectedId) { setDetail(null); setIncome(null); return undefined; }
    let alive = true;
    Promise.all([api.child(selectedId), api.income(selectedId, incomeDays)])
      .then(([d, inc]) => {
        if (!alive) return;
        setDetail(d);
        setIncome(inc);
      })
      .catch((e) => alive && toast(e.message, 'error'));
    return () => { alive = false; };
  }, [selectedId, incomeDays, version, toast]);

  const selectChild = useCallback((id) => {
    setSelectedId(id);
    if (id) localStorage.setItem('pm.selected', id);
    else localStorage.removeItem('pm.selected');
  }, []);

  const changeIncomeRange = useCallback((days) => {
    setIncomeDays(days);
    localStorage.setItem('pm.incomeDays', String(days));
  }, []);

  const openSheet = useCallback((type, id = null) => setSheet({ type, id }), []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const switchTab = useCallback((t) => setTab(t), []);

  const ctx = useMemo(() => ({
    overview, products, selectedId, detail, income, incomeDays, version, tab,
    refresh, selectChild, changeIncomeRange, openSheet, closeSheet, switchTab,
  }), [overview, products, selectedId, detail, income, incomeDays, version, tab,
    refresh, selectChild, changeIncomeRange, openSheet, closeSheet, switchTab]);

  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center bg-app-bg px-8 text-center">
        <div>
          <div className="text-[44px]">📵</div>
          <div className="mt-3 text-[16px] font-semibold">连不上服务器</div>
          <div className="mt-1 text-[13px] text-ink2">{error}</div>
          <button onClick={() => location.reload()}
            className="mt-5 rounded-[12px] bg-ios-blue px-5 py-2.5 text-[14px] font-semibold text-white active:opacity-80">
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="grid min-h-dvh place-items-center bg-app-bg">
        <div className="animate-pulse text-center">
          <div className="text-[52px]">🐷</div>
          <div className="mt-2 text-[14px] text-ink2">零花钱管家加载中…</div>
        </div>
      </div>
    );
  }

  const kids = overview.children;

  return (
    <AppCtx.Provider value={ctx}>
      <div className="fixed inset-0 overflow-hidden bg-app-bg">
        {VIEWS.map(({ key, title, Comp }) => (
          <Comp key={key} active={tab === key} title={title} />
        ))}
        <TabBar />
        <SheetHost sheet={sheet} closeSheet={closeSheet} kids={kids} />
      </div>
    </AppCtx.Provider>
  );
}
