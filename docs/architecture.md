# 零花钱管家 — 技术架构文档

> 版本：v2.0.0 | 更新日期：2026-10-11

---

## 1. 技术栈总览

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 前端框架 | React | 19.1 | 函数组件 + Hooks |
| 样式方案 | TailwindCSS | 4.1 | CSS-first `@theme` 配置，无 tailwind.config.js |
| 构建工具 | Vite | 7.0 | 开发服务器 + 生产构建 |
| 后端框架 | Express | 4.21 | REST API + 静态文件托管 |
| 数据库 | SQLite | node:sqlite | Node 22 内置模块，零原生依赖 |
| 运行时 | Node.js | >= 22.12 | 使用内置 `node:sqlite`（DatabaseSync） |
| 容器化 | Docker | node:22-alpine | 两阶段构建 |

---

## 2. 项目结构

```
pocket-money/
├── package.json                    # 根包：Express 依赖 + 脚本入口
├── Dockerfile                      # 两阶段构建
├── docker-compose.yml              # 本地容器编排
├── .dockerignore
│
├── server/                         # ── 后端 ──
│   ├── index.js                    # Express 应用、全部 API 路由、静态托管
│   ├── db.js                       # SQLite 数据层（建表 / CRUD / 事务）
│   ├── finance.js                  # 理财产品定义 + 收益计算引擎
│   ├── demo.js                     # 演示数据生成器（3 个孩子，多月历史）
│   └── store.js                    # 遗留 JSON 存储（保留用于迁移）
│
├── client/                         # ── 前端 ──
│   ├── package.json                # 前端依赖（React / TailwindCSS / Vite）
│   ├── vite.config.js              # Vite 配置（插件 / 代理 / 构建）
│   ├── index.html                  # SPA 入口（PWA meta）
│   ├── public/
│   │   ├── icon.svg                # 应用图标（渐变 + 🐷）
│   │   └── manifest.webmanifest    # PWA 清单（standalone 模式）
│   └── src/
│       ├── main.jsx                # React 根挂载 + UIProvider
│       ├── App.jsx                 # 全局状态 / 视图切换 / 弹层调度
│       ├── api.js                  # HTTP 客户端（fetch 封装）
│       ├── context.jsx             # AppCtx 上下文 + useApp hook
│       ├── fmt.js                  # 格式化工具 + 常量定义
│       ├── index.css               # TailwindCSS v4 主题 + 自定义动画/组件
│       ├── views/
│       │   ├── HomeView.jsx        # 首页：家庭总资产 / 孩子卡片 / 快捷操作
│       │   ├── LedgerView.jsx      # 记账：余额统计 / 日期分组交易列表
│       │   ├── InvestView.jsx      # 理财：收益图表 / 持仓列表 / 赎回
│       │   └── ManageView.jsx      # 管理：孩子管理 / 重置数据 / 关于
│       └── components/
│           ├── layout.jsx          # ViewShell / ChildChips / TabBar
│           ├── ui.jsx              # UIProvider(Toast+弹窗) / Sheet / Segmented / CountUp
│           ├── forms.jsx           # ExpenseForm / DepositForm / AddChildForm / InvestForm / ChildActionSheet
│           ├── icons.jsx           # SVG Tab 图标（4 个）
│           └── IncomeChart.jsx     # 每日收益柱状图（纯 CSS 实现）
│
├── scripts/
│   └── smoke-test.mjs              # API 冒烟测试（30 项断言）
│
├── data/                           # 运行时数据目录
│   └── pocket-money.db             # SQLite 数据库（+ WAL/SHM）
│
└── docs/
    ├── requirements.md             # 功能需求文档
    └── architecture.md             # 本文档
```

---

## 3. 依赖清单

### 3.1 生产依赖（根 package.json）

| 包名 | 版本 | 用途 |
|------|------|------|
| express | ^4.21.2 | HTTP 服务器 + 静态托管 |

### 3.2 前端依赖（client/package.json）

| 包名 | 版本 | 类型 | 用途 |
|------|------|------|------|
| react | ^19.1.0 | 生产 | UI 框架 |
| react-dom | ^19.1.0 | 生产 | DOM 渲染 |
| vite | ^7.0.0 | 开发 | 构建工具 |
| @vitejs/plugin-react | ^5.0.0 | 开发 | Vite React 插件（Fast Refresh） |
| tailwindcss | ^4.1.4 | 开发 | 原子化 CSS 引擎 |
| @tailwindcss/vite | ^4.1.4 | 开发 | TailwindCSS v4 Vite 插件 |

---

## 4. 构建与部署

### 4.1 开发模式

