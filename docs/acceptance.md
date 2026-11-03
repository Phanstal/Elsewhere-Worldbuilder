# Elsewhere 验收清单（v0.1.4）

## 0. 构建信息

| 项目 | 值                                                                   |
| ---- | -------------------------------------------------------------------- |
| 版本 | v0.1.4                                                               |
| 平台 | macOS 12+，universal（arm64 + x86_64）                               |
| 产物 | `Elsewhere_0.1.4_universal.dmg`、`.zip`、`.sha256`、`SHA256SUMS.txt` |
| 签名 | ad-hoc（未使用 Apple Developer ID，未公证）                          |
| 仓库 | https://github.com/Phanstal/Elsewhere-Worldbuilder                   |

自动化状态（本地开发机，2026-11-03；GitHub Actions 结果在发布后补记）：

- `npx eslint src tests`：通过；`npx prettier --check` 对受版本控制的前端文件通过（工作区中未跟踪的 Figma 副本会触发全量扫描报错，CI 在干净检出上运行 `npm run lint` / `npm run format:check`）
- `npm run typecheck`：通过
- `npm test`：23 个单元测试通过
- `npm run build`：通过
- `npm run test:e2e`：11 个 Playwright 用例通过（本地 Edge；1440×900 与 720×820）
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`：通过
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`：通过
- `cargo test --manifest-path src-tauri/Cargo.toml`：通过
- GitHub Actions CI（commit `d600bd0`，run [`41572109768`](https://github.com/Phanstal/Elsewhere-Worldbuilder/actions/runs/41572109768)）：前端 lint / format / typecheck / 23 个单测 / build / 11 个 E2E，Rust fmt / clippy / test 全部通过
- GitHub Actions macOS Release（tag `v0.1.4`，run [`41572366220`](https://github.com/Phanstal/Elsewhere-Worldbuilder/actions/runs/41572366220)）：universal `.app` 构建、ad-hoc 签名、双架构校验、DMG / ZIP / checksum 打包、Release 发布全部通过
- 发布产物：DMG 10,567,928 bytes，SHA-256 `5ec1b6557edd6d04fc816ed6c3ba48e867c77da3080c9070bf60dee7343ae684`；ZIP 9,557,657 bytes，SHA-256 `8da8345281c2045192d27018a37f48a96993cb90038f24a7c407915444e8bdd0`（与 `SHA256SUMS.txt` 及 GitHub asset digest 一致）。已下载 ZIP 并校验：`Info.plist` 版本 `0.1.4`、`LSMinimumSystemVersion 12.0`，`icon.icns` 含 1024px 新图标且圆角透明，Mach-O fat binary 含 x86_64 与 arm64

> Playwright 验证的是浏览器 localStorage 适配器；SQLite、原生菜单、窗口和 DMG 仍需按下面的真机步骤验收。

## 1. 下载与安装

- [ ] 从 Releases 下载 `Elsewhere_0.1.4_universal.dmg`、`.zip` 与 `SHA256SUMS.txt`。
- [ ] 校验：`shasum -a 256 -c Elsewhere_0.1.4_universal.dmg.sha256`，结果为 `OK`。
- [ ] 打开 DMG，把 `Elsewhere.app` 拖入 `/Applications`。
- [ ] 首次启动：右键 → 打开 → 打开；或在“系统设置 → 隐私与安全性”里选择“仍要打开”。
- [ ] 若提示“已损坏”，执行 `xattr -dr com.apple.quarantine /Applications/Elsewhere.app` 后重开。
- [ ] 确认应用图标、应用名均为 Elsewhere；窗口默认 1440×900，最小 1040×680。
- [ ] 确认 Dock / Finder 中显示**新的象牙白圆角图标**：细灰圆环、斜体衬线 `E`，不是旧版小图标；16 / 32 / 128 / 512px 下边缘清晰，无白底方块或黑边；圆角外为透明。
- [ ] 确认使用**原生透明标题栏**：标题栏不显示标题文字，只有左上角红绿灯；网页内容从标题栏下方开始。
- [ ] 确认窗口背景为 `#fcfcfa`，标题栏与纸张表面没有突兀色差。
- [ ] 确认品牌字标和工具栏从左侧正常内边距开始，不再为红绿灯预留约 82px 空白。
- [ ] **窗口已激活时**，按住原生标题栏空白处即可拖动窗口，不会出现“点击但拖不动”。
- [ ] **窗口未激活时**，第一次按住标题栏即可同时激活并拖动窗口，行为与已激活时一致。
- [ ] 按住工具栏、首页头部等网页区域不会触发原生窗口拖动；这是预期行为，拖动统一交给标题栏。

## 2. 世界档案

- [ ] 首次打开显示 “No saved worlds yet.”，左下角显示 “ELSEWHERE LOCAL ARCHIVE · ELSEW FORMAT V1”。
- [ ] 点击 `Create new world` 进入工作室；返回后“Recent worlds”出现一张卡片，显示世界名、`1 LOCAL`、节点数与本地编辑时间。
- [ ] 新建后默认标题为 `Untitled World`；再次新建时自动变为 `Untitled World 2`，不覆盖前一个。
- [ ] 卡片按最近编辑时间排序；超长世界名以省略号截断，不撑破卡片。
- [ ] 点击卡片或右箭头打开世界；悬停卡片显示 `⋯`，菜单中有 `Open world` 与 `Delete world`。
- [ ] 删除时弹出确认；取消保留世界；确认后卡片消失。
- [ ] 删除最后一个世界后回到 “No saved worlds yet.” 空状态。
- [ ] `Import .elsew` 选择 `samples/the-hollow-reach.elsew`，进入导入的世界；返回后卡片出现。
- [ ] 同名文件再次导入，世界名变为 `The Hollow Reach (imported)`，不覆盖原世界。
- [ ] 关闭并重新打开应用，世界列表、顺序、节点内容保持不变。

## 3. Version 33 工作室基础

- [ ] 顶部工具栏从左到右：品牌、世界名下拉、撤销 / 重做、缩放 −/百分比/+、Fit、保存状态、Create / Explore 切换、`Save .elsew`、`Export PNG`。
- [ ] 左侧栏只有三张创建卡：`Space`（Container or region）、`Element`（Person, object, faction…）、`Event`（Moment in time）；点击任一张在视口中心创建并选中。
- [ ] 左侧栏底部有 `Search world…` 与 `All Elements`；打开抽屉后能搜索、跳转，计数只算基础节点。
- [ ] 右侧检查器显示类型眉标、标题、Type、Description；Element 额外显示 Icon、Space、Add image、Tags；Space 额外显示 Background、In this space。
- [ ] 画布为蓝灰点阵；世界边界内更亮；Space 为可缩放区域；节点使用细边框、衬线标题、等宽类型标签。
- [ ] 空白处拖动可平移；滚轮 / 触控板可缩放；`Fit` 将世界重新居中；缩放范围限制在 30%–200%。
- [ ] 拖动节点可移动；拖动 Space 时其内部节点一起移动；松开后位置保存；撤销可回到拖动前。
- [ ] Space 右下角有缩放把手；拖动时左上角保持锚定，尺寸提示实时更新；撤销恢复原尺寸。
- [ ] Element / Event 没有缩放把手，尺寸固定。
- [ ] 双击节点标题可就地改名，`Enter` 提交，`Esc` 取消，空标题不会保存为空。
- [ ] 选中节点按 `Delete` / `Backspace` 可删除；选中关系时同样可删除。
- [ ] 右键画布打开创建菜单（Space / Element / Event / Image），在点击位置创建；`Esc` 关闭菜单。
- [ ] 修改后状态先显示 `Saving…`，约 420 ms 后变为 `Saved`。
- [ ] 返回首页后立即重新打开，最后修改仍在（返回会 flush）。
- [ ] `⌘Z` / `⇧⌘Z` 可撤销 / 重做；工具栏按钮状态同步。
- [ ] `N` 打开 Quick add 浮层；移动端工具栏的 `+` 也能打开。

## 4. 世界时间

- [ ] 新世界底部时间轴显示 `WORLD TIME 1/3`，只有 `Origin`，标签可点击切换。
- [ ] 点击 `+` 新增一个时刻，最多 3 个；达到 3 个后 `+` 禁用并提示 `Maximum 3 time nodes`。
- [ ] 点击时间轴上的圆点 / 标签切换时刻；画布节点与关系整体切换，切换前的修改保留在原来的时刻。
- [ ] 在输入框重命名当前时刻，`Enter` 或失焦提交，`Esc` 取消；切换时刻后输入框显示对应名称。
- [ ] 删除当前时刻需要至少保留一个；删除 `Origin` 后剩余时刻仍可切换；删除后节点图不串档。
- [ ] 在 `Origin` 删除一个节点、切到 `After the Silence`，该节点仍存在；切回 `Origin` 删除仍生效。
- [ ] 关闭并重开应用，时间轴数量、名称、当前激活时刻与各时刻内容全部恢复。
- [ ] 导出 `.elsew` 后重新导入，时间轴与当前时刻保持一致。

## 5. 别名

- [ ] 选中一个基础节点，点击 `Create alias`；画布出现第二个节点，位置相对源节点偏移，并自动选中。
- [ ] 别名与源节点标题、类型、图标、图片一致；检查器眉标显示 `TYPE · Alias`。
- [ ] `All Elements` 计数不增加；画布顶部世界节点数包含别名。
- [ ] 拖动别名到别处，源节点不移动；修改别名的描述不影响源节点。
- [ ] `Delete alias` 只删除别名；源节点保留。
- [ ] 删除源节点时，其别名一并删除。
- [ ] 选中基础节点按 `Enter` 也可创建别名（输入框聚焦时不触发）。

## 6. 关系

- [ ] 节点左右两侧各有一个连接端口，悬停可见；从端口拖出出现跟随指针的虚线。
- [ ] 拖到另一个节点上松开，建立一条虚线关系；拖到空白处取消，不产生关系。
- [ ] 关系线两端跟随节点移动；标签位于曲线中点。
- [ ] 双击关系标签就地改名，`Enter` 提交，检查器同步显示新名称。
- [ ] 点击关系线或标签选中关系；检查器显示 `RELATION`、Connection 两端、Name、Delete relation。
- [ ] 在检查器改名后，画布标签同步；删除关系后线条和标签消失。
- [ ] 删除一端节点时，相关关系自动删除。
- [ ] 关系不能连接节点自身，也不能重复连接到同一对节点。

## 7. Space 容器、图标、标签与图片

- [ ] 在 Space 内创建 Element / Event 时，自动挂到该 Space；检查器 `Space` 下拉显示父级，`In this space` 列出子节点。
- [ ] 把节点拖入 Space，松开后成为子节点；拖出后父级清空。
- [ ] 删除 Space 时，其中的子节点与相关关系一并删除，并有可见的确认 / 结果。
- [ ] Element 图标可在 `character`、`faction`、`concept`、`object` 之间切换，画布与抽屉同步。
- [ ] Tags 以逗号分隔输入，失焦后保存；非法 / 超长标签被裁剪或忽略。
- [ ] 检查器 `Add image` / `Replace image` 选择图片后，Element 或 Space 保留图片；`Remove image` 清除。
- [ ] 从 Finder 拖一张图片到画布，落点创建 Image 节点并显示图片。
- [ ] 图片随 `.elsew` 导出 / 导入保留；PNG 导出包含图片。

## 8. `.elsew` 导出与导入

- [ ] 点击 `Save .elsew` 弹出系统保存对话框，默认文件名为世界名清洗后的 `.elsew`。
- [ ] 取消对话框不报错、不产生文件。
- [ ] 保存后用文本编辑器打开：`format` 为 `elsew`，`version` 为 1，包含 `id`、`name`、`updatedAt`、`nodes`、`relations`、`snapshots`、`activeSnapshotId`。
- [ ] 节点坐标、尺寸、描述、`sourceId`、`icon`、`parentId`、`backgroundColor`、`tags` 与画布一致；关系两端 ID 存在。
- [ ] 把导出的文件通过 `Import .elsew` 导入，得到一个新世界，内容与时间轴一致，ID 与原世界不同。
- [ ] 导入 v0.1.0 / 原型导出的旧文件（含时间戳 ID、缺少 width/height、无 snapshots）：节点按类型补齐尺寸，自动获得 `Origin` 快照，能正常显示。
- [ ] 选择非 JSON、缺 `format`、版本不为 1、节点类型非法的文件：给出可读错误提示，不产生半个世界。
- [ ] 导入 5000 个以上节点的文件被拒绝，应用不卡死。

## 9. PNG 导出

- [ ] 点击 `Export PNG` 弹出系统保存对话框，默认文件名为世界名 `.png`。
- [ ] 取消不报错；保存后图片能正常打开。
- [ ] 图片包含蓝灰点阵背景、Space 区域、所有节点、关系虚线与标签，与屏幕布局一致；关系线不能渲染成黑色实心块。
- [ ] 图片为 2 倍像素密度，文字清晰，没有空白图、偏移、裁切或透明背景。
- [ ] 含有半透明区域、节点图片时，按实际外观合成。
- [ ] 世界为空或只有一个节点时也能导出有效 PNG。

## 10. Explore 模式

- [ ] 点击 `Explore` 后侧栏、检查和底部时间轴按设计隐藏 / 弱化，画布扩展；顶部仍保留品牌、世界名、缩放、Fit、Create/Explore 切换与保存状态。
- [ ] 点击任意节点（含别名）弹出只读浮层，显示图片、类型、标题、描述、父级 Space、标签和坐标，不显示编辑控件。
- [ ] 点击浮层关闭按钮或空白处关闭浮层；`Esc` 也可关闭。
- [ ] Explore 中不能拖动节点、不能连线、不能修改内容。
- [ ] 切回 `Create` 后侧栏、检查器恢复，之前的选择与滚动位置合理。
- [ ] `⇧⌘O` 可在两种模式间切换。

## 11. 原生菜单与窗口

- [ ] macOS 菜单栏包含 `Elsewhere`、`File`、`Edit`、`View`、`Window`。
- [ ] `File → New World`（`⌘N`）在任意页面新建世界。
- [ ] `File → Save`（`⌘S`）立即保存当前世界。
- [ ] `File → Export World (.elsew)…`（`⇧⌘E`）打开保存对话框。
- [ ] `File → Export Image (PNG)…`（`⇧⌘P`）打开保存对话框。
- [ ] `Edit` 菜单的 Undo / Redo / Cut / Copy / Paste / Select All 可用；标题或描述输入框中剪切/粘贴正常。
- [ ] `View → Zoom In / Zoom Out`、`Fit Canvas`（`⌘0`）、`Toggle Explore Mode`（`⇧⌘O`）、`Toggle Full Screen` 均可用。
- [ ] 全屏下内容不压住红绿灯；退出全屏后窗口尺寸与标题栏恢复。
- [ ] 窗口拖动、最小化、缩放、关闭正常；重新打开后窗口尺寸与位置恢复。
- [ ] 关闭窗口前未保存的修改会被 flush；重开后内容一致（强杀进程除外）。

## 12. 窄屏布局（开发 / Web 预览）

macOS 应用最小宽度为 1040，以下用浏览器 `npm run dev` 或 Playwright 720×820 验证：

- [ ] ≤980px 隐藏左侧栏，出现工具栏 Quick add 按钮；检查器变为底部抽屉并带关闭按钮。
- [ ] Quick add 打开 Space / Element / Event 三选一浮层，选择类型后节点创建并选中。
- [ ] 底部检查器可编辑标题、类型、描述、图标、Space、图片与标签，关闭按钮可收起。
- [ ] ≤640px 首页改为单列，标题、按钮、卡片不溢出，仍可创建 / 导入 / 打开世界。
- [ ] 工具栏在窄屏只保留必要动作，导出按钮不换行、不溢出；底部时间轴仍可操作。

## 13. 数据与隐私

- [ ] 断网后新建、编辑、导入、导出全部可用。
- [ ] 用 Little Snitch / Activity Monitor 观察，没有出站连接。
- [ ] 数据库位于 `~/Library/Application Support/com.phanstal.elsewhere/elsewhere.db`。
- [ ] 关闭应用后复制该文件，删除应用数据目录，重开为空库；恢复文件后世界回来。
- [ ] 连续编辑 10 分钟、频繁切换世界与时间快照无崩溃、无明显卡顿。
- [ ] 至少 50 个世界、单个世界 100 个节点时，首页滚动与画布拖动仍可用。
- [ ] 应用退出后不残留后台进程。

## 14. 已知限制（v0.1.4 接受）

- 无 Apple 签名 / 公证，首次启动需要手动放行；每次新版本可能重复。
- 无自动更新、云同步、账号、协作、版本历史（仅会话内撤销 / 重做）。
- 世界时间最多 3 个快照；没有快照合并、差异比较或独立分支。
- 世界固定 1100×680；节点不能旋转；只有 Space（及旧 Place / Category）可缩放。
- 关系是两节点间的命名连线，不支持路径点、多重边分组或跨世界引用。
- 图片以内联 data URL 存在世界文件中；没有裁切、相框、媒体库或压缩。
- 界面为英文；与原型一致。
- 自动保存约 420 ms 防抖；返回、`⌘S`、正常关窗会 flush，强制结束进程可能丢失最后不到 420 ms。
- 数据库未加密，依赖 macOS 账户权限保护。

## 15. 验收结论

- [x] 自动化检查全部通过（GitHub Actions CI 绿色）
- [x] macOS Release 工作流产出了 DMG、ZIP 与 checksum
- [ ] 真机安装、创建、编辑、别名、关系、时间快照、导入导出、PNG、Explore、菜单、窗口恢复全部通过
- [ ] 验收人：__________ 日期：__________
- [ ] 备注：
