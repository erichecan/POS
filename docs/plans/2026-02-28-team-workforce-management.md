# 团队管理与劳动力规划（PRD M12 扩展）

> **目标：** 建立完整的团队管理能力：员工工作范围、排班（拖拽式）、请假批假、工时记录、工资计算。

**依据文档：** `docs/PRD_Global_POS_2026.md` 7.12 节、劳动力差距清单第 10 条。

**参考形态：** 类似项目时间管理（甘特/日历拖拽）、餐饮行业岗位分工（服务员按桌号、Runner 传菜、吧台、帮炒、外卖打包等）。

---

## 一、方案概要

### 1.1 功能范围

| 模块 | 功能点 | 说明 |
|------|--------|------|
| **工作范围** | 岗位定义、职责分配、管理范围 | 服务员 A 管桌 1–4，服务员 B 管吧台，Runner 传菜，帮炒固定后厨等 |
| **排班管理** | 拖拽排班、班次模板、调班 | 经理在日历/时间轴上拖拽分配班次，类似项目排期 |
| **请假批假** | 申请、审批、替换班次 | 员工提交请假，经理审批，可选替换人 |
| **工时记录** | 签到/签出、补录、异常处理 | 对接打卡机或手工补录，作为工资依据 |
| **工资计算** | 按工时、岗位系数、提成 | 基于工时记录 + 岗位薪资规则计算工资 |

### 1.2 核心概念

- **岗位（Position）**：帮炒、服务员、Runner、外卖打包员、吧台、收银、店长等
- **工作范围（WorkScope）**：该岗位/员工负责的物理或逻辑区域
  - 桌台范围：桌 1–4、桌 5–8
  - 固定区域：吧台、厨房帮炒、传菜口、外卖打包区
- **班次（Shift）**：某员工在某时段的工作安排
- **排班（Schedule）**：多日/多人的班次集合，支持拖拽调整

### 1.3 实施阶段

- **Phase 1：** 数据模型（岗位、工作范围、班次、排班、请假、工时）
- **Phase 2：** 工作范围配置与展示
- **Phase 3：** 排班管理（拖拽日历、班次模板）
- **Phase 4：** 请假批假、工时记录（签到/签出）
- **Phase 5：** 工资计算（规则引擎、报表）

---

## 二、数据模型设计

### 2.1 岗位与工作范围

**Position（岗位）**

```
- _id, name, code
- locationId
- scopeType: "TABLES" | "BAR" | "KITCHEN" | "RUNNER" | "TAKEOUT" | "CASHIER" | "MANAGER"
- scopeConfig: {
    tables?: [1,2,3,4]  // 桌号列表，TABLES 时用
    tableRange?: { from: 1, to: 4 }
    stationCode?: "WOK" | "BAR" | "PACK"  // 固定工位
  }
- defaultHourlyRate  // 默认时薪
- isActive
```

**EmployeeWorkScope（员工工作范围）**

员工可绑定多个范围，或继承岗位默认范围；支持按班次/日期覆盖。

```
- _id, userId, positionId
- locationId
- scopeType, scopeConfig  // 可覆盖岗位默认
- validFrom, validTo      // 生效期
- scheduleOverride       // 按排班覆盖（可选）
```

**示例：**

- 服务员 A：scopeType=TABLES, scopeConfig={ tableRange: { from: 1, to: 4 } }
- 服务员 B：scopeType=BAR, scopeConfig={ stationCode: "BAR" }
- Runner：scopeType=RUNNER
- 帮炒：scopeType=KITCHEN, scopeConfig={ stationCode: "WOK" }
- 外卖打包员：scopeType=TAKEOUT, scopeConfig={ stationCode: "PACK" }

### 2.2 排班与班次

**ShiftTemplate（班次模板）**

```
- _id, name, code
- locationId
- startTime, endTime     // 如 09:00-17:00
- breakMinutes
- isActive
```

**ScheduleSlot（排班槽位）**

```
- _id, userId, shiftTemplateId
- locationId
- date (Date)
- plannedStart, plannedEnd  // 可与模板不同（加班、缩短）
- status: "DRAFT" | "CONFIRMED" | "CANCELLED"
- notes
```

**LeaveRequest（请假）**

```
- _id, userId
- type: "SICK" | "PERSONAL" | "OTHER"
- startDate, endDate
- status: "PENDING" | "APPROVED" | "REJECTED"
- approvedBy, approvedAt
- replacementUserId      // 顶班人（可选）
```

### 2.3 工时与工资

**WorkHourRecord（工时记录）**

```
- _id, userId, scheduleSlotId (可选)
- locationId
- date
- clockInAt, clockOutAt
- source: "MANUAL" | "PUNCH_CLOCK" | "APP"
- status: "OPEN" | "CLOSED"
- approvedBy
```

**WageRule（工资规则）**

```
- _id, positionId / userId
- effectiveFrom, effectiveTo
- baseHourlyRate
- overtimeMultiplier     // 加班倍率
- tipShareRule           // 小费分成规则（可选）
```

---

## 三、工作范围管理

### 3.1 岗位库维护

- 后台：岗位 CRUD，设置 scopeType、scopeConfig、默认时薪
- 预设岗位：服务员、Runner、帮炒、外卖打包员、吧台、收银、店长

### 3.2 员工-岗位-范围绑定

- 员工列表：展示岗位、工作范围摘要（如「桌 1–4」「吧台」）
- 编辑：选择岗位、可覆盖 scopeConfig（桌号范围、工位）
- 支持同一员工多范围（如兼服务员+吧台，按班次切换）