```
┌─────────────────────┐       ┌─────────────────────┐
│  Vite Dev Server    │       │  Express Server      │
│  localhost:5173     │──────▶│  localhost:3000      │
│                     │ /api  │                      │
│  React HMR          │ proxy │  API Routes          │
│  TailwindCSS JIT    │       │  SQLite              │
└─────────────────────┘       └─────────────────────┘
```

- 前端：`npm run dev:client` → Vite 开发服务器（端口 5173），HMR 热更新
- 后端：`npm start` → Express（端口 3000）
- Vite 代理：所有 `/api` 请求转发到 `http://localhost:3000`

### 4.2 生产模式

```
┌──────────────────────────────────────┐
│  Express Server (单端口 3000)         │
│                                      │
│  /api/*    → API 路由                 │
│  /*        → client/dist 静态文件     │
│  非静态GET  → index.html (SPA 回退)   │
└──────────────────────────────────────┘
```

- 构建：`npm run build` → 输出 `client/dist/`
- 静态托管：`express.static(client/dist, { index: 'index.html', maxAge: 0 })`
- SPA 回退：非 API 的 GET/HEAD 请求返回 `index.html`
- 非 GET/HEAD 的回退请求返回 405

### 4.3 Docker 部署

**两阶段构建：**

```dockerfile
# Stage 1: 构建前端
FROM node:22-alpine AS build
WORKDIR /app/client
COPY client/package*.json .
RUN npm ci
COPY client/ .
RUN npm run build

# Stage 2: 运行时镜像
FROM node:22-alpine
ENV TZ=Asia/Shanghai NODE_ENV=production PORT=3000 DATA_DIR=/data
WORKDIR /app
COPY package*.json .
RUN npm ci --omit=dev
COPY server/ ./server/
COPY scripts/ ./scripts/
COPY --from=build /app/client/dist ./client/dist
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health
CMD ["node", "server/index.js"]
```

**Docker Compose：**

```yaml
services:
  pocket-money:
    build: .
    container_name: pocket-money
    ports: ["3000:3000"]
    environment:
      TZ: Asia/Shanghai
      PORT: "3000"
    volumes: ["./data:/data"]
    restart: unless-stopped
```

---

## 5. 后端架构

### 5.1 整体分层

```
server/index.js          路由层：HTTP 请求解析 → 参数校验 → 调用数据层 → 返回 JSON
    │
    ├── server/db.js     数据层：SQLite CRUD + 事务 + ID 生成
    │
    ├── server/finance.js  业务层：收益计算 + 余额聚合 + 收益系列
    │
    └── server/demo.js   数据初始化：演示数据事件回放引擎
```

### 5.2 Express 应用配置

```javascript
// server/index.js 关键配置
express()
  .disable('x-powered-by')           // 隐藏框架标识
  .use(express.json({ limit: '1mb' })) // JSON 解析，1MB 上限
  .listen(PORT, '0.0.0.0')           // 监听所有网卡
```

**工具函数：**

| 函数 | 用途 |
|------|------|
| `fail(res, msg, code)` | 统一错误响应 |
| `toCents(v)` | 校验金额为整数（分），非整数返回 NaN |
| `cleanStr(v, max)` | 去除首尾空白并截断到 max 长度 |
| `wrap(fn)` | 包裹异步路由处理器，统一捕获异常 |
| `overviewPayload()` | 聚合家庭概览数据（所有孩子余额 + 家庭总计 + 30 天收益） |

### 5.3 数据层（db.js）

**数据库引擎：** Node 22 内置 `node:sqlite` 模块的 `DatabaseSync` 类，无需编译原生扩展。

**PRAGMA 配置：**

```sql
PRAGMA journal_mode = WAL;     -- Write-Ahead Logging，优化并发读
PRAGMA foreign_keys = ON;      -- 启用外键约束
```

**ID 生成策略：** 通过 `counters` 表维护自增序列，生成前缀 ID：

```javascript
function nextId(prefix) {
  // INSERT OR UPDATE counters SET value = value + 1
  // 返回 `${prefix}${value}`，如 "c1", "t42", "i7"
}
```

**事务支持：**

```javascript
function withTransaction(fn) {
  // BEGIN → fn() → COMMIT
  // 异常时 ROLLBACK → 重新抛出
}
```

**行映射：** 所有数据库行通过 `mapChild()` / `mapTx()` / `mapInv()` 从 snake_case 转为 camelCase。

**启动引导（bootstrapData）：**

```
数据库为空？
  ├── 存在 db.json（v1 遗留）→ 解析并导入
  └── 不存在 → 调用 demo.build() 生成演示数据
```

