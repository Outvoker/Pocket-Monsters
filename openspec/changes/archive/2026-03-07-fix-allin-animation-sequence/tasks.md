## 1. 服务端定时器修复

- [x] 1.1 在 `server.js` 的 `autoRevealBoard()` 中，将 `singleCardTime` 从 2200ms 调整为 2800ms，确保每张卡的等待间隔覆盖客户端完整动画时长
- [x] 1.2 同步调整 `autoRevealBoard()` 中 `initialDelay`（preflop 阶段 all-in 时的初始等待），从 5500ms 调整为 `2 * 2800 + 1000 = 6600ms`（2 张手牌动画 + 缓冲）

## 2. 客户端 renderCommunity 动画队列守卫

- [x] 2.1 在 `client.js` 中新增 `pendingGameState` 变量（初始值 null），用于缓存动画播放期间到达的 game_state
- [x] 2.2 在 `renderCommunity()` 函数开头增加守卫：当 `isPlayingCardEntry === true` 或 `cardEntryQueue.length > 0` 时，将当前 state 缓存到 `pendingGameState` 并直接 return，跳过 DOM 操作
- [x] 2.3 在 `processCardEntryQueue()` 的队列清空逻辑（`isPlayingCardEntry = false` 之后）中，检查 `pendingGameState` 是否不为 null，若有则调用 `renderGame(pendingGameState)` 并将 `pendingGameState` 置为 null

## 3. Showdown/Tournament 动画触发守卫

- [x] 3.1 在 `renderGame()` 中 showdown/tournament 动画触发代码块（约 line 690-710）增加守卫条件：当 `isPlayingCardEntry || cardEntryQueue.length > 0` 时，不触发 `playTournamentAnimations()` 和 `showShowdown()`，仅缓存 state
- [x] 3.2 在 `processCardEntryQueue()` 队列清空时，如果当前 gameState 的 phase 为 showdown 且有 winners，自动触发对决动画流程（复用 renderGame 中的 showdown 分支逻辑）

## 4. 验证

- [ ] 4.1 手动测试：2 名玩家 preflop all-in 场景 — 确认手牌入场动画逐张播完→flop 3 张逐张播完→turn 播完→river 播完→对决动画开始，全程无重叠
- [ ] 4.2 手动测试：3+ 名玩家 flop 后 all-in 场景 — 确认 turn/river 入场动画按序播完后才进入对决
- [ ] 4.3 手动测试：正常下注流程（非 all-in）— 确认不受影响，发牌和动画行为与修复前一致
