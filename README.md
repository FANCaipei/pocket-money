# 🐷 零花钱管家

儿童零花钱管理应用（手机端 Web · Apple 风格）。家庭共用一个账本，无需登录。

**技术栈**：React 19 + TailwindCSS 4 + Vite 前端 · Node.js + Express 后端 · SQLite 存储（Node 22 内置 `node:sqlite`，无原生编译依赖）

## 功能

- **孩子账户**：创建 / 添加 / 删除孩子，每个孩子独立的余额、账本与理财
- **入金**：零花钱、红包、奖励，支持日期与备注
- **消费记账**：分类（零食/玩具/文具/图书/娱乐/其他）、金额、日期、备注
- **余额查看**：可用零花钱 / 理财中 / 总资产，首页家庭总资产一目了然
- **闲钱理财**：活期存钱罐、定期（3个月/6个月/1年）、稳健理财（90天/180天），利率为演示数据写死；支持买入与赎回（本息自动结算）
- **收益统计**：近 1 周 / 1 月 / 3 月每日收益柱状图与累计收益，收益按天结算（本金 × 年化 ÷ 365）

## 快速开始

### Docker 一键部署（推荐）

```bash
cd pocket-money
docker compose up -d --build
```

或使用 `docker run`（镜像为两阶段构建：先构建前端，再打运行时镜像）：

```bash
docker build -t pocket-money .
docker run -d --name pocket-money -p 3000:3000 -v "$(pwd)/data:/data" -e TZ=Asia/Shanghai pocket-money
```

打开 http://localhost:3000 （手机与电脑同一局域网时，用 `http://<电脑IP>:3000` 访问）。

### 本地运行

要求 Node.js ≥ 22.12（使用内置 `node:sqlite`）。

```bash
npm install              # 安装后端依赖（express）
npm --prefix client install   # 安装前端依赖

# 方式一：生产模式（服务端直接托管前端构建产物）
npm run build            # 构建 client/dist
npm start                # 默认 http://localhost:3000（PORT=8080 npm start 可改端口）

# 方式二：前端开发模式（热更新，API 代理到 3000）
npm start &              # 后端 :3000
npm run dev:client       # 前端 :5173，打开 http://localhost:5173
```

首次启动自动生成演示数据（3 个孩子、数月记账与理财记录），打开即可体验；
在应用「管理」页可随时一键**重置演示数据**。

## 数据与持久化

- 数据保存在 SQLite 数据库 `data/pocket-money.db`（Docker 中挂载到容器 `/data`，启用 WAL）
- 首次启动：若库为空且存在旧版 `db.json`（v1 JSON 存储）会自动导入；否则生成演示数据
- 备份 = 备份 `pocket-money.db` 文件；删除整个 `data/` 并重启即可重新生成演示数据

## 目录结构

```
pocket-money/
├── client/             # 前端（React 19 + TailwindCSS 4 + Vite 7）
│   ├── index.html
│   ├── vite.config.js  # dev 端口 5173，/api 代理到 3000
│   └── src/
│       ├── App.jsx         # 全局状态与视图调度
│       ├── api.js          # 后端接口封装
│       ├── fmt.js          # 金额/日期/分类格式化（元 <-> 分）
│       ├── context.jsx     # useApp 全局上下文
│       ├── views/          # 首页 / 记账 / 理财 / 管理
│       └── components/     # UI 基础组件、表单、图标
├── server/
│   ├── index.js    # Express 应用 + API 路由 + 静态托管 client/dist
│   ├── db.js       # SQLite 数据层（node:sqlite，外键级联）
│   ├── finance.js  # 理财产品与按天收益计算
│   └── demo.js     # 初始化演示数据
├── scripts/
│   └── smoke-test.mjs  # API 冒烟测试（30 项）
├── Dockerfile          # 两阶段构建（前端构建 -> 运行时镜像）
└── docker-compose.yml
```

## API 摘要

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /api/overview | 全部孩子与家庭资产汇总 |
| GET | /api/children/:id | 孩子详情（流水 + 持仓 + 余额） |
| POST | /api/children | 添加孩子 `{name, avatar, color, initialBalance?}` |
| DELETE | /api/children/:id | 删除孩子（级联删除其数据） |
| POST | /api/children/:id/transactions | 入金 / 消费 `{type, amount, item, note, date, category}` |
| DELETE | /api/transactions/:id | 删除一条流水（余额不可为负） |
| GET | /api/children/:id/income?days=7\|30\|90 | 收益日序列与区间总额 |
| GET | /api/products | 理财产品列表（演示利率） |
| POST | /api/children/:id/investments | 买入理财 `{productId, amount}` |
| POST | /api/investments/:id/redeem | 赎回（本息到账） |
| POST | /api/demo/reset | 重置演示数据 |
| GET | /api/health | 健康检查 |

金额单位：接口的请求与响应均使用**分**（整数，¥12.50 = `1250`），全程避免浮点误差。

## 冒烟测试

```bash
npm start &          # 或已用 Docker 运行
npm run smoke        # BASE=http://localhost:3000 可指定地址
```

## 自定义理财利率

编辑 `server/finance.js` 中的 `PRODUCTS`（年化利率、期限、名称），重启生效；
已持有的理财按买入时的利率继续计息。

> 说明：应用按需求不包含登录鉴权，适合家庭局域网使用；如需公网部署请自行增加访问控制。
