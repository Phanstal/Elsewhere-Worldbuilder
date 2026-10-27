# Elsewhere 验收清单（v0.1.0）

## 0. 构建信息

| 项目 | 值                                                                   |
| ---- | -------------------------------------------------------------------- |
| 版本 | v0.1.0                                                               |
| 平台 | macOS 12+，universal（arm64 + x86_64）                               |
| 产物 | `Elsewhere_0.1.0_universal.dmg`、`.zip`、`.sha256`、`SHA256SUMS.txt` |
| 签名 | ad-hoc（未使用 Apple Developer ID，未公证）                          |
| 仓库 | https://github.com/Phanstal/Elsewhere-Worldbuilder                   |

自动化状态（本地开发机，2026-10-27）：

- `npm run lint`：通过
- `npm run format:check`：通过
- `npm run typecheck`：通过
- `npm test`：16 个单元测试通过
- `npm run build`：通过
- `npm run test:e2e`：10 个 Playwright 用例通过（本地 Edge；1440×900 与 720×820）
- `cargo test --manifest-path src-tauri/Cargo.toml`：1 个测试通过
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`：通过
- Windows release 构建通过；通过 WebView2 CDP 驱动真实 Tauri 窗口完成新建世界、创建节点、改名、自动保存，并直接查询 `elsewhere.db` 验证 SQLite 数据
- GitHub Actions CI（commit `5c4ed9f`，run `40467678611`）：前端 lint / format / typecheck / 16 个单测 / build / 10 个 E2E，Rust fmt / clippy / test 全部通过
- GitHub Actions macOS Release（tag `v0.1.0`，run `40468190942`）：universal `.app` 编译、ad-hoc 签名、DMG / ZIP / checksum 打包与 Release 发布全部通过
- 产物复核：`CFBundleIdentifier=com.phanstal.elsewhere`、`LSMinimumSystemVersion=12.0`、`CFBundleShortVersionString=0.1.0`；Mach-O fat binary 含 `x86_64` 与 `arm64`；DMG 10,313,605 bytes，SHA-256 `20901505be7e45e46a4ac3e3d8f6f85bd03ffabb1e620ba11deaf56434cc6347`；ZIP 9,298,580 bytes，SHA-256 `8003e16aeadac045ee3004f222f7ad8b48c96c1338ead7bc28557bd61999fa9a`；与 `SHA256SUMS.txt` 一致

> Playwright 验证的是浏览器 localStorage 适配器；SQLite、原生菜单、窗口和 DMG 仍需按下面的真机步骤验收。

## 1. 下载与安装

- [ ] 从 Releases 下载 `Elsewhere_0.1.0_universal.dmg`、`.zip` 与 `SHA256SUMS.txt`。
- [ ] 校验：`shasum -a 256 -c Elsewhere_0.1.0_universal.dmg.sha256`，结果为 `OK`。
- [ ] 打开 DMG，把 `Elsewhere.app` 拖入 `/Applications`。
- [ ] 首次启动：右键 → 打开 → 打开；或在“系统设置 → 隐私与安全性”里选择“仍要打开”。
- [ ] 若提示“已损坏”，执行 `xattr -dr com.apple.quarantine /Applications/Elsewhere.app` 后重开。
- [ ] 确认应用图标、应用名、窗口标题均为 Elsewhere；窗口默认 1440×900，最小 1040×680。
- [ ] 确认窗口使用 overlay 标题栏：红绿灯位于左上角，不遮挡品牌字标；顶部工具栏空白处可拖动窗口。

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

## 3. 工作室基础

- [ ] 顶部工具栏从左到右：品牌、世界名下拉、撤销 / 重做、缩放 −/百分比/+、Fit、保存状态、Create / Explore 切换、`Save .elsew`、`Export PNG`。
- [ ] 左侧栏显示 World、All Nodes、四组共 14 个创建项；点击任一项立即在画布中心创建并选中该节点。
- [ ] 右侧检查器显示节点类型眉标、标题、Type 下拉、Description、Create alias、Delete node。
- [ ] 画布为温暖象牙色点阵；世界边界可见；节点使用细边框、衬线标题、等宽类型标签。
- [ ] 空白处拖动可平移；滚轮 / 触控板可缩放；`Fit` 将世界重新居中；缩放范围限制在 30%–200%。
- [ ] 拖动节点可移动；拖动过程平滑，松开后位置保存；撤销可回到拖动前。
- [ ] Place 与 Category 右下角有缩放把手；拖动时左上角保持锚定，尺寸提示实时更新；撤销恢复原尺寸。
- [ ] 其他 12 种节点没有缩放把手，尺寸固定。
- [ ] 双击节点标题可就地改名，`Enter` 提交，`Esc` 取消，空标题不会保存为空。
- [ ] 选中节点按 `Delete` / `Backspace` 可删除（若有确认则确认）；关系选中时同样可删除。
- [ ] 修改后状态先显示 `Saving…`，约 420 ms 后变为 `Saved`。
- [ ] 返回首页后立即重新打开，最后修改仍在（返回会 flush）。
- [ ] `⌘Z` / `⇧⌘Z` 可撤销 / 重做；工具栏按钮状态同步。
- [ ] 新建空世界显示 “Every world begins somewhere.” 空状态和创建提示；点击其按钮不会误触画布平移。

## 4. 别名

- [ ] 选中一个基础节点，点击 `Create alias`；画布出现第二个节点，位置相对源节点偏移，并自动选中。
- [ ] 别名与源节点标题、类型、描述一致；检查器眉标显示 `TYPE · ALIAS`；画布/侧栏有别名标记。
- [ ] 侧栏 `All Nodes` 计数不增加；画布顶部世界节点数包含别名。
- [ ] 拖动别名到别处，源节点不移动；修改别名的描述不影响源节点。
- [ ] `Delete alias` 只删除别名；源节点保留。
- [ ] 删除源节点时，其别名一并删除。
- [ ] 选中基础节点按 `Enter` 也可创建别名（输入框聚焦时不触发）。

## 5. 关系

- [ ] 节点左右两侧各有一个连接端口，悬停可见；从端口拖出出现跟随指针的虚线。
- [ ] 拖到另一个节点上松开，建立一条虚线关系；拖到空白处取消，不产生关系。
- [ ] 关系线两端跟随节点移动；标签位于曲线中点。
- [ ] 双击关系标签就地改名，`Enter` 提交，检查器同步显示新名称。
- [ ] 点击关系线或标签选中关系；检查器显示 `RELATION`、Connection 两端、Name、Delete relation。
- [ ] 在检查器改名后，画布标签同步；删除关系后线条和标签消失。
- [ ] 删除一端节点时，相关关系自动删除。
- [ ] 关系不能连接节点自身，也不能重复连接到同一对节点（若产品行为为允许重复，请以实际为准并记录）。

## 6. `.elsew` 导出与导入

- [ ] 点击 `Save .elsew` 弹出系统保存对话框，默认文件名为世界名清洗后的 `.elsew`。
- [ ] 取消对话框不报错、不产生文件。
- [ ] 保存后用文本编辑器打开：`format` 为 `elsew`，`version` 为 1，包含 `id`、`name`、`updatedAt`、`nodes`、`relations`。
- [ ] 节点坐标、尺寸、描述、`sourceId` 与画布一致；关系两端 ID 存在。
- [ ] 把导出的文件通过 `Import .elsew` 导入，得到一个新世界，内容一致，ID 与原世界不同。
- [ ] 导入原型导出的旧文件（含时间戳 ID、缺少 width/height）：节点按类型补齐尺寸，能正常显示。
- [ ] 选择非 JSON、缺 `format`、版本不为 1、节点类型非法的文件：给出可读错误提示，不产生半个世界。
- [ ] 导入 5000 个以上节点的文件被拒绝，应用不卡死。

## 7. PNG 导出

- [ ] 点击 `Export PNG` 弹出系统保存对话框，默认文件名为世界名 `.png`。
- [ ] 取消不报错；保存后图片能正常打开。
- [ ] 图片包含点阵背景、世界边界、所有节点、关系虚线与标签，与屏幕布局一致。
- [ ] 图片为 2 倍像素密度，文字清晰，没有空白图、偏移、裁切或透明背景。
- [ ] 含有半透明节点（如 Faction）时，重叠区域按实际半透明混合，不是渲染错误。
- [ ] 世界为空或只有一个节点时也能导出有效 PNG。

## 8. Explore 模式

- [ ] 点击 `Explore` 后侧栏和检查器隐藏，画布扩展，顶部仍保留品牌、世界名、缩放、Fit、Create/Explore 切换与保存状态。
- [ ] 点击任意节点（含别名）弹出只读浮层，显示类型、标题、描述、别名标记和坐标，不显示编辑控件。
- [ ] 点击浮层关闭按钮或空白处关闭浮层；`Esc` 也可关闭。
- [ ] Explore 中不能拖动节点、不能连线、不能修改内容。
- [ ] 切回 `Create` 后侧栏、检查器恢复，之前的选择与滚动位置合理。
- [ ] `⇧⌘O` 可在两种模式间切换。

## 9. 原生菜单与窗口

- [ ] macOS 菜单栏包含 `Elsewhere`、`File`、`Edit`、`View`、`Window`。
- [ ] `File → New World`（`⌘N`）在任意页面新建世界。
- [ ] `File → Save`（`⌘S`）立即保存当前世界。
- [ ] `File → Export World (.elsew)…`（`⇧⌘E`）打开保存对话框。
- [ ] `File → Export Image (PNG)…`（`⇧⌘P`）打开保存对话框。
- [ ] `Edit` 菜单的 Undo / Redo / Cut / Copy / Paste / Select All 可用；标题或描述输入框中剪切/粘贴正常。
- [ ] `View → Zoom In / Zoom Out`、`Fit Canvas`（`⌘0`）、`Toggle Explore Mode`（`⇧⌘O`）、`Toggle Full Screen` 均可用。
- [ ] 全屏下红绿灯与工具栏不重叠；退出全屏后窗口尺寸恢复。
- [ ] 窗口拖动、最小化、关闭正常；重新打开后窗口尺寸与位置恢复。
- [ ] 关闭窗口前未保存的修改会被 flush；重开后内容一致（强杀进程除外）。

## 10. 窄屏布局（开发 / Web 预览）

macOS 应用最小宽度为 1040，以下用浏览器 `npm run dev` 或 Playwright 720×820 验证：

- [ ] ≤980px 隐藏左侧栏，出现工具栏 Quick add 按钮；检查器变为底部抽屉。
- [ ] Quick add 打开节点选择浮层，选择类型后节点创建并选中。
- [ ] 底部抽屉可编辑标题、类型、描述，不遮挡画布主要区域。
- [ ] ≤640px 首页改为单列，标题、按钮、卡片不溢出，仍可创建 / 导入 / 打开世界。
- [ ] 工具栏在窄屏只保留必要动作，导出按钮不换行、不溢出。

## 11. 数据与隐私

- [ ] 断网后新建、编辑、导入、导出全部可用。
- [ ] 用 Little Snitch / Activity Monitor 观察，没有出站连接。
- [ ] 数据库位于 `~/Library/Application Support/com.phanstal.elsewhere/elsewhere.db`。
- [ ] 关闭应用后复制该文件，删除应用数据目录，重开为空库；恢复文件后世界回来。
- [ ] 连续编辑 10 分钟、频繁切换世界无崩溃、无明显卡顿。
- [ ] 至少 50 个世界、单个世界 100 个节点时，首页滚动与画布拖动仍可用。
- [ ] 应用退出后不残留后台进程。

## 12. 已知限制（v0.1.0 接受）

- 无 Apple 签名 / 公证，首次启动需要手动放行；每次新版本可能重复。
- 无自动更新、云同步、账号、协作、版本历史（仅会话内撤销 / 重做）。
- 世界固定 1100×680；节点不能旋转；只有 Place / Category 可缩放。
- 关系是两节点间的命名连线，不支持路径点、多重边分组或跨世界引用。
- Image 节点目前只有占位图形，没有图片上传 / 裁切流程。
- 界面为英文，时间格式 en-US；与原型一致。
- 自动保存约 420 ms 防抖；返回、`⌘S`、正常关窗会 flush，强制结束进程可能丢失最后不到 420 ms。
- 数据库未加密，依赖 macOS 账户权限保护。

## 13. 验收结论

- [ ] 自动化检查全部通过（GitHub Actions CI 绿色）
- [ ] macOS Release 工作流产出了 DMG、ZIP 与 checksum
- [ ] 真机安装、创建、编辑、别名、关系、导入导出、PNG、Explore、菜单、窗口恢复全部通过
- [ ] 验收人：__________ 日期：__________
- [ ] 备注：
