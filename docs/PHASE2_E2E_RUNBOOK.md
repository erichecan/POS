# Phase 2 E2E 回归脚本（下单 -> KDS -> 支付/现金 -> 对账 -> SLO）

## 脚本位置

- `/Users/eric/Desktop/secondme/projects/POS/pos-backend/scripts/phase2-e2e.js`

## 运行前提

1. MongoDB 可连接
2. 后端服务已启动（默认 `http://localhost:8000`）
3. 已执行种子数据（含管理员账号）

```bash
cd /Users/eric/Desktop/secondme/projects/POS/pos-backend
npm run seed
npm run dev
```

## 执行

```bash
cd /Users/eric/Desktop/secondme/projects/POS/pos-backend
npm run test:e2e:phase2
```

## 可选环境变量

- `PHASE2_E2E_BASE_URL`（默认 `http://localhost:8000`）
- `PHASE2_E2E_LOCATION_ID`（默认 `default`）
- `PHASE2_E2E_ADMIN_EMAIL`（默认 `admin@restro.local`）
- `PHASE2_E2E_ADMIN_PASSWORD`（默认 `Admin@12345`）

## 校验覆盖点

1. 登录与权限 Cookie
2. 现金班次（自动确保有 OPEN shift）
3. 现金订单下单
4. KDS 票据生成与状态推进
5. KDS 事件回放查询
6. MOCK_STRIPE 支付创建 + 验证
7. 在线订单下单（使用已验证支付）
8. 支付对账缺口查询
9. `ops/slo` 运维快照查询
10. `ops/escalations/run` 值班升级执行
11. `ops/incidents` 事件池查询与 ACK/Resolve 流程
