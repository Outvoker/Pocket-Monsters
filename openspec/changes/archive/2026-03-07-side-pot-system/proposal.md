## Why

当前 all-in 逻辑存在严重缺陷：当玩家 all-in 的筹码量少于其他玩家的下注时，所有筹码被简单地放入一个主池，最终赢家拿走全部奖池。这违反了标准德州扑克规则——all-in 玩家只应有权赢取与其投入等额的部分，超出部分应形成边池（side pot），由仍有筹码的玩家竞争。此外，当前每轮下注没有严格保证所有玩家匹配相同筹码量的机制，call 操作只是简单地补齐差额而没有考虑边池分配。

## What Changes

- 引入**边池（side pot）系统**：当有玩家 all-in 且筹码不足以匹配当前最高下注时，自动创建边池
- 重写**奖池分配逻辑**：showdown 时按照边池从小到大逐个结算，每个边池只有贡献了足够筹码的玩家才有资格赢取
- 修正**下注匹配逻辑**：确保 call 操作正确处理筹码不足的情况（partial call = all-in），并正确归入对应边池
- 前端**边池显示**：在 UI 上展示当前主池和各边池金额，让玩家清楚了解奖池结构
- 更新**结算展示**：showdown 结果面板显示每个边池的归属

## Capabilities

### New Capabilities
- `side-pot-calculation`: 边池计算引擎——根据各玩家 all-in 金额自动拆分主池与边池，确定每个池的参与者资格
- `pot-distribution`: 奖池分配系统——showdown 时按边池逐个结算，每个池独立评比手牌，分别确定赢家
- `side-pot-display`: 边池前端展示——UI 显示主池及各边池金额，结算时展示每个池的分配详情

### Modified Capabilities
<!-- 无已有 spec 需要修改 -->

## Impact

- **server.js**: `endGame`, `doShowdown`, `addBet`, `postBlind`, `startGame`, `startBettingRound` 等核心函数需要重构以支持边池
- **server.js**: `RoomState` 需要新增 `sidePots` 数组字段
- **server.js**: bot AI (`botDecide`) 需要感知边池信息做出更合理决策
- **public/js/client.js**: 渲染奖池区域需要展示边池信息，showdown 结算面板需要展示边池分配
- **public/css/style.css**: 新增边池展示样式
- **public/index.html**: 可能需要新增边池展示容器 DOM 元素
- **shared/gameLogic.js**: 无需修改（手牌评估逻辑不变）
