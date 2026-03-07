## ADDED Requirements

### Requirement: Server auto-reveal timing matches client animation duration
服务端 `autoRevealBoard()` 中每张卡片的等待间隔 SHALL 不小于客户端单张卡片入场动画的完整时长（精灵球旋转 + 属性特效展示 + 飞入卡位），确保下一阶段的 game_state 在前一阶段所有卡片动画播放完毕后才发送。

#### Scenario: Flop 三张卡片动画全部播完后才发送 Turn 的 game_state
- **WHEN** 所有玩家 all-in，服务端执行 `autoRevealBoard()` 发送 flop 阶段的 3 张公共卡
- **THEN** 服务端 SHALL 等待至少 3 × 单卡动画时长（~2800ms × 3 = 8400ms）后，才发送 turn 阶段的 game_state

#### Scenario: Turn 卡片动画播完后才发送 River 的 game_state
- **WHEN** 服务端发送 turn 阶段的 1 张公共卡
- **THEN** 服务端 SHALL 等待至少 1 × 单卡动画时长（~2800ms）后，才发送 river 阶段的 game_state

#### Scenario: River 卡片动画播完后才进入 showdown
- **WHEN** 服务端发送 river 阶段的 1 张公共卡
- **THEN** 服务端 SHALL 等待至少 1 × 单卡动画时长后，才调用 `doShowdown()`

### Requirement: Client renderCommunity defers DOM updates during active card animations
客户端 `renderCommunity()` 在卡片入场动画队列正在播放时，SHALL NOT 直接操作社区卡片区域的 DOM（不插入、不替换、不重建），而是将新到达的 game_state 缓存为待渲染状态，等待动画队列清空后再应用。

#### Scenario: 动画播放中收到新 game_state 时缓存而非立即渲染
- **WHEN** `isPlayingCardEntry === true` 且 `renderCommunity()` 被调用
- **THEN** 新的 community cards 数据 SHALL 被缓存到 `pendingCommunityState`，不修改 DOM

#### Scenario: 动画队列清空后自动应用缓存的 state
- **WHEN** `processCardEntryQueue()` 完成最后一张卡片的动画且 `pendingCommunityState` 不为 null
- **THEN** SHALL 立即以缓存的 state 重新调用 `renderCommunity()` 进行渲染，并清空 `pendingCommunityState`

#### Scenario: 非动画状态下正常渲染不受影响
- **WHEN** `isPlayingCardEntry === false` 且 `cardEntryQueue.length === 0`
- **THEN** `renderCommunity()` SHALL 正常执行原有渲染逻辑，不做任何延迟

### Requirement: Showdown and tournament animations wait for card entry animations to complete
对决动画（tournament battle 动画和 showdown overlay）SHALL 仅在所有入场动画播放完毕后才触发，防止入场动画与对决动画在画面上重叠。

#### Scenario: 入场动画未完成时不触发对决动画
- **WHEN** `renderGame()` 检测到 phase 为 showdown 且有 winners，但 `isPlayingCardEntry === true` 或 `cardEntryQueue.length > 0`
- **THEN** SHALL NOT 调用 `playTournamentAnimations()` 或 `showShowdown()`，而是等待入场动画完成后再触发

#### Scenario: 入场动画完成后自动触发对决动画
- **WHEN** 入场动画队列清空，且当前 gameState 的 phase 为 showdown 且有 winners
- **THEN** SHALL 自动触发对决动画流程（`playTournamentAnimations()` 或 `showShowdown()`）

#### Scenario: 无入场动画时立即进入对决
- **WHEN** phase 变为 showdown 时没有入场动画在播放（`isPlayingCardEntry === false` 且 `cardEntryQueue.length === 0`）
- **THEN** SHALL 立即按原有逻辑触发对决动画
