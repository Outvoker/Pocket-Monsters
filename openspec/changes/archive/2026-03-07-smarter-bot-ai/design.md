## Context

当前 bot AI 决策逻辑位于 `server.js` 的 `botDecide()` 函数（约 150 行）。它基于简单的手牌等级映射（`rank/9`）和固定概率阈值做决策。主要问题：

1. **手牌强度评估粗糙**：preflop 仅用 `(v1+v2)/2/13` 估算；postflop 只看 `rank/9`，不考虑听牌潜力
2. **无底池赔率意识**：虽然计算了 `potOdds`，但从未真正用于决策比较
3. **弱牌防御差**：面对任何下注，弱牌 50% 直接弃牌；面对 all-in 没有特殊逻辑
4. **对手建模缺失**：不追踪玩家行为模式，无法识别 bluff 或 all-in 滥用

当前架构：`botDecide(room, bot)` → `{ action, amount }` → `executeBotAction()` → `scheduleBotAction()`

## Goals / Non-Goals

**Goals:**
- Bot 能根据底池赔率合理决定跟注/弃牌，不再被简单 all-in 欺骗
- Preflop 起手牌评估更精确（pair 分级、suited connectors、高牌组合）
- Postflop 识别听牌潜力（4 张同花 draw、两端顺子 draw）并据此加大跟注意愿
- 追踪对手激进度，对频繁 all-in 的玩家降低弃牌率
- 维持 bot 的决策延迟和对外接口不变

**Non-Goals:**
- 不实现完整的 GTO（博弈论最优）策略
- 不引入 Monte Carlo 模拟或复杂概率计算（保持轻量）
- 不修改前端 UI
- 不改变 bot 的 think time 或动画行为
- 不实现多人对战中的复杂位置策略（仅做简单位置感知）

## Decisions

### D1: 手牌强度评估重构

**选择**：分阶段评估——preflop 用起手牌查找表，postflop 用 rank + draw 修正

**替代方案**：
- Monte Carlo 模拟（太重，52 张牌的枚举对服务端有性能压力）
- 纯查找表（postflop 状态太多，不现实）

**实现**：
- Preflop: 根据 `isPair`、`isSuited`、`gap`（两张牌 value 差距）、`highCard` 综合打分
  - 高对（value≥10）: strength 0.85-0.95
  - 中对（value 6-9）: strength 0.65-0.80
  - 低对（value≤5）: strength 0.55-0.65
  - 同花连牌（gap≤1, suited）: strength 0.50-0.65
  - 高牌（至少一张≥11）: strength 0.40-0.55
  - 其余: strength 0.20-0.40
- Postflop: 基础 `rank/9` + draw 加成
  - 4 张同花 draw: +0.18
  - 两端顺子 draw（open-ended）: +0.15
  - 单端顺子 draw（gutshot）: +0.08

### D2: 底池赔率决策引擎

**选择**：直接比较 pot odds vs estimated equity，基于 EV 决策

**替代方案**：
- 复杂 equity calculator（过重）
- 保持固定概率（当前方案，已被证明不够）

**实现**：
- `potOdds = toCall / (pot + toCall)` — 需要跟注占底池的比例
- `equity ≈ strength`（简化：手牌强度近似胜率）
- 当 `equity > potOdds` 时，跟注有正 EV → 大概率跟注
- 当 `equity < potOdds * 0.7` 时，明确负 EV → 考虑弃牌
- 中间灰色地带：根据位置、对手模式、筹码深度决定

### D3: 对手行为建模

**选择**：轻量级统计——在 RoomState 中追踪每个玩家的 `aggression` 指标

**替代方案**：
- 完整 VPIP/PFR/AF 统计（过于复杂）
- 不追踪（当前方案，无法识别 bluff）

**实现**：
- `room.playerStats[playerId]` 存储：
  - `totalActions`: 总行动次数
  - `aggressiveActions`: raise + allin 次数
  - `allinCount`: all-in 次数
- `aggressionRate = aggressiveActions / totalActions`
- 当对手 `aggressionRate > 0.6` 或 `allinCount/totalActions > 0.3` 时，视为激进玩家
- 面对激进玩家时，bot 的弃牌阈值降低（更愿意跟注/抓 bluff）

### D4: All-in 防御逻辑

**选择**：面对 all-in 时使用专用决策路径

**实现**：
- 面对 all-in 时，计算 `potOdds`
- strength ≥ 0.50 且 potOdds < 0.45 → 必跟（正 EV）
- strength ≥ 0.35 且对手是激进玩家 → 80% 跟注
- strength < 0.25 → 大概率弃牌（但仍保留 10-15% 的 hero call）
- 这确保 bot 不会被反复 all-in 欺压

### D5: 代码组织

**选择**：保持 `botDecide()` 作为单一入口，内部拆分为子函数

- `evaluatePreflopStrength(hand)` → 0-1
- `evaluatePostflopStrength(hand, community)` → 0-1
- `calculateDrawBonus(hand, community)` → 0-0.2
- `getOpponentAggression(room, botId)` → 0-1
- `decideAction(strength, potOdds, aggression, context)` → { action, amount }

所有新函数都在 `server.js` 内部，不导出。`shared/gameLogic.js` 新增 `countFlushDraw()` 和 `countStraightDraw()` 工具函数供服务端使用。

## Risks / Trade-offs

- **Bot 可能变得过强** → 通过保留适度随机性（5-15% 的非最优决策）和偶尔的 bluff 来保持游戏趣味性
- **对手统计跨局重置** → 仅在房间生命周期内追踪，不持久化。新房间 bot 从零开始适应，前几轮仍较保守
- **Draw 概率是近似值** → 不做精确计算（如同花 draw 约 35% 击中），用固定 bonus 近似。足够用于休闲游戏
- **性能影响极小** → 新增计算都是 O(n) 的简单遍历，52 张牌规模下可忽略
