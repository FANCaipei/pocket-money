/** 弹层表单：记消费 / 入金 / 添加孩子 / 买入理财 / 孩子快捷操作 */
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context.jsx';
import { useUI, useSheetClose } from './ui.jsx';
import { api } from '../api.js';
import { CATS, AVATARS, AVATAR_COLORS, money, parseAmount, todayStr } from '../fmt.js';

const labelCls = 'mb-1.5 mt-4 block text-[13px] text-ink2';
const inputCls = 'h-[42px] w-full rounded-[12px] bg-black/[0.05] px-3 text-[15px] outline-none focus:ring-2 focus:ring-ios-blue/40';
const primaryBtn = 'mt-6 h-[48px] w-full rounded-[14px] bg-ios-blue text-[16px] font-semibold text-white active:opacity-80 disabled:opacity-50';

function AmountInput({ value, onChange, autoFocus }) {
  const ref = useRef(null);
  useEffect(() => { if (autoFocus) { const t = setTimeout(() => ref.current?.focus(), 480); return () => clearTimeout(t); } }, [autoFocus]);
  return (
    <div className="flex h-[46px] items-center rounded-[12px] bg-black/[0.05] px-3 focus-within:ring-2 focus-within:ring-ios-blue/40">
      <span className="mr-1 text-[20px] text-ink2">¥</span>
      <input
        ref={ref}
        type="text" inputMode="decimal" placeholder="0.00" value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-[22px] font-semibold outline-none placeholder:font-normal placeholder:text-black/25"
      />
    </div>
  );
}

/* ================= 记一笔消费 ================= */
export function ExpenseForm({ child }) {
  const { refresh } = useApp();
  const { toast } = useUI();
  const close = useSheetClose();
  const [cat, setCat] = useState(CATS[0]);
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const itemRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => itemRef.current?.focus(), 480); return () => clearTimeout(t); }, []);

  const submit = async () => {
    const cents = parseAmount(amount);
    if (Number.isNaN(cents)) return toast('请输入正确的金额', 'error');
    setSaving(true);
    try {
      await api.addTransaction(child.id, {
        type: 'expense', amount: cents,
        item: item.trim() || cat.name, note: note.trim(), date, category: cat.key,
      });
      close();
      toast('记好啦 ✅');
      await refresh();
    } catch (e) { toast(e.message, 'error'); setSaving(false); }
  };

  return (
    <div>
      <div className={labelCls}>买了什么类型</div>
      <div className="grid grid-cols-3 gap-2">
        {CATS.map((c) => (
          <button key={c.key} onClick={() => setCat(c)}
            className={`flex h-[38px] items-center justify-center gap-1.5 rounded-[10px] text-[14px] font-medium transition-colors ${cat.key === c.key ? '' : 'bg-black/[0.05] text-ink'}`}
            style={cat.key === c.key ? { backgroundColor: c.color, color: '#fff' } : undefined}>
            <span>{c.emoji}</span>{c.name}
          </button>
        ))}
      </div>

      <label className={labelCls}>消费项目</label>
      <input ref={itemRef} value={item} onChange={(e) => setItem(e.target.value)} maxLength={12}
        placeholder={`如：${cat.name}`} className={inputCls} />

      <div className={labelCls}>金额</div>
      <AmountInput value={amount} onChange={setAmount} />

      <label className={labelCls}>日期</label>
      <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} className={inputCls} />

      <label className={labelCls}>备注（可不填）</label>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={30}
        placeholder="说点什么吧" className={inputCls} />

      <button disabled={saving} onClick={submit} className={primaryBtn}>{saving ? '保存中…' : '记下来'}</button>
    </div>
  );
}

/* ================= 入金 ================= */
const SOURCES = [
  { emoji: '📅', label: '每周零花钱' },
  { emoji: '🏅', label: '奖励' },
  { emoji: '🧧', label: '压岁钱' },
  { emoji: '💼', label: '其他' },
];

