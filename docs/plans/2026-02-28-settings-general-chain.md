# Settings 页面规划：通用配置与连锁组织继承

> **范围：** 通用（时区、货币、语言、门店级默认配置）+ 连锁组织（总部-区域-门店配置继承）  
> **排除：** API 密钥管理（本方案不涉及）

**依据：** `docs/PRD_Global_POS_2026.md`、`pos-backend/utils/configInheritance.js`、现有 Organization/Region/Store 模型。

---

## 一、现状

### 1.1 数据模型（已存在）

| 层级 | 模型 | 字段 | 说明 |
|-----|------|------|------|
| 总部 | Organization | `defaultSettings` (Mixed) | 默认配置，向下继承 |
| 区域 | Region | `countryCode`, `currency`, `timezone`, `defaultSettings` (Mixed) | 覆盖总部 |
| 门店 | Store | `timezone`, `overrideSettings` (Mixed) | 覆盖区域 |

**继承逻辑：** `resolveStoreSettings(org, region, store)` → `deepMerge(org.defaultSettings, region.defaultSettings, store.overrideSettings)`

### 1.2 已有 API

| 接口 | 说明 |
|-----|------|
| `POST /api/organization/orgs` | 创建总部（含 defaultSettings） |
| `GET /api/organization/orgs` | 列表总部 |
| `POST /api/organization/regions` | 创建区域（含 timezone、currency、defaultSettings） |
| `GET /api/organization/regions` | 列表区域 |
| `POST /api/organization/stores` | 创建门店（含 timezone、overrideSettings） |
| `GET /api/organization/stores` | 列表门店 |
| `GET /api/organization/stores/:id/resolved-settings` | 获取门店生效配置 |

**缺口：** 无 Org/Region/Store 的 **更新** 接口，Settings 页面无法编辑已有配置。

### 1.3 Settings 页面

- 当前为占位页，仅展示标题与 placeholder 文案。
- 需实现：通用配置编辑 + 连锁层级展示与继承关系可视化。

---

## 二、通用配置字段定义

### 2.1 标准字段（与 PRD / 多国家落地对齐）

| 字段 | 类型 | 总部 | 区域 | 门店 | 说明 |
|-----|------|------|------|------|------|
| `timezone` | string | 可放 defaultSettings | Region 顶层 | Store 顶层 | 如 Asia/Shanghai, America/New_York |
| `currency` | string | defaultSettings | Region 顶层 | overrideSettings | 如 USD, EUR, CNY |
| `countryCode` | string | defaultSettings | Region 顶层 | overrideSettings | 如 US, CN, IE |
| `locale` | string | defaultSettings | defaultSettings | overrideSettings | 如 en, zh, ja，供 POS 界面语言默认值 |

### 2.2 存储约定

- **Organization.defaultSettings：** `{ timezone?, currency?, countryCode?, locale?, ... }`
- **Region：** 顶层 `timezone`、`currency`、`countryCode`；`defaultSettings` 存扩展项（含 `locale` 等）
- **Store：** 顶层 `timezone`；`overrideSettings` 存 `currency`、`countryCode`、`locale` 等覆盖项

---

## 三、连锁组织配置继承

### 3.1 继承规则

```
门店生效配置 = deepMerge(
  总部 defaultSettings,
  区域 defaultSettings（含顶层 timezone/currency/countryCode 归一进 defaultSettings 参与 merge）,
  门店 overrideSettings（含顶层 timezone 归一进 overrideSettings）
)
```

说明：后端 `resolveStoreSettings` 已实现三层 merge，只需保证前端传入/展示的字段与后端约定一致。

### 3.2 展示要求

- 支持按「总部 → 区域 → 门店」层级浏览。
- 展示每层配置及继承来源（继承 / 本层覆盖）。
- 展示门店的 **resolved** 配置（仅读），便于核对最终生效值。

---

## 四、实施任务

### Phase 1：后端 - 更新接口

| 任务 | 说明 |
|-----|------|
| **T1.1** | 新增 `PATCH /api/organization/orgs/:id`，支持更新 `defaultSettings` |
| **T1.2** | 新增 `PATCH /api/organization/regions/:id`，支持更新 `timezone`、`currency`、`countryCode`、`defaultSettings` |
| **T1.3** | 新增 `PATCH /api/organization/stores/:id`，支持更新 `timezone`、`overrideSettings` |

字段校验与约束：

- `timezone`：IANA 格式白名单或通用校验
- `currency`：ISO 4217 三位字母
- `countryCode`：ISO 3166-1 两位字母
- `locale`：如 en, zh, zh-CN 等

### Phase 2：前端 - Settings 页面

| 任务 | 说明 |
|-----|------|
| **T2.1** | 新建 `SettingsCenter` 组件，替代当前占位内容 |
| **T2.2** | **通用配置 Tab**：选择层级（总部/区域/门店）→ 展示对应表单 → 编辑 timezone、currency、countryCode、locale |
| **T2.3** | **连锁组织 Tab**：树形/列表展示 Org → Region → Store，每层展示 defaultSettings/overrideSettings 及继承关系 |
| **T2.4** | 门店详情：支持查看 `resolved-settings`，高亮「继承自上层」与「本层覆盖」 |
| **T2.5** | 调用新增 PATCH 接口保存，成功后刷新列表与 resolved 结果 |

### Phase 3：联动与校验（可选增强）

| 任务 | 说明 |
|-----|------|
| **T3.1** | POS 前端读取当前门店 `resolvedSettings.locale`，作为 i18n 默认语言（未登录或未选门店时） |
| **T3.2** | 小票、报表等按 `resolvedSettings.currency` 格式化金额 |
| **T3.3** | 日期时间按 `resolvedSettings.timezone` 展示 |

---

## 五、UI 结构建议

```
Settings
├── 通用配置 (General)
│   ├── 层级选择：总部 | 区域 | 门店
│   ├── 总部：选择 Org → 编辑 defaultSettings
│   ├── 区域：选择 Org + Region → 编辑 timezone/currency/countryCode/defaultSettings
│   └── 门店：选择 Org + Region + Store → 编辑 timezone/overrideSettings
│
└── 连锁组织 (Organization)
    ├── 总部列表（可展开区域）
    ├── 区域列表（可展开门店）
    └── 门店详情 → 展示 resolved settings + 继承链
```

---

## 六、验收标准

1. Admin 可在 Settings 中编辑总部/区域/门店的 timezone、currency、countryCode、locale。
2. 修改后，`GET /stores/:id/resolved-settings` 返回的 merged 结果正确体现继承与覆盖。
3. 连锁组织视图能清晰展示 Org → Region → Store 及每层配置来源。
4. 无 API 密钥相关功能（不纳入本方案）。

---

## 七、依赖与风险

- **依赖：** 现有 Organization/Region/Store 数据与权限体系。
- **风险：** 单店场景（无 Region）时，需约定 Store 的 regionId 或提供「无区域」fallback，当前 seed 中是否有单店数据需确认。
