# Global POS System

可全球化部署的餐饮 POS 平台，覆盖堂食、外卖、自营线上、第三方配送、连锁总部运营，支持按国家/区域进行能力配置。

**Live Demo**: https://pos-web-380253139402.us-central1.run.app

---

## 核心业务模块（22 个，全部 v1 完成）

| 编号 | 模块 | 功能清单 |
|---|---|---|
| M01 | 身份与权限 | JWT Cookie 认证、登录/注册、角色权限矩阵（Admin/Cashier/Waiter）、数据范围策略、字段级授权与脱敏、会话安全事件记录 |
| M02 | 桌台与堂食流程 | 桌台 CRUD、转台、并台、拆单、按席位分单、反并台；**桌台可视化编辑器**（拖拽布局、区域划分 Main Hall/Terrace/Bar/Corner、桌型选择 Round/Square/Rectangle、添加新桌子、座位数编辑、空区域引导、触摸/桌面双模式） |
| M03 | 订单中心 | 订单创建/编辑/结算、状态机约束（In Progress→Ready→Completed/Cancelled）、版本冲突检测与人工解决、小票模板管理、发票弹窗与浏览器打印 |
| M04 | 全渠道订单聚合 | 可配置渠道接入、签名校验、限流配额、死信队列（回放/丢弃）、Provider / Market / Connection / Mapping Rules 四维管理页面 |
| M05 | 菜单中心 | 菜品 CRUD（名称/分类/基价/状态/有效期/渠道/描述）、**分类管理**（层级树、拖拽排序、颜色标记、emoji 图标、CRUD）、版本发布（草稿→预发布→正式）、时段价（Day Parts：时间段+星期+价格）、同步状态跟踪；**HQ-门店架构**（总部统一母版 default、门店继承+局部覆盖、Inherited from HQ 标记、一键创建门店级 Override、门店分类从 HQ 导入） |
| M06 | 库存与沽清 | 库存扣减（按订单行）、库存调整、自动 86（沽清停售）、渠道可用性同步任务队列（PENDING/SYNCED/FAILED）、从菜单引导创建库存 |
| M07 | 厨房生产/KDS | 工位路由（冷菜/热菜/酒水/甜品）、备餐计时与超时告警、催单、交接确认、事件回放、负载均衡；工作站 / 工单 / 事件回放三个管理子页面 |
| M08 | 支付中台 | Stripe + Mock 多通道路由与失败切换、支付重试、全额/部分退款、双人复核审批、Webhook 验签入库、对账差异追踪；支付账本 / 退款审批 / 对账三个管理子页面 |
| M09 | 现金管理 | 开班/交班、现金抽屉流水（存入/取出）、盘点、差异分析（应收 vs 实收） |
| M10 | 会员与储值 | 会员账户（档案/等级/标签）、积分累计与兑换、钱包余额、会员流水账本 |
| M11 | 优惠营销 | 促销规则 CRUD（折扣/满减/套餐）、优惠券 CRUD、优惠预览、下单自动应用（互斥/叠加/优先级）、核销计数 |
| M12 | 员工与劳动力 | 排班管理、打卡上下班、班次查询、团队成员管理页面 |
| M13 | 财务结算与对账 | 结算批次生成、核心财务指标、CSV 导出 |
| M14 | 组织与连锁 | 总部 / 区域 / 门店三级组织模型、配置继承解析、**垂直行业模板**（7 种预置：奶茶店 / 寿司 / 广式早茶 / 西餐 / 中式快餐 / 美甲店 / 火锅店；每种模板预配硬件需求、运营模式、菜单选项模型、桌台服务策略；门店绑定模板 + JSON Overrides 覆盖；门店自动配置预览） |
| M15 | 经营分析 | 概览指标仪表盘、菜品销售排行分析、订单 CSV 导出 |
| M16 | 离线与容灾 | 离线操作入队、操作列表、重放接口、状态追踪 |
| M17 | 设备生态 | 设备注册、心跳上报、在线状态查询、硬件目录（打印/KDS/扫码/客显/PDA）、门店硬件档案管理 |
| M18 | 合作方对接平台 | 合作方 API Key（Scope / IP 白名单 / 限流配额）、Webhook 签名预览、公共订单 API |
| M19 | 自助点餐/二维码 | 桌码会话生成、公开菜单接口、扫码下单 |
| M20 | 合规与安全 | 审计日志查询与管理页面、PII 脱敏视图、合规导出请求、高风险审批（策略+请求）、合规策略包、关键动作闸门（退款/导出/配置变更） |
| M21 | 国际化（i18n） | 中英文实时切换、浏览器语言自动检测（localStorage + navigator）、Header / AdminLayout 均有切换按钮、登录/注册/导航/桌台/菜单/购物车/订单/支付/厨房/管理后台全页面文案国际化 |
| M22 | 分账与结账增强 | AA 制分账（平均分模式：按人数均分；按菜品分模式：勾选分配到客人组）、Split Bill 独立面板、转桌弹窗（选择目标桌台一键迁移订单） |

