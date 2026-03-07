## Context

Pocket Monsters 是一款宝可梦主题的德州扑克游戏。当前实现使用单一奖池（`room.pot`），所有玩家的下注都汇入同一个池中，showdown 时简单地将整个奖池平分给赢家。这在有玩家 all-in 且筹码量不同的场景下是不公平的——筹码少的玩家 all-in 后，理论上只应有权赢取与其贡献等额的部分。

当前关键代码结构：
- `server.js` 的 `RoomState` 维护单一 `pot` 字段
- `addBet()` / `postBlind()` 直接操作 `player.chips`、`player.bet`、`room.pot`
- `endGame()` 简单地 `Math.floor(room.pot / winners.length)` 分配
- `doShowdown()` 只评选一组全局赢家
- 前端 `client.js` 只显示单一 `pot` 数字

## Goals / Non-Goals

**Goals:**
- 实现标准德州扑克边池（side pot）系统，确保筹码不足的 all-in 玩家只能赢取其有资格参与的池
- 每个边池独立结算：评比该池所有有资格玩家的手牌，选出赢家
- 前端清晰展示主池和边池金额，showdown 时展示每个池的分配结果
- bot AI 能感知边池信息，不需要做复杂优化但不应因边池逻辑出 bug

**Non-Goals:**
- 不实现 "uncalled bet return"（未被跟注的加注退回）的复杂场景——当前简化为 all-in 金额直接参与边池计算
- 不修改手牌评估逻辑（`shared/gameLogic.js` 不变）
- 不改变盲注递增、锦标赛淘汰等机制
- 不做边池上限（cap）或其他高级扑克变体规则

## Decisions

### Decision 1: 边池计算时机——在 showdown/endGame 时一次性计算，而非每次下注实时维护

**选择**: 在 `doShowdown` / `endGame` 时根据各玩家的 `totalBet` 一次性计算所有边池。

**理由**: 
- 实时维护边池（每次 addBet 都更新边池列表）实现复杂度高，且需要处理 raise 后边池重组
- 一次性计算更简单可靠：只需在结算时收集所有非弃牌玩家的 `totalBet`，按金额排序后逐层切分
- 标准扑克软件（如 PokerStars）也多采用结算时计算的方式

**替代方案**: 每次 addBet 实时更新 sidePots 数组——更复杂但可以在游戏中实时显示准确边池。考虑到本项目是轻量级实现，结算时计算足够。但为了前端能在游戏进行中显示边池预览，我们在每次 `emitGameState` 时调用一个轻量的 `calculateSidePots()` 函数来计算当前状态下的边池预览。

### Decision 2: 边池数据结构

```javascript
// sidePots 数组，每个元素代表一个池
[
  { amount: 600, eligiblePlayerIds: ['p1', 'p2', 'p3', 'p4'] },  // 主池
  { amount: 400, eligiblePlayerIds: ['p2', 'p3', 'p4'] },         // 边池1
  { amount: 200, eligiblePlayerIds: ['p3', 'p4'] },               // 边池2
]
```

每个池的 `eligiblePlayerIds` 只包含未弃牌且 `totalBet` 达到该层阈值的玩家。

### Decision 3: 边池计算算法

1. 收集所有非弃牌参与者（`roundPlayers` 中未 fold 的），按 `totalBet` 升序排序
2. 逐层切分：对于每个唯一的 `totalBet` 值，计算该层每人贡献的差额 × 有资格的人数 = 该池金额
3. 弃牌玩家的 `totalBet` 也参与计算（他们的钱进入池中，但他们没有资格赢取）

```
示例: 4人游戏
- P1 (folded): totalBet=40
- P2 (all-in): totalBet=100
- P3 (all-in): totalBet=300
- P4 (active): totalBet=300

层1 (0→100): min(每人的totalBet, 100) 的贡献
  P1贡献40, P2贡献100, P3贡献100, P4贡献100 = 340
  eligible: [P2, P3, P4] (P1已fold)
  
层2 (100→300): 超出100部分, min(每人剩余, 200)
  P1贡献0, P2贡献0, P3贡献200, P4贡献200 = 400
  eligible: [P3, P4]

总奖池 = 340 + 400 = 740 ✓ (40+100+300+300=740)
```

### Decision 4: 前端边池展示方式

- 在现有 `pot-display` 区域下方追加边池列表
- 游戏进行中：显示预估的边池拆分（基于当前 totalBet 计算）
- showdown 时：显示最终边池及每个池的赢家
- 使用紧凑的标签式设计，不占用过多屏幕空间

### Decision 5: publicState 中传递边池信息

在 `room.publicState()` 中新增 `sidePots` 字段，前端根据此字段渲染边池。结算结果通过扩展现有的 `winners` 和 `roundResults` 来传递每个池的赢家信息。

## Risks / Trade-offs

- **复杂度增加** → 通过充分的边池计算单元测试覆盖各种场景（2人、多人、多个all-in、全部all-in等）来降低风险
- **bot AI 不感知边池** → bot 当前的决策逻辑主要基于手牌强度和底池赔率，边池信息对 bot 影响较小，暂不修改 bot 逻辑，仅确保 bot 在边池场景下不会出 bug
- **前端显示空间有限** → 使用折叠/紧凑样式，主池突出显示，边池以小标签形式展示
- **向后兼容** → 无边池时（所有人下注相同），系统退化为单一主池，行为与当前完全一致
