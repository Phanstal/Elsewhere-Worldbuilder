# Elsewhere 架构说明

## 1. 目标与约束

Elsewhere 是一个单窗口、本地优先的 macOS 世界观构建工具：

- 在一张可平移、可缩放的空间画布上摆放角色、地点、阵营、事件等设定；
- 用别名表达同一事物的不同侧面，用关系线表达它们之间的联系；
- 所有数据只保存在本机，无账号、无云同步、无遥测；
- 以 `.elsew` JSON 文件导入 / 导出，可导出整张世界为 PNG；
- 首版以**未签名、未公证**的 `.app` / `.dmg` 形式个人分发；
- 当前在 Windows 上开发，通过 GitHub Actions 的 macOS runner 产出 macOS 构建，最终由用户在真机验收；
- 为未来的 iOS / Android 版本保留同一套领域模型和存储端口，不把业务逻辑绑死在桌面壳上。

原型来自 [Figma Make](https://www.figma.com/make/aeRRMdDfVsyuJvz2Dy1DV3/Build-Elsewhere-Worldbuilding-Studio?t=Y0SPn1WcqeAIuBMw-1)。Figma MCP 不支持 Make 文件，因此视觉契约以冻结在 `docs/design/` 的原型 CSS、导出的 `.elsew` 样例和截图为依据，而不是接入 Figma MCP。

## 2. 分层与依赖方向

```text
┌────────────────────────────────────────────────────┐
│ app/App.tsx              首页 / 工作室切换、命令接线 │
│ features/home            世界档案                   │
│ features/studio          工具栏、侧栏、画布、检查器  │
└──────────────────┬─────────────────────────────────┘
                   │ 只依赖 domain 类型与端口
┌──────────────────▼─────────────────────────────────┐
│ domain/types.ts          节点类型、分组、尺寸、图形  │
│ domain/world.ts          纯函数：增删改、别名、关系  │
│ domain/elsew.ts          .elsew 序列化、校验、导入   │
│ domain/repository.ts     WorldRepository 端口        │
└──────────────────┬─────────────────────────────────┘
                   │
┌──────────────────▼─────────────────────────────────┐
│ infra/storage            SQLite / localStorage       │
│ infra/export             .elsew 保存、PNG 渲染       │
│ platform/tauri           环境判断、IPC、菜单命令总线  │
└──────────────────┬─────────────────────────────────┘
                   │ Tauri IPC / 浏览器 API
┌──────────────────▼─────────────────────────────────┐
│ src-tauri                原生菜单、SQL 插件、对话框  │
│                          save_export 命令、窗口配置   │
└────────────────────────────────────────────────────┘
```

`domain/` 不 import React、Tauri 或浏览器 API；`infra/` 实现端口；`features/` 只消费领域函数和端口。这样未来做移动端时，领域模型、`.elsew` 解析和 PNG 生成策略可以原样复用。

## 3. 领域模型

### 3.1 节点

`WorldNode` 是一条设定：

```ts
interface WorldNode {
  id: number;
  title: string;
  type: NodeType;
  x: number;
  y: number;
  description: string;
  width?: number;
  height?: number;
  sourceId?: number;
}
```

- `NODE_TYPES` 固定 14 种，分为 Space / Entities / Lore / Media 四组：
  - Space：Place、Building、Map
  - Entities：Character、Faction、Species、Object
  - Lore：Event、Timeline、Concept、System、Culture、Category
  - Media：Image
- 每种类型在 `NODE_TYPE_META` 中有默认尺寸、图标路径和是否可缩放的标记。Place 与 Category 是容器型节点，右下角有缩放把手；其余节点尺寸固定，保证画布语言统一。
- `title` / `description` / `type` 可以在检查器中修改；标题也可在画布上双击就地改名。
- 坐标是“世界坐标”，与缩放和平移无关；世界固定为 `1100 × 680`，视口初始以 90% 居中显示。

### 3.2 别名

别名不是独立概念，而是一条带 `sourceId` 的节点：

- 复制源节点的标题、类型、描述和尺寸；
- 位置偏移 `+130, +80`，方便拖开；
- 在侧栏、检查器和探索面板显示 `TYPE · Alias`；
- 侧栏 `All Nodes` 与世界摘要中的节点计数只统计“基础节点”（`sourceId === undefined`），但画布上会绘制全部节点；
- 删除基础节点时，其别名一并删除；删除别名不影响基础节点。

`world.ts` 中的 `baseNodeCount` 和 `isAlias` 集中处理这些规则。

### 3.3 关系

```ts
interface Relation {
  id: number;
  from: number;
  to: number;
  name: string;
}
```

- 从节点左右两侧的端口拖出，落在另一个节点上即建立关系；
- 关系使用虚线贝塞尔曲线绘制，标签位于曲线中点；
- 标签可双击编辑；关系可选中并在检查器中改名或删除；
- 删除节点时，与其相连的关系一并删除。

### 3.4 世界

```ts
interface World {
  format: 'elsew';
  version: 1;
  id: string;
  name: string;
  updatedAt: string;
  nodes: WorldNode[];
  relations: Relation[];
}
```

`World` 同时是持久化单元和 `.elsew` 文件结构。`updatedAt` 在每次变更时刷新，用于首页“最近编辑”排序。

## 4. 持久化与保存管线

### 4.1 端口

```ts
interface WorldRepository {
  list(): Promise<WorldSummary[]>;
  get(id: string): Promise<World | null>;
  save(world: World): Promise<void>;
  remove(id: string): Promise<void>;
}
```

两个实现：

- `SqliteWorldRepository`：Tauri 桌面端，数据库 `elsewhere.db`；
- `LocalWorldRepository`：浏览器与 Playwright E2E，键 `elsewhere.worlds.v1`。

`infra/storage/index.ts` 检测 `window.__TAURI_INTERNALS__`，决定使用哪一个。浏览器模式不是“演示模式”，而是完整的本地持久化适配器，方便开发、测试和未来 Web 版。

### 4.2 SQLite 表

```sql
CREATE TABLE IF NOT EXISTS worlds (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  node_count INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL
);
```

列表只查询 `id / name / updated_at / node_count`，打开世界时才读取 `data` 整段 JSON。`node_count` 使用基础节点数，与侧栏“All Nodes”一致。

macOS 数据位置：

```text
~/Library/Application Support/com.phanstal.elsewhere/elsewhere.db
```

删除应用不会删除数据库；需要彻底清理时手动删除该目录。

### 4.3 自动保存

`useWorldEditor` 是编辑状态的唯一入口：

- `state = { past, present, future }` 实现撤销 / 重做；
- 每次离散操作（移动结束、改名、改类型、改描述、连线、删除等）提交一次历史；
- 连续拖动通过 `beginTransaction` / `endTransaction` 合并为一步，撤销不会逐帧回退；
- 提交后 420 ms 防抖写入仓库；写入中显示 `Saving…`，成功后 `Saved`，失败保留错误并允许重试；
- 返回首页、切换世界、主动 `⌘S`、窗口关闭前都会 `flush()`，避免防抖窗口内丢数据；
- 保存失败时状态栏变为 `Save failed`，不会静默丢弃。

### 4.4 启动流程

`App.tsx` 启动时先创建仓库并 `list()`，再渲染首页。首次启动是空档案，不自动创建示例世界；示例文件放在 `samples/the-hollow-reach.elsew`，用户可通过“Import .elsew”导入。

## 5. 交互模型

### 5.1 布局

- 顶部工具栏 58px：品牌、世界名下拉、撤销 / 重做、缩放、Fit、保存状态、Create/Explore 切换、`.elsew` 保存、PNG 导出；
- 左侧栏 190px：World / All Nodes、按四组排列的 14 个创建项、底部 Quick add；
- 中间画布：点阵背景、世界边界、关系线、节点；
- 右侧检查器 250px：选中节点或关系时显示；未选中时显示空状态；
- Explore 模式隐藏侧栏和检查器，点击节点弹出只读浮层。

窄屏（≤980px）隐藏侧栏，检查器变为底部抽屉，工具栏保留核心动作；≤640px 进一步压缩首页与工具栏。

### 5.2 画布

- 拖拽空白区域平移；滚轮 / 触控板缩放，缩放范围 0.3–2；
- 拖动节点移动，拖动 Place / Category 右下角缩放；
- 从节点左右端口拖出关系线，落在目标节点上建立关系；
- 双击节点标题就地改名；双击关系标签改名；
- 空白点击取消选择；Esc 取消选择 / 关闭浮层。

实现上，画布用一个 `transform: translate(...) scale(...)` 的世界层承载 SVG 关系线和绝对定位节点；指针事件统一在画布容器捕获，按 `dragRef` 状态分派 pan / node / resize，避免每个节点各写一套全局监听。

### 5.3 撤销与事务

- 所有修改都走 `commit(world => ...)`，产生新的不可变 `World`；
- 拖动开始时记录 baseline，移动过程中只更新 `present`，结束时把 baseline 到最终状态压入 `past`；
- 取消拖动（Esc / pointercancel）恢复 baseline；
- 撤销 / 重做通过 `past` / `future` 栈切换，保存仍然由同一个防抖管线负责。

## 6. `.elsew` 文件格式

```json
{
  "format": "elsew",
  "version": 1,
  "id": "uuid",
  "name": "The Hollow Reach",
  "updatedAt": "2026-10-27T07:09:42.878Z",
  "nodes": [
    {
      "id": 104,
      "title": "Mira Vale",
      "type": "Character",
      "x": 320,
      "y": 470,
      "description": "A cartographer who charts the roads nobody else will walk."
    },
    {
      "id": 105,
      "title": "The Ashen Court",
      "type": "Faction",
      "x": 780,
      "y": 470,
      "description": "Keepers of the old crossings."
    }
  ],
  "relations": [{ "id": 201, "from": 104, "to": 105, "name": "Sworn to" }]
}
```

导入规则（`domain/elsew.ts`）：

- 必须是对象，`format === 'elsew'`，`version === 1`；
- `name` 非空字符串，`nodes` / `relations` 为数组；
- 每个节点必须有有限数值的 `id / x / y`，合法 `type`，字符串 `title`；`sourceId` 若指向不存在的节点会被丢弃；
- 关系两端必须存在，`name` 缺省为 `Relation`；
- 原型导出的旧文件兼容：缺少 `width / height` 时按类型补默认尺寸；`id` 可以是原型的时间戳数字；
- 导入总是创建**新世界**（新 UUID、新 `updatedAt`），不会覆盖已有世界；标题冲突时保持文件内名称，用户可再改。

导出文件使用 2 空格缩进、UTF-8 无 BOM，文件名由世界名清洗为安全字符后加 `.elsew`。

## 7. PNG 导出

`infra/export/png.ts` 的做法：

1. 克隆 `.world` 元素到屏幕内一个临时舞台；
2. 临时舞台固定在 `left: 0; top: 0; z-index: -1`，让 `html-to-image` 在同一坐标系克隆，避免负偏移导致空白图；
3. 以 2 倍像素比渲染，输出包含点阵背景、节点、关系线的整张世界；
4. 通过 `saveFile` 走原生保存对话框（浏览器模式退化为下载）；
5. 完成后移除临时舞台。

不要把舞台移回屏幕外：`html-to-image` 的克隆会保留原位置，负坐标会得到空白 PNG；这是开发中实际踩过的坑。

## 8. 原生外壳

`src-tauri/` 只做桌面能力，不承载业务规则：

- `menu.rs`：macOS 菜单 `Elsewhere / File / Edit / View / Window`，菜单项通过 `elsewhere://command` 事件把命令发给前端；
- `commands.rs`：`save_export(path, bytesBase64)` 写入用户选择的路径，并返回结果；
- 插件：`dialog`、`sql`、`window-state`；
- `tauri.conf.json`：1440×900，最小 1040×680，macOS overlay titlebar + hidden title，红绿灯位置 `18, 21`；
- `capabilities/default.json` 只开放实际使用的 core / dialog / sql 权限；
- 前端 `platform/tauri.ts` 封装 `isTauri`、`invokeCommand`、`listenForMenuCommands`，浏览器模式返回空实现。

菜单命令：

| 菜单                      | 命令                                        | 前端动作                          |
| ------------------------- | ------------------------------------------- | --------------------------------- |
| File → New World          | `new-world`                                 | 首页新建；工作室中先 flush 再新建 |
| File → Save               | `save`                                      | 立即 flush 当前世界               |
| File → Export .elsew      | `export-elsew`                              | 原生保存对话框                    |
| File → Export PNG         | `export-png`                                | 渲染并保存                        |
| Edit                      | 原生撤销 / 重做 / 剪切 / 复制 / 粘贴 / 全选 | 系统行为；工具栏撤销走编辑器历史  |
| View → Zoom In / Out      | `zoom-in` / `zoom-out`                      | 画布缩放                          |
| View → Fit World          | `fit`                                       | 适配视口                          |
| View → Explore / Create   | `toggle-mode`                               | 切换模式                          |
| View → Toggle Full Screen | 原生                                        | 系统行为                          |

## 9. 移动端可移植性

首版只发布 macOS，但结构已为 iOS / Android 预留：

- 领域层纯 TypeScript，不依赖 DOM；节点、别名、关系、`.elsew` 校验可直接复用；
- `WorldRepository` 是端口；移动端可以换 SQLite（Tauri 2 mobile）或平台数据库，不改 UI 业务；
- 画布手势层封装在 `Canvas.tsx`，后续可补双指缩放 / 长按菜单；
- 布局已有窄屏断点，侧栏、检查器可转为抽屉；
- 导出层分成“生成数据”和“保存到平台”两步，移动端可接分享面板。

尚未为移动端做真机适配、触控手势细化和 App Store 签名；这些不在 v0.1.0 范围内。

## 10. 测试策略

- **单元测试**：`tests/unit/world.test.ts`（创建、别名、关系、计数、边界、文件名、fitView）、`tests/unit/elsew.test.ts`（序列化、合法 / 非法导入、原型 schema）、`tests/unit/localRepository.test.ts`；
- **E2E**：`tests/e2e/studio.spec.ts` 覆盖创建世界、编辑并刷新回读、改名、别名、连线与关系改名、`.elsew` / PNG 下载、导入、Explore、缩放把手、删除世界、窄屏 Quick add；
- **原生验证**：在 Windows 上用 WebView2 CDP 连接真实 Tauri 窗口，新建 / 改名 / 自动保存，再直接查询 `elsewhere.db` 验证 SQLite 数据；macOS 的菜单、overlay titlebar、保存对话框由真机验收覆盖；
- **CI**：Ubuntu 跑前端与 Playwright（Chromium），macOS 跑 rustfmt / clippy / cargo test，并打 universal `.app`。

## 11. 已知限制与取舍

- 无 Apple 签名 / 公证，首次启动需要手动放行；无自动更新。
- 无云同步、账号、协作、版本历史（仅当前会话的撤销 / 重做）。
- 世界尺寸固定 `1100 × 680`，节点不能旋转；容器缩放只允许 Place / Category。
- 关系是两节点间的有向命名连线，不支持多重边分组、路径点或跨世界引用。
- PNG 为整张世界的 2 倍渲染，超大世界会按浏览器画布上限降级；不导出为矢量。
- 别名与基础节点共享标题和类型，但描述、位置独立；不支持“同步编辑”。
- 无数据库加密；数据库随用户账户权限保护。
- 界面为英文，时间格式为 en-US；这与原型一致。
- 自动保存窗口约 420 ms；返回、`⌘S`、关闭前会 flush，强杀进程仍可能丢失最后不到 420 ms 的修改。

## 12. 关键决策

| 决策     | 选择                                   | 理由                                                                              |
| -------- | -------------------------------------- | --------------------------------------------------------------------------------- |
| 桌面壳   | Tauri 2                                | 原生窗口 / 菜单 + React 画布，后续可接 mobile；安装包小                           |
| 画布实现 | DOM + SVG，不用 Canvas/WebGL           | 节点是富文本卡片、需要可访问的输入框和 CSS 视觉；数量级（几十到几百）不需要 WebGL |
| 状态管理 | 单个 `useWorldEditor` + 不可变 World   | 撤销 / 重做、保存、事务集中，避免引入全局状态库                                   |
| 持久化   | SQLite（桌面）+ localStorage（浏览器） | 本地优先、无服务；浏览器模式让 E2E 不依赖原生壳                                   |
| 文件格式 | 显式 `format/version` JSON             | 可读、可手工修复、可跨平台；比二进制或数据库文件更适合分享                        |
| 字体     | Georgia + 系统无衬线 + 等宽小标签      | 原型是温暖的编辑风格，不引入网络字体，离线可用                                    |
| 图片导出 | `html-to-image` 克隆世界层             | 与屏幕呈现一致，开发成本低；无需维护第二套 SVG 渲染器                             |
