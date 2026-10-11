/** UI 基础设施：Toast / iOS 弹窗 / 底部弹层 / 分段控件 / 数字滚动 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/* ================= Toast + 弹窗 ================= */

const UICtx = createContext(null);
export const useUI = () => useContext(UICtx);

let toastSeq = 0;

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, type = 'ok') => {
    const id = ++toastSeq;
    setToasts((ts) => [...ts, { id, msg, type }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 2400);
  }, []);

  // Promise 化确认弹窗：confirm({ title, message, okText, cancelText, danger })
  const [dialog, setDialog] = useState(null);
  const confirm = useCallback((opts) => new Promise((resolve) => {
    setDialog({
      title: opts.title, message: opts.message || '',
      okText: opts.okText || '确定', cancelText: opts.cancelText || '取消',
      danger: !!opts.danger, resolve,
    });
  }), []);
  const closeDialog = useCallback((v) => {
    setDialog((d) => { if (d) d.resolve(v); return null; });
  }, []);

  return (
    <UICtx.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast 层 */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-center pt-[calc(env(safe-area-inset-top)+12px)]">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type === 'error' ? 'toast-error' : ''}`}>{t.msg}</div>
        ))}
      </div>

      {/* 弹窗层 */}
      {dialog && (
        <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeDialog(null); }}>
          <div className="dialog" role="alertdialog">
            <div className="px-5 pt-5 text-center text-[17px] font-semibold">{dialog.title}</div>
            {dialog.message && (
              <div className="mt-1.5 whitespace-pre-line px-5 text-center text-[13px] leading-relaxed text-ink2">{dialog.message}</div>
            )}
            <div className="mt-4 grid grid-cols-2 divide-x divide-black/10 border-t border-black/10">
              <button className="dialog-btn h-[44px] text-[16px] font-semibold text-ios-blue" onClick={() => closeDialog(false)}>
                {dialog.cancelText}
              </button>
              <button className={`dialog-btn h-[44px] text-[16px] ${dialog.danger ? 'text-ios-red' : 'text-ios-blue'}`} onClick={() => closeDialog(true)}>
                {dialog.okText}
              </button>
            </div>
          </div>
        </div>
      )}
    </UICtx.Provider>
  );
}

/* ================= 底部弹层 ================= */

const SheetCloseCtx = createContext(() => {});
export const useSheetClose = () => useContext(SheetCloseCtx);

export function Sheet({ title, onClosed, children }) {
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);
  const close = useCallback(() => setClosing(true), []);

  useEffect(() => {
    if (!closing) return undefined;
    const t = setTimeout(onClosed, 320);
    return () => clearTimeout(t);
  }, [closing, onClosed]);

  // 下拉关闭（抓握区拖拽）
  const [dy, setDy] = useState(0);
  const startY = useRef(0);
  const dragging = useRef(false);
  const onTouchStart = (e) => { startY.current = e.touches[0].clientY; dragging.current = true; };
  const onTouchMove = (e) => {
    if (!dragging.current) return;
    setDy(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd = () => {
    dragging.current = false;
    if (dy > 90) close(); else setDy(0);
  };

  const style = dy
    ? { transform: `translate(-50%, ${dy}px)`, transition: 'none' }
    : { transition: 'transform .25s' };

  return (
    <>
      <div className={`sheet-backdrop ${closing ? 'out' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }} />
      <div
        className={`sheet ${entered ? 'entered' : ''} ${closing ? 'out' : ''}`}
        style={style}
        onAnimationEnd={() => setEntered(true)}
      >
        <div className="mx-auto w-full max-w-[520px]">
          <div className="sheet-grabber" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} />
          <div className="flex items-center justify-between px-5 pt-1">
            <div className="text-[17px] font-semibold">{title}</div>
            <button
              aria-label="关闭" onClick={close}
              className="grid h-7 w-7 place-items-center rounded-full bg-black/[0.06] text-[12px] text-ink2 active:scale-95"
            >✕</button>
          </div>
          <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
            <SheetCloseCtx.Provider value={close}>
              {children}
            </SheetCloseCtx.Provider>
          </div>
        </div>
      </div>
    </>
  );
}

/* ================= 分段控件 ================= */

export function Segmented({ items, value, onChange }) {
  const idx = Math.max(0, items.indexOf(value));
  return (
    <div className="relative grid rounded-[10px] bg-black/[0.05] p-[2px] text-[13px] font-medium" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      <div
        className="absolute inset-y-[2px] left-[2px] rounded-[8px] bg-white shadow-[0_1px_4px_rgba(0,0,0,.12)] transition-transform duration-200"
        style={{ width: `calc((100% - 4px) / ${items.length})`, transform: `translateX(${idx * 100}%)` }}
      />
      {items.map((t, i) => (
        <button
          key={t} onClick={() => onChange(t)}
          className={`relative z-10 h-[28px] rounded-[8px] transition-colors ${i === idx ? 'text-ink' : 'text-ink2'}`}
        >{t}</button>
      ))}
    </div>
  );
}

/* ================= 数字滚动 ================= */

export function CountUp({ value, className = '', prefix = '¥' }) {
  const [display, setDisplay] = useState(value / 100);
  const prevRef = useRef(0);

  useEffect(() => {
    const target = value / 100;
    const start = prevRef.current;
    const t0 = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 560);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(start + (target - start) * e);
      if (p < 1) raf = requestAnimationFrame(step);
      else prevRef.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className={className}>
      {prefix}{display.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}