### 5.4 收益计算引擎（finance.js）

**核心公式：**

```
每日收益 = Math.round(本金 × 年化利率 ÷ 365)    // 单位：分
```

**关键规则：**

| 规则 | 实现 |
|------|------|
| T+1 起息 | 买入当天不计息，`start + 1` 开始 |
| 逐日取整 | 每天独立 `Math.round`，保证日收益之和 = 总累计 |
| 定期到期停息 | 计息截止 = `min(赎回日, 到期日, 今天)` |
| 活期无到期日 | 计息截止 = `今天` |
| 同日赎回零收益 | 买入当天 = 赎回当天 → 计息天数 = 0 |

**日期工具（全部本地时区，无 UTC 问题）：**

| 函数 | 用途 |
|------|------|
| `todayStr()` | 当前日期 YYYY-MM-DD |
| `addDays(dateStr, n)` | 日期加 n 天 |
| `diffDays(a, b)` | b - a 的天数（使用 `Date.UTC` 避免夏令时） |
| `minDate(a, b)` / `maxDate(a, b)` | 取较早/较晚日期 |

**余额计算（childBalances）：**

```javascript
cash     = Σ 所有交易金额（入金/赎回为正，消费/买入为负）
invested = Σ 未赎回持仓本金
accrued  = Σ 未赎回持仓累计利息
total    = cash + invested + accrued
```

**收益系列（incomeSeries）：**

- 输入：孩子 ID + 天数（7/30/90）
- 输出：`{ days, from, to, series: [{date, income}], total }`
- 计算：对范围内每一天，汇总所有持仓（含已赎回）在该日的收益

### 5.5 演示数据生成器（demo.js）

**事件回放系统：**

```javascript
// 每个事件定义：{ d: daysAgo, kind: 'deposit'|'expense'|'invest'|'redeem', ... }
// 排序规则：时间正序，同日按 deposit → redeem → invest → expense 排序
// 回放过程跟踪现金余额，余额不足时跳过该事件（打印警告）
```

**三个孩子的数据规模：**

| 孩子 | 历史跨度 | 入金笔数 | 消费笔数 | 理财持仓 |
|------|----------|----------|----------|----------|
| 朵朵 | 18 周 | 23 | 17 | 3（活期 + 定期 + 理财） |
| 小虎 | 20 周 | 25 | 15 | 4（含 1 笔已赎回） |
| 果果 | 9 周 | 10 | 3 | 无 |

---

## 6. 前端架构

### 6.1 组件树

```
<main.jsx>
  <React.StrictMode>
    <UIProvider>                    ← Toast / 确认弹窗 上下文
      <App>                         ← 全局状态 + 数据获取
        <AppCtx.Provider>           ← 应用数据 上下文
          <div.fixed>
            <HomeView active={} />  ← 始终挂载，CSS 控制显隐
            <LedgerView active={} />
            <InvestView active={} />
            <ManageView active={} />
            <TabBar />              ← 底部导航
            <SheetHost />           ← 底部弹层（条件渲染）
          </div>
        </AppCtx.Provider>
      </App>
    </UIProvider>
  </React.StrictMode>
```

### 6.2 状态管理

**状态全部集中在 `App` 组件，通过 React Context 分发：**

| 状态 | 类型 | 持久化 | 说明 |
|------|------|--------|------|
| overview | object | 否 | 家庭概览（孩子列表 + 家庭总计） |
| products | array | 否 | 理财产品列表 |
| selectedId | string | localStorage `pm.selected` | 当前选中孩子 ID |
| detail | object | 否 | 选中孩子的详情（余额/交易/持仓） |
| income | object | 否 | 选中孩子的收益系列数据 |
| incomeDays | number | localStorage `pm.incomeDays` | 收益区间（7/30/90） |
| tab | string | 否 | 当前 Tab（home/records/invest/manage） |
| sheet | object \| null | 否 | 当前弹层 `{ type, id }` |
| version | number | 否 | 数据版本号（写操作后 +1） |
| error | string \| null | 否 | 连接错误信息 |

**数据流：**

```
首次加载
  └─ Promise.all([api.overview(), api.products()])
       └─ 设置 overview / products / 修正 selectedId

selectedId / incomeDays / version 变化
  └─ Promise.all([api.child(selectedId), api.income(selectedId, incomeDays)])
       └─ 设置 detail / income

任意写操作后
  └─ refresh() → api.overview() + setVersion(v+1)
       └─ 触发上方 effect → 重新获取 detail + income
```

**视图切换策略：** 4 个 View 组件始终挂载，非活跃视图通过 `invisible` + `opacity-0` + `pointer-events-none` 隐藏。这样切换 Tab 时保留滚动位置。