export function DepositForm({ child }) {
  const { refresh } = useApp();
  const { toast } = useUI();
  const close = useSheetClose();
  const [src, setSrc] = useState(SOURCES[0]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState(SOURCES[0].label);
  const [saving, setSaving] = useState(false);
  const noteRef = useRef(null);

  const pick = (s) => {
    setSrc(s);
    if (s.label === '其他') {
      setNote('');
      setTimeout(() => noteRef.current?.focus(), 100);
    } else setNote(s.label);
  };

  const submit = async () => {
    const cents = parseAmount(amount);
    if (Number.isNaN(cents)) return toast('请输入正确的金额', 'error');
    setSaving(true);
    try {
      await api.addTransaction(child.id, {
        type: 'deposit', amount: cents, item: '入金', note: note.trim(), date: todayStr(),
      });
      close();
      toast('入金成功 🎉');
      await refresh();
    } catch (e) { toast(e.message, 'error'); setSaving(false); }
  };

  return (
    <div>
      <div className={labelCls}>这笔钱从哪儿来</div>
      <div className="grid grid-cols-4 gap-2">
        {SOURCES.map((s) => (
          <button key={s.label} onClick={() => pick(s)}
            className={`flex h-[56px] flex-col items-center justify-center gap-1 rounded-[12px] text-[12px] font-medium transition-colors ${src.label === s.label ? 'bg-ios-green text-white' : 'bg-black/[0.05] text-ink'}`}>
            <span className="text-[18px]">{s.emoji}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-4">金额</div>
      <AmountInput value={amount} onChange={setAmount} />

      <label className={labelCls}>备注（可不填）</label>
      <input ref={noteRef} value={note} onChange={(e) => setNote(e.target.value)} maxLength={30}
        placeholder="如：期末奖励" className={inputCls} />

      <button disabled={saving} onClick={submit}
        className="mt-6 h-[48px] w-full rounded-[14px] bg-ios-green text-[16px] font-semibold text-white active:opacity-80 disabled:opacity-50">
        {saving ? '保存中…' : '存进来'}
      </button>
    </div>
  );
}

/* ================= 添加孩子 ================= */
export function AddChildForm() {
  const { refresh, selectChild } = useApp();
  const { toast } = useUI();
  const close = useSheetClose();
  const [name, setName] = useState('');
  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => nameRef.current?.focus(), 480); return () => clearTimeout(t); }, []);

  const submit = async () => {
    const n = name.trim();
    if (!n) return toast('先给孩子起个名字吧', 'error');
    setSaving(true);
    try {
      const r = await api.addChild({ name: n, avatar: AVATARS[idx], color: AVATAR_COLORS[idx % AVATAR_COLORS.length] });
      close();
      selectChild(r.child.id);
      toast(`欢迎 ${n}！`);
      await refresh();
    } catch (e) { toast(e.message, 'error'); setSaving(false); }
  };

  return (
    <div>
      <label className={labelCls}>孩子的名字</label>
      <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} maxLength={12}
        placeholder="如：朵朵" className={inputCls} />

      <div className={labelCls}>选个头像</div>
      <div className="grid grid-cols-6 gap-2">
        {AVATARS.map((a, i) => (
          <button key={a} onClick={() => setIdx(i)}
            className={`grid aspect-square place-items-center rounded-[12px] text-[22px] transition-all ${idx === i ? 'bg-ios-blue/10 ring-2 ring-ios-blue' : 'bg-black/[0.05]'}`}>
            {a}
          </button>
        ))}
      </div>

      <button disabled={saving} onClick={submit} className={primaryBtn}>{saving ? '创建中…' : '创建'}</button>
    </div>
  );
}

