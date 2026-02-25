# POS 全功能体验指导（合作方对接平台版）

日期：2026-02-21  
适用范围：当前仓库代码（M01-M20）  
目标：按“功能模块 + 主流程”一次性体验全部能力

## 1. 体验前基线（已执行）

1. 后端全量单元测试：`npm test` 通过（`87/87`）。
2. 关键主流程自动回归：`npm run test:e2e:phase2` 通过（订单/厨房/支付/SLO/值班升级链路成功）。
3. 已释放并重启端口：后端 `8000`、前端 `5173`。
4. 已重建种子数据：用户/桌台/订单/支付 + 合作方 API Key。

## 2. 体验环境与账号

1. 前端：`http://localhost:5173`
2. 后端：`http://127.0.0.1:8000`
3. 登录账号：
   - Admin：`admin@restro.local / Admin@12345`
   - Cashier：`cashier@restro.local / Cashier@12345`
   - Waiter：`waiter@restro.local / Waiter@12345`
4. 合作方对接（仅保留 `/api/partner/*` 外部入口）：
   - `x-api-key: pos_partner_seed_orders_read_2026`

## 3. 一键准备（明天继续时可复用）

```bash
# 1) 进入项目
cd /Users/eric/Desktop/secondme/projects/POS

# 2) 释放常用端口
lsof -ti :8000 :5173 :5174 :3001 | xargs kill -9 2>/dev/null || true

# 3) 后端测试
cd /Users/eric/Desktop/secondme/projects/POS/pos-backend
npm test

# 4) 重建种子数据
npm run seed

# 5) 启动后端
npm run dev

# 6) 新终端启动前端
cd /Users/eric/Desktop/secondme/projects/POS/pos-frontend
npm run dev
```

## 4. 20 模块体验地图（按模块）

| 模块 | 入口 | 最小体验动作 | 验收点 |
|---|---|---|---|
| M01 身份与权限 | 前端登录 + `/api/access-control/*` | Admin 登录，查询权限/数据范围/字段策略/会话安全事件 | 角色权限与会话事件可读 |
| M02 桌台与堂食 | `/tables` + Dashboard > Ops | 执行转台/并台/拆单/按席位拆单/反并台 | 桌态与订单关系正确变化 |
| M03 订单中心 | `/orders` + `/api/order/*` | 查看订单流转，更新状态，处理冲突事件 | 状态机约束生效，冲突可处理 |
| M04 全渠道聚合 | Dashboard > Channels + `/api/channel-config/*` | 配置 Provider/Profile/Connection/Mapping，模拟渠道入单 | 渠道单可注入，DLQ/回放可用 |
| M05 菜单中心 | `/menu` + `/api/menu/*` | 新增菜单项、发布版本、查看版本与同步状态 | 菜单版本可发布，状态可追踪 |
| M06 库存沽清 | Dashboard > Ops + `/api/inventory/*` | bootstrap 库存、调整库存 | 低库存/86 状态与同步任务变化 |
| M07 厨房 KDS | Dashboard > Kitchen + `/api/kitchen/*` | 看板查看 ticket，改状态/优先级/催单/交接 | 工位与 ticket 状态联动 |
| M08 支付中台 | `/orders` + Dashboard > Payments + `/api/payment/*` | 发起支付、验证支付、退款/审批、对账修复 | 支付/退款/对账链路完整 |
| M09 现金管理 | Dashboard > Ops + `/api/cash/*` | 开班、记流水、交班 | 现金班次与差异可追踪 |
| M10 会员储值 | `/api/member/*` | 创建会员、调账、积分累计/兑换、看台账 | 余额/积分和台账一致 |
| M11 优惠营销 | `/api/promotion/*` | 建规则券、发优惠券、预览优惠应用 | 折扣规则命中且可核算 |
| M12 劳动力 | `/api/workforce/*` | 创建排班，打卡上班/下班 | 班次状态从 SCHEDULED 到 CLOCKED_OUT |
| M13 财务结算 | `/api/finance/*` | 生成结算批次，导出 CSV | 汇总指标与导出可用 |
| M14 组织连锁 | `/api/organization/*` | 创建组织/区域/门店，查看门店继承配置 | 组织树与配置继承正确 |
| M15 经营分析 | Dashboard > Metrics/SLO + `/api/analytics/*` | 查看概览、菜品分析、导出订单 CSV | 报表可读、导出可下载 |
| M16 离线容灾 | `/api/offline/*` | 入队离线操作并回放 | 操作状态从 PENDING 到 REPLAYED |
| M17 设备生态 | `/api/device/*` | 注册设备、心跳上报、查询在线状态 | 设备在线与心跳时间更新 |
| M18 合作方对接平台 | `/api/partner/orders` | 使用 `x-api-key` 拉取订单 | 合作方鉴权 + 分页返回正常 |
| M19 自助点餐/桌码 | `/api/self-order/*` | 生成桌码会话、拉公开菜单、提交自助单 | 桌码下单可入主订单中心 |
| M20 合规与安全 | `/api/compliance/*` | 审计日志、导出请求、高风险审批、策略包执行 | 合规审批链路闭环 |