### 6.3 API 客户端（api.js）

单一 `req(method, url, body)` 函数封装 `fetch`：

```javascript
async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}
```

导出 11 个方法映射到全部服务端接口。

### 6.4 主题系统（index.css）

TailwindCSS v4 使用 CSS-first 配置，通过 `@theme` 指令定义设计令牌：

```css
@import "tailwindcss";

@theme {
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text",
               "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif;
  --color-app-bg: #F2F2F7;       /* 页面背景（iOS 浅灰） */
  --color-ios-blue: #007AFF;     /* 主操作色 */
  --color-ios-green: #34C759;    /* 成功 / 入金 */
  --color-ios-red: #FF3B30;      /* 危险 / 消费 */
  --color-ios-orange: #FF9500;   /* 警告 */
  --color-ink: #1C1C1E;          /* 主文字 */
  --color-ink2: #8E8E93;         /* 次文字 */
}
```

令牌自动映射为工具类：`bg-app-bg`、`text-ios-blue`、`bg-ios-green` 等。

**自定义 CSS 层：**

| 类别 | 内容 |
|------|------|
| 全局重置 | 100% 高度、抗锯齿、无点击高亮、无过滚动、无选中 |
| `.num` | `font-variant-numeric: tabular-nums` 数字等宽对齐 |
| 动画关键帧 | `sheet-up` / `sheet-down` / `fade-in` / `fade-out` / `dialog-pop` / `fade-up` / `toast-life` |
| 底部抽屉 | `.sheet-backdrop` / `.sheet` / `.sheet-grabber`（圆角 22px、cubic-bezier 弹性动画） |
| iOS 弹窗 | `.dialog-backdrop` / `.dialog`（280px 宽、模糊背景、scale 弹入） |
| Toast | `.toast` / `.toast-error`（胶囊形、模糊背景、2.4s 生命周期动画） |

### 6.5 布局组件（layout.jsx）

**ViewShell：**

- `position: absolute; inset: 0` 全屏容器
- 内部滚动，内容最大宽度 520px 居中
- 顶部粘性标题栏：滚动超过 24px 后显示，背景模糊（`backdrop-blur-xl`）
- 底部 32px 内边距（为 TabBar 留空）

**ChildChips：**

- 横向可滚动的孩子选择标签
- 选中态：蓝色背景 + 白色文字
- 未选中：白色背景

**TabBar：**

- 固定底部，4 个 Tab 按钮
- 使用 `env(safe-area-inset-bottom)` 适配 iPhone 底部安全区
- 白色模糊背景（`backdrop-blur-xl`）
- 活跃 Tab 蓝色文字 + 图标

### 6.6 UI 基础设施（ui.jsx）

**双层 Context 架构：**

```
UICtx (UIProvider)      → toast(msg, type) / confirm({title, message, ...})
SheetCloseCtx (Sheet)   → close()  供表单组件关闭当前弹层
```

**Sheet 底部抽屉动画生命周期：**

```
挂载 → entered=false → 播放 sheet-up 动画 (250ms)
     → onAnimationEnd → entered=true
     → 用户触发关闭 → closing=true → 播放 sheet-down 动画
     → setTimeout(320ms) → 调用 onClosed 回调 → 卸载
```

下拉关闭：抓取 grabber 区域触摸事件，下拉超过 90px 触发关闭。

### 6.7 收益图表（IncomeChart.jsx）

纯 CSS 实现柱状图，不依赖图表库：

```
容器：140px 高，flex 布局，3px 间距
柱体：高度 = (当日收益 / 最大日收益) × 100%
  ├── 当天柱：ios-blue 实色
  ├── 历史柱：ios-blue @ 45% 透明度
  └── 零值柱：black @ 8% 透明度（最小 2px）
标签：首日日期 + "今天"
```

### 6.8 PWA 配置

```json
{
  "name": "零花钱管家",
  "short_name": "零花钱",
  "display": "standalone",
  "background_color": "#F2F2F7",
  "theme_color": "#F2F2F7",
  "start_url": "/",
  "icons": [{ "src": "/icon.svg", "type": "image/svg+xml" }]
}
```

HTML meta 标签：`theme-color`、`apple-mobile-web-app-capable`、`apple-mobile-web-app-status-bar-style`、`viewport-fit=cover`、`user-scalable=no`。

---

## 7. 完整数据流

### 7.1 记消费流程（示例）

