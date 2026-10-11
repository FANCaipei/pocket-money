/** Tab 图标（线性风格，与 iOS 系统图标气质一致） */
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Svg({ size = 24, className = '', children }) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">{children}</svg>
  );
}

export function IconHome(props) {
  return (
    <Svg {...props}>
      <path d="M4 11.2 12 4.5l8 6.7" />
      <path d="M6 9.9V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.9" />
      <path d="M10 20v-5.2h4V20" />
    </Svg>
  );
}

export function IconLedger(props) {
  return (
    <Svg {...props}>
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <path d="M9 8.5h6M9 12h6M9 15.5h3.5" />
    </Svg>
  );
}

export function IconInvest(props) {
  return (
    <Svg {...props}>
      <path d="M4 20.2h16" />
      <path d="M6.2 19.5v-6.6M11.2 19.5V6.8M16.2 19.5v-9.8" />
    </Svg>
  );
}

export function IconManage(props) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8.3" r="3.3" />
      <path d="M3.4 19.5c.6-3.1 2.9-4.8 5.6-4.8s5 1.7 5.6 4.8" />
      <path d="M15.4 5.6a3.3 3.3 0 1 1 0 5.5M16.6 14.9c2.2.5 3.6 2 4.1 4.6" />
    </Svg>
  );
}