## 5. 主流程体验（推荐顺序）

## 流程 A：门店堂食闭环（M02/M03/M06/M07/M08/M09/M15）

1. 用 Admin 登录前端，进入 `/dashboard`。
2. 在 `Ops` 页执行 Inventory bootstrap。
3. 在 `Tables` 选择桌台开始点单（或在 `Menu` 加菜）。
4. 到 `Kitchen` 页查看 ticket，推进状态（PREPARING -> READY）。
5. 到 `Orders`/`Payments` 完成支付或退款动作。
6. 回 `Ops` 做现金开班/记流水/交班。
7. 在 `Metrics/SLO` 查看交易、厨房、支付、现金健康。

验收：订单、厨房、支付、现金、指标均可追踪，且数据前后一致。

## 流程 B：全渠道订单聚合与治理（M04）

1. 在 `Channels` 配置：
   - Provider
   - Market Profile
   - Store Connection
   - Mapping Rule（至少 item/status）
2. 调用 `/api/channel-config/ingress/orders` 模拟渠道来单。
3. 验证 `/api/order` 出现 `sourceType=CHANNEL` 订单。
4. 查看 `/api/channel-config/ingress/dlq` 与 `/api/channel-config/ingress/dlq/insights`。
5. 对失败单执行 replay/discard。

验收：注单、限流/签名、DLQ、回放全链路可用。

## 流程 C：会员与营销联动（M10/M11）

1. 创建会员：`POST /api/member/accounts`
2. 创建促销规则：`POST /api/promotion/rules`
3. 创建券：`POST /api/promotion/coupons`
4. 预览优惠：`POST /api/promotion/apply/preview`
5. 做会员积分累计/兑换与台账查询：
   - `POST /api/member/accounts/:id/accrue-order`
   - `POST /api/member/accounts/:id/redeem-points`
   - `GET /api/member/accounts/:id/ledger`

验收：优惠命中、积分/钱包变化、台账一致。

## 流程 D：组织-人员-财务（M12/M13/M14）

1. 创建组织/区域/门店：
   - `POST /api/organization/orgs`
   - `POST /api/organization/regions`
   - `POST /api/organization/stores`
2. 创建排班并打卡：
   - `POST /api/workforce/shifts`
   - `POST /api/workforce/shifts/:id/clock-in`
   - `POST /api/workforce/shifts/:id/clock-out`
3. 生成并导出结算：
   - `POST /api/finance/settlements/generate`
   - `GET /api/finance/settlements/:id/export.csv`

验收：组织继承可解析、排班状态流转正常、结算导出成功。

## 流程 E：离线/设备/自助点餐/合作方对接（M16/M17/M18/M19）

1. 离线队列：
   - `POST /api/offline/operations`
   - `POST /api/offline/operations/:id/replay`
2. 设备注册与心跳：
   - `POST /api/device`
   - `POST /api/device/:id/heartbeat`
3. 桌码自助点餐：
   - `POST /api/self-order/sessions`
   - `GET /api/self-order/public/menu/:token`
   - `POST /api/self-order/public/orders`
4. 合作方拉单（对外唯一入口）：
   - `GET /api/partner/orders`，请求头 `x-api-key: pos_partner_seed_orders_read_2026`

验收：四类能力均可独立闭环，且订单最终进入统一订单中心。

## 流程 F：合规与高风险审批（M20）

1. 查看审计：`GET /api/compliance/audit-logs`
2. 创建导出请求：`POST /api/compliance/export-requests`
3. 配置高风险策略：`POST /api/compliance/high-risk/policies`
4. 发起高风险审批：`POST /api/compliance/high-risk/requests`
5. 审批/驳回：
   - `POST /api/compliance/high-risk/requests/:id/approve`
   - `POST /api/compliance/high-risk/requests/:id/reject`
6. 策略包配置与执行：
   - `POST /api/compliance/policy-packs`
   - `POST /api/compliance/policy-packs/:id/execute`

验收：高风险动作可被策略拦截并经审批后放行，审计留痕完整。

## 6. API 体验通用认证模板

```bash
export BASE=http://127.0.0.1:8000
export COOKIE=/tmp/pos_admin.cookie

# 登录（获取 accessToken Cookie）
curl -s -c $COOKIE -H 'Content-Type: application/json' \
  -d '{"email":"admin@restro.local","password":"Admin@12345"}' \
  $BASE/api/user/login

# 示例：读取订单
curl -s -b $COOKIE "$BASE/api/order"

# 示例：合作方拉单（无需登录 cookie）
curl -s -H 'x-api-key: pos_partner_seed_orders_read_2026' \
  "$BASE/api/partner/orders?limit=20&offset=0"
```

## 7. 体验完成判定（Checklist）

1. 20 个模块都至少完成 1 次成功读写或状态流转。
2. 6 条主流程全部走通，且无阻塞错误。
3. `/api/partner/*` 可独立对接，管理端对外入口未暴露。
4. 审计、报表、导出、审批链路均有可追踪记录。