```
用户点击"记消费"
  │
  ▼
App.openSheet('expense', selectedId)       ← 设置 sheet 状态
  │
  ▼
SheetHost 渲染 <Sheet><ExpenseForm /></Sheet>
  │
  ▼
用户填写分类/项目/金额/日期/备注 → 点击"记下来"
  │
  ▼
parseAmount(yuanStr) → 分（整数）
  │
  ▼
api.addTransaction(childId, { type:'expense', amount:-cents, ... })
  │
  ▼
POST /api/children/:id/transactions
  │
  ▼
Express 校验：孩子存在 / 金额合法 / 日期非未来 / 余额充足
  │
  ▼
db.withTransaction(() => {
  db.insertTransaction(...)    ← 生成 ID "tN"，插入行
})
  │
  ▼
返回 { transaction, balances }
  │
  ▼
前端：close() 关闭弹层 → toast('记好啦 ✅') → refresh()
  │
  ▼
refresh(): api.overview() → 更新 overview + version+1
  │
  ▼
version 变化触发 useEffect → api.child() + api.income() → 更新 detail / income
  │
  ▼
React 重渲染：交易列表和余额自动更新
```

### 7.2 理财买入 → 收益产生流程

```
用户买入理财（如 活期存钱罐 ¥2000，利率 1%）
  │
  ▼
POST /api/children/:id/investments { productId: 'demand', amount: 200000 }
  │
  ▼
db.withTransaction(() => {
  db.insertInvestment(...)           ← 创建持仓记录
  db.insertTransaction(type:'invest') ← 创建交易（-200000 分）
})
  │
  ▼
后续每次查询余额/收益：
  │
  ├── childBalances()
  │     cash     = 所有交易之和（已扣除 200000）
  │     invested = 200000（持仓本金）
  │     accrued  = accruedCents(inv) = Σ round(200000 × 0.01 / 365) × 天数
  │
  └── incomeSeries(db, childId, 7)
        对最近 7 天每天：
          该日收益 = round(200000 × 0.01 / 365) = 55 分 = ¥0.55
```

---

## 8. 冒烟测试架构

**文件：** `scripts/smoke-test.mjs`（Node.js ESM 模块）

**运行方式：** `npm run smoke`（默认测试 `http://localhost:3000`）

**自定义断言框架（无外部依赖）：**

```javascript
let pass = 0, fail = 0;
function assert(cond, msg) { cond ? pass++ : (fail++, console.error('FAIL:', msg)); }
// 结束输出 pass/fail 统计，exit code 0 或 1
```

**30 项断言覆盖 7 个领域：**

| 领域 | 断言数 | 覆盖内容 |
|------|--------|----------|
| 健康检查 | 1 | `/api/health` 返回 ok |
| 概览数据 | 3 | 孩子列表、余额合法性、家庭总计 > 0 |
| 收益系列 | 7 | 长度正确、总额一致、单调递增、收益计算准确 |
| 交易操作 | 5 | 入金/消费余额变动、余额不足拒绝、非整数拒绝、未来日期拒绝 |
| 理财操作 | 5 | 买入扣款、T+1 零收益、余额不足拒绝、赎回本息、重复赎回拒绝 |
| 删除操作 | 3 | 删除交易恢复余额、导致负余额拒绝、资金锁定拒绝 |
| 管理操作 | 3 | 删除孩子、重置数据、数据恢复验证 |

---

## 9. 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务监听端口 |
| `DATA_DIR` | `./data/` | SQLite 数据库存放目录 |
| `TZ` | 系统时区 | 日期计算时区（Docker 中设为 `Asia/Shanghai`） |
| `NODE_ENV` | 未设置 | Docker 中设为 `production` |

---

## 10. 关键架构决策

| 决策 | 理由 |
|------|------|
| 全链路金额用分（整数） | 消除浮点精度问题，`Math.round` 即可 |
| Node 22 内置 `node:sqlite` | 零原生编译依赖，单二进制部署 |
| 前缀自增 ID（c1/t1/i1） | 人类可读，调试友好，通过 counters 表原子生成 |
| WAL 日志模式 | 优化并发读性能，适合家庭共享场景 |
| 外键级联删除 | 删除孩子自动清除全部交易和理财记录 |
| T+1 起息 + 逐日取整 | 贴合真实银行规则，日收益之和 = 累计收益 |
| 视图始终挂载 | CSS 控制显隐，切换 Tab 保留滚动位置 |
| TailwindCSS v4 CSS-first | 无 tailwind.config.js，主题令牌直接在 CSS 中定义 |
| 两阶段 Docker 构建 | 构建工具不进入运行时镜像，最小化攻击面 |
| 保留 store.js | 遗留 JSON → SQLite 迁移路径可用 |
