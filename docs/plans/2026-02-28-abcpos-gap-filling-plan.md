# ABCPOS 差距补齐实施计划

> **创建时间：** 2026-02-28  
> **依据：** [ABCPOS](https://www.abcpos.com/) 产品对照、`docs/PRD_Global_POS_2026.md`、`docs/MODULE20_PROGRESS_2026-02-21.md`  
> **目标：** 系统性补齐与 ABCPOS 的产品差距，形成可市场化的端到端 POS 平台

---

## 一、现状与差距总览

### 1.1 ABCPOS 产品结构（对标基准）

| 维度 | ABCPOS | 说明 |
|------|--------|------|
| **Business Type** | Enterprise / Fine Dining / Casual Dining / QSR / Cafe / Retail / Bakery | 7 种行业模版 |
| **Products** | Xpress Cloud / Online Order / QR Table / Self-Order / Handheld / Queuing / Loyalty / 3rd Delivery / Growth Marketing / Payment | 10 大产品模块 |

### 1.2 我们当前进度

| 模块 | 状态 | 说明 |
|------|------|------|
| MODULE20 v1 | ✅ 完成 | 20 项模块均 v1 落地 |
| M21 品牌触点 | ✅ 完成 | Logo/小票/广告屏/素材 |
| M22 收银规则 | ✅ 完成 | 小费/服务费/税费 |
| M11 优惠营销 | ✅ 扩展 | 整单/满减/BOGO/券 |
| 行业模版消费端 | 🚧 规划中 | `plans/2026-02-28-vertical-template-consumption.md` |
| 消费者触达 | ❌ 缺口 | Online / QR / Kiosk / Loyalty 前端 |
| 收银员工作台 | ❌ 缺口 | 专用 POS 界面形态 |
| 排队叫号 | ❌ 缺口 | 全新模块 |
| 营销平台 UI | 部分 | 有规则/券，缺活动创建与效果分析 |

### 1.3 综合差距（粗略）

- **整体功能覆盖：** 约 35–40%（ABCPOS 为 100%）
- **后台/规则引擎：** 约 70%
- **消费者触达：** 约 15%
- **门店交互形态：** 约 50%

---

## 二、补齐计划总览

### 2.1 阶段划分

| 阶段 | 周期 | 目标 | 优先级 |
|------|------|------|--------|
| **Phase A** | 约 4 周 | 行业模版消费端 + 收银员工作台 v1 | P0 |
| **Phase B** | 约 4 周 | 自助点餐 Kiosk + 扫码点餐（QR Table） | P0 |
| **Phase C** | 约 4 周 | 在线订餐入口 + 排队叫号基础 | P1 |
| **Phase D** | 约 4 周 | 会员端 H5 / 营销活动平台 | P1 |
| **Phase E** | 约 4 周 | 手持 POS 优化 + 第三方外卖产品化 | P2 |

### 2.2 依赖关系

```
Phase A（行业模版 + 收银工作台）
    │
    ├── Phase B（Kiosk + QR Table）  ← 依赖 A 的模版
    │
    ├── Phase C（Online + Queuing）  ← 可并行于 B
    │
    └── Phase D（Loyalty H5 + 营销平台） ← 依赖 M10/M11 已有能力
            │
            └── Phase E（Handheld + 3rd Delivery） ← 最后
```

---

## 三、Phase A：行业模版消费端 + 收银员工作台（约 4 周）

### 3.1 A1：行业模版消费端（已有规划，执行即可）

**参考：** `docs/plans/2026-02-28-vertical-template-consumption.md`

| Task | 内容 | 产出 |
|------|------|------|
| A1.1 | 后端 getStoreVerticalProfile 404 兜底 | 无 profile 时返回 MILK_TEA 默认 |
| A1.2 | 前端 VerticalProfileContext | POS 主流程加载 profile |
| A1.3 | Phase B：桌台入口条件展示 | tableServiceProfile 控制并台/拆台/席位分单 |
| A1.4 | Phase C：经营模式切换 | operatingModes 切换堂食/外带/外卖 CustomerInfo |
| A1.5 | Phase D：menuOptionProfile 影响菜单 | 修饰项/套餐展示与交互 |

**验收：** 选择不同模版（MILK_TEA / SUSHI / DIM_SUM）时，点餐与桌台流程有可见差异。

### 3.2 A2：行业模版扩展（对标 ABCPOS 7 种 Business Type）

| Task | 内容 | 产出 |
|------|------|------|
| A2.1 | 在 verticalTemplateCatalog 中补齐/映射 | Fine Dining / Casual Dining / QSR / Cafe / Retail / Bakery 与现有模版对应或新增 |
| A2.2 | 新增「业态选择」入口（Settings 或 Stores） | 门店可切换 Business Type，写入 StoreVerticalProfile |

**验收：** 7 种业态均有可选的模版配置。

### 3.3 A3：收银员工作台（POS Station UI）

| Task | 内容 | 产出 |
|------|------|------|
| A3.1 | 新建 CashierStation 路由与布局 | `/cashier` 或 `/pos/station` 全屏收银界面 |
| A3.2 | 订单队列区 | 当前待结账订单列表，支持快速切换 |
| A3.3 | 结账区 | 小计/小费/优惠/支付方式选择，集成 TillRules、Promotion |
| A3.4 | 快捷键区 | 常用操作（现金/刷卡/打印/退款）快捷入口 |
| A3.5 | 打印/现金抽屉联动 | 调用现有打印、交班能力，预留硬件接口 |

**验收：** 收银员可在专用界面完成「选单 → 结账 → 收款 → 打印」全流程。

**文件建议：**
- Create: `pos-frontend/src/pages/CashierStation.jsx`
- Create: `pos-frontend/src/components/cashier/CashierOrderQueue.jsx`
- Create: `pos-frontend/src/components/cashier/CheckoutPanel.jsx`

---

## 四、Phase B：自助点餐 Kiosk + 扫码点餐（约 4 周）

### 4.1 B1：自助点餐 Kiosk UI

| Task | 内容 | 产出 |
|------|------|------|
| B1.1 | Kiosk 专用布局 | 大按钮、触屏优化、全屏无 header |
| B1.2 | 复用 self-order API | 已有 `pos-backend` self-order 能力，新建 Kiosk 前端 |
| B1.3 | 取餐号展示 | 下单成功后显示取餐号 |
| B1.4 | 支付流程 | 集成 Stripe / 现金（如有） |

**验收：** 可在触屏设备上完成「选菜 → 加购 → 结账 → 取餐号」闭环。

**文件建议：**
- Create: `pos-frontend/src/pages/KioskOrder.jsx`
- 路由: `/kiosk` 或 `/order/kiosk`

### 4.2 B2：扫码点餐（QR Table Ordering）

| Task | 内容 | 产出 |
|------|------|------|
| B2.1 | 桌码生成与展示 | 每桌有唯一 QR，扫码进入点餐 |
| B2.2 | 桌号绑定 | 扫码后自动带入桌号，无需手动选择 |
| B2.3 | 点餐流程 | 复用 Menu + Cart，增加「本桌订单」展示 |
| B2.4 | 支付 | 桌边支付（Stripe）或到柜台结账 |

**验收：** 顾客扫码 → 选桌 → 点餐 → 支付/到柜台结账，全流程可跑通。

**依赖：** M19 桌码会话、公开菜单、扫码下单（v1 已有）。

---

## 五、Phase C：在线订餐 + 排队叫号（约 4 周）

### 5.1 C1：在线订餐入口

| Task | 内容 | 产出 |
|------|------|------|
| C1.1 | 消费者订餐页面 | `/order` 或独立子域，无需登录即可浏览菜单、下单 |
| C1.2 | 外带/配送信息 | 取餐时间、配送地址（若支持） |
| C1.3 | 支付 | Stripe 在线支付 |
| C1.4 | 订单状态追踪 | 简单状态页（准备中/可取餐） |

**验收：** 消费者通过链接可完成「选菜 → 填信息 → 支付 → 看状态」闭环。

### 5.2 C2：排队叫号（Queuing）

| Task | 内容 | 产出 |
|------|------|------|
| C2.1 | 排队模型 | QueueTicket（queueId、ticketNo、status、createdAt） |
| C2.2 | 取号入口 | 消费者扫码或点击取号 |
| C2.3 | 叫号屏 | 大屏展示当前叫号、等待人数 |
| C2.4 | 后台管理 | 叫号、过号、重叫 |

**验收：** 顾客可取号，门店可叫号，大屏可展示。

**文件建议：**
- Create: `pos-backend/models/queueTicketModel.js`
- Create: `pos-backend/controllers/queueController.js`
- Create: `pos-frontend/src/pages/QueueDisplay.jsx`
- Create: `pos-frontend/src/pages/QueueTakeNumber.jsx`

---

## 六、Phase D：会员端 H5 + 营销活动平台（约 4 周）

### 6.1 D1：会员端 H5 / Lite 入口

| Task | 内容 | 产出 |
|------|------|------|
| D1.1 | 会员中心页 | 积分、储值、优惠券列表 |
| D1.2 | 核销入口 | 扫码核销券/积分兑换 |
| D1.3 | 订单历史 | 最近订单列表 |
| D1.4 | 登录/绑定 | 手机号验证或会员码绑定 |

**验收：** 会员可查看积分/储值/券，可完成核销。

**依赖：** M10 MemberAccount、MemberLedgerEntry 已有。

### 6.2 D2：营销活动平台 UI

| Task | 内容 | 产出 |
|------|------|------|
| D2.1 | 活动创建向导 | 满减/折扣/BOGO/券包，关联时段、门店、渠道 |
| D2.2 | 活动列表与状态 | 进行中/已结束，简单筛选 |
| D2.3 | 效果概览 | 参与订单数、优惠金额汇总（可复用 M15 数据） |

**验收：** 运营可在后台创建活动、查看基础效果。

---

## 七、Phase E：手持 POS + 第三方外卖产品化（约 4 周）

### 7.1 E1：手持 POS 优化

| Task | 内容 | 产出 |
|------|------|------|
| E1.1 | 手持布局 | 单列大按钮、底部操作栏 |
| E1.2 | 扫码点单 | 扫桌码/商品码快速加单 |
| E1.3 | PWA 支持 | 可安装到手机，离线缓存菜单 |

**验收：** 服务员在手机上可快速完成点单与支付。

### 7.2 E2：第三方外卖产品化

| Task | 内容 | 产出 |
|------|------|------|
| E2.1 | 渠道连接器产品化 | 配置向导：选择 Uber Eats / DoorDash 等，填 API 密钥 |
| E2.2 | 菜单同步状态展示 | 同步成功/失败、最后同步时间 |
| E2.3 | 订单分发与回传 | 渠道来单 → 厨房 → 状态回传，状态可视化 |

**验收：** 通过配置即可接入新外卖渠道，无需改代码。

**依赖：** M04 Channel Ingress、Channel DLQ 已有。

---

## 八、执行顺序与里程碑

### 8.1 推荐执行顺序

```
Week 1-2:  完成 Phase A 中的 A1（行业模版消费端，按 vertical-template-consumption 执行）
Week 2-3:  完成 Phase A 中的 A2（业态扩展）+ A3（收银工作台）
Week 4:    Phase A 联调、验收

Week 5-6:  Phase B1（Kiosk UI）
Week 6-7:  Phase B2（QR Table 扫码点餐）
Week 8:    Phase B 联调、验收

Week 9-10: Phase C1（在线订餐）+ C2（排队叫号）
Week 11:   Phase C 联调、验收

Week 12-13: Phase D1（会员 H5）+ D2（营销平台 UI）
Week 14:   Phase D 联调、验收

Week 15-16: Phase E1（手持优化）+ E2（外卖产品化）
Week 17:   Phase E 联调、验收
```

### 8.2 里程碑

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M1 | 第 4 周 | 行业模版可切换、收银员有专用工作台 |
| M2 | 第 8 周 | Kiosk 自助点餐、扫码点餐可闭环 |
| M3 | 第 11 周 | 在线订餐、排队叫号可用 |
| M4 | 第 14 周 | 会员 H5、营销活动创建可用 |
| M5 | 第 17 周 | 手持优化、外卖产品化配置可用 |

---

## 九、未纳入本计划的能力（后续迭代）

- **支付硬件（EMV/NFC）：** 需硬件厂商 SDK，列为 P3
- **Loyalty 独立 App：** 本计划先做 H5，原生 App 后续
- **高级报表与分析：** 在 M15 基础上深化，单独排期
- **多国家合规深化：** 税务、票据等按市场单独规划

---

## 十、与 PRD Phase 的对应关系

| 本计划 Phase | PRD 阶段 | 模块 |
|--------------|----------|------|
| A | Phase 2/3 | M02 桌台、M22 收银规则、7.22 行业模版 |
| B | Phase 4 | M19 自助点餐/二维码 |
| C | Phase 1/3 | M04 全渠道、M19 |
| D | Phase 3 | M10 会员、M11 优惠 |
| E | Phase 4 | M04、M17 设备 |

---

## 十一、风险与缓解

1. **范围 creep：** 严格按 Phase 验收，不提前做下一阶段  
2. **Kiosk / 手持适配：** 优先保证功能闭环，UI 可迭代  
3. **排队与 KDS 联动：** 首版可人工叫号，后续再与 KDS 打通  

---

**文档版本：** v1.1  
**2026-02-28 实施完成：** Phase A/B/C/D/E 已全部实施，4 个 subagent 并行完成；闭环测试（后端单元、前端构建、Playwright E2E）通过。  
**下次更新：** 各 Phase 启动前可拆分更细的 Task 清单