/* ================= 买入理财 ================= */
export function InvestForm({ child }) {
  const { detail, products, refresh } = useApp();
  const { toast } = useUI();
  const close = useSheetClose();
  const list = products || [];
  const [productId, setProductId] = useState(list[0]?.id);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const amountRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => amountRef.current?.focus(), 480); return () => clearTimeout(t); }, []);

  const p = list.find((x) => x.id === productId) || list[0];
  const avail = detail?.balances.cash ?? 0;
  const cents = parseAmount(amount);
  const daily = Number.isNaN(cents) ? 0 : Math.round(cents * p.rate / 365);
  const termGain = Number.isNaN(cents) ? 0 : Math.round(cents * p.rate * p.termDays / 365);

  const submit = async () => {
    if (Number.isNaN(cents)) return toast('请输入正确的金额', 'error');
    setSaving(true);
    try {
      await api.invest(child.id, { productId: p.id, amount: cents });
      close();
      toast('买入成功 🌱');
      await refresh();
    } catch (e) { toast(e.message, 'error'); setSaving(false); }
  };

  return (
    <div>
      <div className="rounded-[14px] bg-ios-blue/[0.08] px-4 py-3 text-[13px] leading-relaxed text-ink2">
        可用零花钱 <span className="num font-semibold text-ink">{money(avail)}</span>
        {p && <> · 按演示年化 <span className="font-semibold text-ink">{+(p.rate * 100).toFixed(2)}%</span> 计算</>}
        {p && cents > 0 && (
          <div className="mt-0.5">
            预计每日收益 <span className="num font-semibold text-ios-green">{money(daily)}</span>
            {p.termDays > 0 ? <> · 到期约 <span className="num font-semibold text-ios-green">{money(termGain)}</span></> : ' · 随存随取'}
          </div>
        )}
      </div>

      <div className={labelCls}>选个产品</div>
      <div className="flex flex-col gap-2">
        {list.map((x) => (
          <button key={x.id} onClick={() => setProductId(x.id)}
            className={`flex items-center gap-3 rounded-[14px] border-2 bg-white p-3 text-left transition-colors ${p.id === x.id ? 'border-ios-blue' : 'border-transparent bg-black/[0.03]'}`}>
            <span className="rounded-[10px] px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: x.color }}>{x.tag}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{x.name}</span>
              <span className="block truncate text-[12px] text-ink2">{x.desc}</span>
            </span>
            <span className="text-right">
              <span className="num block text-[17px] font-bold" style={{ color: x.color }}>{+(x.rate * 100).toFixed(2)}%</span>
              <span className="block text-[11px] text-ink2">年化利率</span>
            </span>
          </button>
        ))}
      </div>

      <div className={labelCls}>买入金额</div>
      <div className="flex h-[46px] items-center rounded-[12px] bg-black/[0.05] px-3 focus-within:ring-2 focus-within:ring-ios-blue/40">
        <span className="mr-1 text-[20px] text-ink2">¥</span>
        <input ref={amountRef} type="text" inputMode="decimal" placeholder="0.00" value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-transparent text-[22px] font-semibold outline-none placeholder:font-normal placeholder:text-black/25" />
        <button onClick={() => setAmount((avail / 100).toFixed(2))}
          className="ml-2 shrink-0 rounded-full bg-ios-blue/10 px-3 py-1 text-[12px] font-semibold text-ios-blue active:opacity-70">
          全部
        </button>
      </div>

      <button disabled={saving || !p} onClick={submit} className={primaryBtn}>{saving ? '买入中…' : '买入'}</button>
    </div>
  );
}

/* ================= 孩子快捷操作 ================= */
const ACTIONS = [
  { key: 'expense', emoji: '🛍️', title: '记消费', sub: '买了什么记一下', bg: 'rgba(255,59,48,.12)' },
  { key: 'deposit', emoji: '💰', title: '入金', sub: '零花钱到账啦', bg: 'rgba(52,199,89,.14)' },
  { key: 'invest',  emoji: '📈', title: '去理财', sub: '让闲钱生钱', bg: 'rgba(0,122,255,.12)' },
  { key: 'records', emoji: '🧾', title: '查看明细', sub: '每一笔都清清楚楚', bg: 'rgba(88,86,214,.12)' },
];

export function ChildActionSheet({ kid }) {
  const { selectChild, openSheet, switchTab } = useApp();
  const close = useSheetClose();
  if (!kid) return null;
  const go = (a) => {
    selectChild(kid.id);
    if (a.key === 'expense') { openSheet('expense', kid.id); switchTab('records'); }
    else if (a.key === 'deposit') { openSheet('deposit', kid.id); switchTab('records'); }
    else if (a.key === 'invest') { openSheet('invest', kid.id); switchTab('invest'); }
    else { switchTab(a.key); close(); }
  };
  return (
    <div className="flex flex-col gap-2">
      {ACTIONS.map((a) => (
        <button key={a.key} onClick={() => go(a)}
          className="flex items-center gap-3 rounded-[14px] bg-white p-3 text-left active:bg-black/[0.03]">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] text-[18px]" style={{ backgroundColor: a.bg }}>{a.emoji}</span>
          <span>
            <span className="block text-[15px] font-semibold">{a.title}</span>
            <span className="block text-[12px] text-ink2">{a.sub}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
