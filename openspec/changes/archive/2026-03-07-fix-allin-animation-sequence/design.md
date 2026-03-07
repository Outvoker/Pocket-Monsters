## Context

当所有玩家 all-in 后，服务端 `autoRevealBoard()` 按定时器逐阶段发送 community cards。客户端收到 game_state 后，`renderCommunity()` 将新卡片加入动画队列 `cardEntryQueue`，由 `processCardEntryQueue()` 异步逐张播放入场动画（精灵球旋转→属性特效→飞入卡位，每张约 2.65 秒）。

**当前问题**：
1. 服务端 `singleCardTime = 2200ms`，但客户端单卡动画实际耗时 ~2650ms（800ms pokeball + 1200ms reveal + 650ms fly），差值 ~450ms/卡累积后导致后续阶段的 game_state 在前面动画还没播完时就到达。
2. 客户端 `renderCommunity()` 收到新 game_state 时不检查动画队列是否为空，直接往 DOM 插入新卡或重建容器，破坏正在播放的动画。
3. `renderGame()` 中 showdown/tournament 动画触发逻辑不等待入场动画完成，导致入场动画和对决动画重叠。

**关键代码路径**：
- `server.js:772-801` — `autoRevealBoard()` 定时器
- `client.js:714-813` — `renderCommunity()` 
- `client.js:1814-1833` — `processCardEntryQueue()` / `queueCardEntry()`
- `client.js:634-711` — `renderGame()` 中 showdown 触发逻辑

## Goals / Non-Goals

**Goals:**
- 确保 all-in 后公共区宝可梦入场动画严格按序逐张播放完毕后，才发下一阶段的卡
- 确保所有入场动画播放完毕后才进入对决（tournament battle）动画
- 不改变非 all-in 场景的正常游戏流程

**Non-Goals:**
- 不重构整个动画系统
- 不改变单张卡片入场动画的视觉效果或时长
- 不修改正常下注流程中的发牌逻辑

## Decisions

### 决策 1：服务端增大 `singleCardTime` 常量

**选择**：将 `singleCardTime` 从 2200ms 提升到 2800ms，给客户端留足缓冲。

**理由**：客户端单卡动画实际耗时 800 + 1200 + 650 = 2650ms，加上渲染开销和网络延迟，2800ms 是安全值。

**备选方案**：让客户端向服务端发送"动画完成"消息，服务端收到后再发下一阶段。但这引入双向通信依赖，增加复杂度，且网络延迟可能导致卡顿。对于这个简单的定时修复，固定延迟更可靠。

### 决策 2：客户端 `renderCommunity()` 增加动画队列守卫

**选择**：当 `isPlayingCardEntry === true` 时，`renderCommunity()` 将新到达的 game_state 中的 community cards 暂存，不立即操作 DOM。当动画队列清空后，触发重新渲染。

**理由**：即使服务端定时准确，网络抖动仍可能导致 game_state 在动画播放中到达。客户端守卫是防御性保障。

**实现**：引入 `pendingCommunityState` 变量。`renderCommunity()` 开头检查 `isPlayingCardEntry`，若为 true 则缓存 state 后直接 return。`processCardEntryQueue()` 在队列清空时检查是否有 pending state 并触发渲染。

### 决策 3：Showdown/Tournament 动画等待入场动画完成

**选择**：在 `renderGame()` 中，showdown 和 tournament 动画的触发条件增加 `!isPlayingCardEntry && cardEntryQueue.length === 0` 守卫。如果入场动画还在进行，延迟触发对决动画。

**理由**：防止入场动画和对决动画在屏幕上重叠，这是用户报告的核心体验问题。

## Risks / Trade-offs

- **[风险] 固定延迟可能在极低端设备上仍不够** → 缓解：客户端守卫作为第二道防线，即使服务端定时偏差也能保证动画不重叠。
- **[风险] pendingCommunityState 可能导致 UI 短暂不一致** → 缓解：延迟极短（仅在动画队列最后一张播完后立即应用），用户不会感知到数据延迟。
- **[权衡] 增大 singleCardTime 会略微延长 all-in 后的总等待时间** → 每张卡多 ~600ms，flop 3 张多 ~1.8s，turn/river 各多 ~600ms，总共多 ~3s，体验上可接受且动画更流畅。