### 3.3 消费端展示

- Tables 页：按当前登录员工的工作范围过滤可见桌台
- 厨房/KDS：按工位显示任务
- 外卖打包：仅外卖打包员可见打包队列（预留）

---

## 四、排班管理（拖拽式）

### 4.1 排班视图

- **周视图 / 日视图**：横向日期，纵向员工或岗位
- **甘特式**：每个员工一行，班次为可拖拽条块
- 交互：拖拽条块调整日期/时间、拖拽空白创建新班次

### 4.2 班次模板

- 预设：早班、午班、晚班、全天
- 创建班次：选择模板 + 日期 + 员工，可微调开始/结束时间
- 批量排班：按模板 + 日期范围 + 员工列表一键生成

### 4.3 调班与替换

- 拖拽交换：A 的班次拖给 B
- 删除班次、复制班次到其他日期
- 请假通过后，可指定顶班人，自动插入排班

---

## 五、请假与审批

### 5.1 申请流程

- 员工：选择请假类型、起止日期、备注
- 提交后状态 PENDING

### 5.2 审批流程

- 经理：审批/拒绝，可选填「顶班人」
- 若选顶班人：自动为顶班人生成对应班次
- 原员工班次标记为 CANCELLED 或替换

### 5.3 日历联动

- 请假在排班视图上以不同颜色显示（如灰色、虚线）
- 审批通过后，原班次自动移除或标记

---

## 六、工时记录与工资计算

### 6.1 签到/签出

- **对接打卡机（未来）**：通过 API 接收打卡事件，匹配员工与班次
- **手工补录**：经理可为员工补录 clockIn/clockOut
- **移动端 App**：员工自签到/签出（可选）

### 6.2 工时核算

- 按 date 汇总每位员工 clockIn → clockOut 时长
- 支持跨日班次（如 22:00–06:00）
- 加班：超出约定时长部分按 overtimeMultiplier 计
- 异常：缺卡、重复打卡、时长异常等，需人工审核

### 6.3 工资计算

- 输入：WageRule + WorkHourRecord
- 输出：每位员工某周期应发工资
- 公式示意：`基本工时 × baseHourlyRate + 加班工时 × baseHourlyRate × overtimeMultiplier (+ 提成)`
- 导出：Excel/CSV，供财务核对

---

## 七、API 规划（预留）

| 模块 | 端点 | 方法 | 说明 |
|------|------|------|------|
| 岗位 | `/api/positions` | CRUD | 岗位定义 |
| 工作范围 | `/api/employees/:id/work-scope` | GET/PUT | 员工工作范围 |
| 班次模板 | `/api/shift-templates` | CRUD | 班次模板 |
| 排班 | `/api/schedule` | GET/POST/PUT | 排班查询与维护 |
| 请假 | `/api/leave-requests` | CRUD | 请假申请与审批 |
| 工时 | `/api/work-hours` | GET/POST | 工时记录、补录 |
| 工资 | `/api/wage-calculation` | POST/GET | 工资计算、导出 |

---

## 八、前端页面结构

| 页面 | 路径 | 功能 |
|------|------|------|
| 团队概览 | `/dashboard/team` | 员工列表、岗位、工作范围摘要、快捷入口 |
| 工作范围配置 | `/dashboard/team/scopes` | 岗位库、员工-范围绑定 |
| 排班管理 | `/dashboard/team/schedule` | 拖拽排班、班次模板、调班 |
| 请假审批 | `/dashboard/team/leave` | 请假列表、审批 |
| 工时记录 | `/dashboard/team/work-hours` | 工时列表、补录、异常处理 |
| 工资计算 | `/dashboard/team/wage` | 周期选择、计算、导出 |

---

## 九、技术选型建议

- **排班拖拽**：FullCalendar、react-big-calendar、或自研基于 dnd-kit
- **日期处理**：date-fns / dayjs
- **表格**：现有表格组件或 TanStack Table
- **打卡机对接**：预留 Webhook/轮询接口，协议按硬件厂商文档

---

## 十、依赖与约束

1. **用户模型扩展**：User 需关联 `positionId`、`locationId`，或通过 EmployeeProfile 中间表
2. **权限**：仅 Admin/Manager 可排班、审批、工资；员工仅可见自己的排班与工时
3. **多店**：locationId 贯穿所有表，支持后续多店
4. **打卡机**：本规划预留对接点，具体协议待硬件选定后补充

---

## 十一、任务拆解（执行时可细化）

### Phase 1：数据模型

- [ ] 创建 Position、ShiftTemplate、ScheduleSlot、LeaveRequest、WorkHourRecord、WageRule 模型
- [ ] 扩展 User 或新增 EmployeeProfile 关联 positionId、locationId
- [ ] 编写迁移脚本（如有存量数据）

### Phase 2：工作范围

- [ ] 岗位 CRUD API
- [ ] 员工工作范围 API
- [ ] 工作范围配置页
- [ ] Tables 等消费端按 workScope 过滤（可选）

### Phase 3：排班

- [ ] 班次模板 API
- [ ] 排班 CRUD API
- [ ] 排班页面（拖拽日历）
- [ ] 批量排班、调班

### Phase 4：请假与工时

- [ ] 请假 API、审批流
- [ ] 请假页、审批页
- [ ] 工时记录 API、补录
- [ ] 工时记录页
- [ ] 打卡机对接接口预留

### Phase 5：工资

- [ ] 工资规则 API
- [ ] 工资计算服务
- [ ] 工资计算页、导出

---

*文档版本：2026-02-28*
