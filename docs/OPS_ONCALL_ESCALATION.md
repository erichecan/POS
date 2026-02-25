# On-call 值班升级（内部）

## 已实现能力

1. SLO 快照接口  
   `GET /api/ops/slo`
2. 值班升级执行  
   `POST /api/ops/escalations/run`
3. 事件池查询  
   `GET /api/ops/incidents`
4. 事件确认（ACK）  
   `POST /api/ops/incidents/:id/ack`
5. 事件恢复（Resolve）  
   `POST /api/ops/incidents/:id/resolve`

## 升级规则

- 级别：L1 -> L2 -> L3
- 目标角色（默认）：
  - L1: Cashier
  - L2: Admin
  - L3: Admin
- WARN 与 CRITICAL 的升级门槛可配置，CRITICAL 按更快节奏升级

## 配置项

- `OPS_ESCALATION_LEVEL2_MINUTES`
- `OPS_ESCALATION_LEVEL3_MINUTES`
- `OPS_ESCALATION_LEVEL1_ROLE`
- `OPS_ESCALATION_LEVEL2_ROLE`
- `OPS_ESCALATION_LEVEL3_ROLE`

## 前端入口

- Dashboard -> `SLO` 标签页
- 可执行：
  - `Run On-call Escalation`
  - 事件筛选（OPEN/ACKED/RESOLVED）
  - 事件 ACK / Resolve

## 当前范围

- 仅内部值班升级与事件池管理
- 告警外发（钉钉/Slack/邮件）已按要求暂停