---

## 技术架构

| 层级 | 技术 |
|---|---|
| 前端 | React + Vite + Redux + React Query + Tailwind CSS + react-i18next |
| 后端 | Node.js + Express + Mongoose |
| 数据库 | MongoDB Atlas |
| 部署 | GCP Cloud Run（前端 pos-web、后端 pos-api） |
| 认证 | JWT Cookie + bcrypt |
| 支付 | Stripe + Mock Provider |

**规模**：49 个数据模型、23 个 API 路由、8 个 POS 操作页面、26 个 Dashboard 管理页面

---

## 快速开始

### 环境要求

- Node.js >= 18
- MongoDB（本地或 Atlas）
- npm

### 本地运行

```bash
# 后端
cd pos-backend
cp .env.example .env   # 配置 MONGODB_URI, JWT_SECRET 等
npm install
npm start

# 前端（新终端）
cd pos-frontend
cp .env.example .env   # 配置 VITE_BACKEND_URL
npm install
npm run dev
```

### 种子数据

```bash
cd pos-backend
node scripts/seed.js
```

初始化：4 用户 + 1 组织 + 2 区域 + 3 门店 + 12 桌台 + 8 订单 + 8 菜品分类 + 27 菜品 + 5 排班

登录凭据：
- Admin: `testadmin@restro.local` / `12345678`
- Admin: `admin@restro.local` / `Admin@12345`
- Cashier: `cashier@restro.local` / `Cashier@12345`
- Waiter: `waiter@restro.local` / `Waiter@12345`

---

## GCP 部署

### 后端（Cloud Run）

```bash
cd pos-backend
gcloud run deploy pos-api --source . --region us-central1 --allow-unauthenticated
```

环境变量：`NODE_ENV=production`、`PORT=8080`、`MONGODB_URI`、`JWT_SECRET`、`FRONTEND_URL`

### 前端（Cloud Run）

```bash
cd pos-frontend
gcloud run deploy pos-web --source . --region us-central1 --allow-unauthenticated
```

构建时设置 `VITE_BACKEND_URL` 指向后端 URL。

---

## 项目结构

```
POS/
├── pos-backend/          # Express API 服务
│   ├── config/           # 数据库、CORS、硬件目录、行业模板配置
│   ├── controllers/      # 业务控制器（23 个）
│   ├── middlewares/       # 认证、权限、幂等性、错误处理
│   ├── models/           # Mongoose 数据模型（49 个）
│   ├── routes/           # API 路由（23 个）
│   ├── scripts/          # 种子数据、迁移脚本
│   └── utils/            # 工具函数（审计、定价、厨房路由等）
├── pos-frontend/         # React SPA
│   ├── src/components/   # UI 组件（auth/dashboard/home/menu/orders/tables/shared）
│   ├── src/pages/        # 页面（8 POS + 26 Dashboard）
│   ├── src/locales/      # i18n 翻译文件（en.json / zh.json）
│   └── src/config/       # 导航配置
└── docs/                 # 产品文档、部署文档
```

---

## 文档

| 文档 | 说明 |
|---|---|
| [docs/PRD_Global_POS_2026.md](docs/PRD_Global_POS_2026.md) | 产品需求文档 |
| [docs/MODULE20_PROGRESS_2026-02-21.md](docs/MODULE20_PROGRESS_2026-02-21.md) | 模块进度盘点 |
| [docs/POS_Core_Module_Features_2026-02-26.pdf](docs/POS_Core_Module_Features_2026-02-26.pdf) | 核心模块功能清单（PDF） |
| [docs/EXPERIENCE_GUIDE_FULL_2026-02-21.md](docs/EXPERIENCE_GUIDE_FULL_2026-02-21.md) | 体验与主流程指南 |
| [docs/SECURITY.md](docs/SECURITY.md) | 安全与合规说明 |
| [docs/DEPLOY_GCP_2026-02-24.md](docs/DEPLOY_GCP_2026-02-24.md) | GCP 部署指南 |

---

## License

MIT
