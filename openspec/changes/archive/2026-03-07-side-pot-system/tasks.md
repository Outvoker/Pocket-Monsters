## 1. 边池计算引擎 (server.js)

- [x] 1.1 实现 `calculateSidePots(players)` 函数：接收所有本轮参与者（roundPlayers），根据各玩家 `totalBet` 和 `folded` 状态，按升序切分出主池和边池数组 `[{ amount, eligiblePlayerIds }]`
- [x] 1.2 在 `RoomState` 中新增 `sidePots` 数组字段，在 `publicState()` 中暴露 `sidePots` 给前端
- [x] 1.3 在 `emitGameState()` 中调用 `calculateSidePots()` 更新 `room.sidePots`，使边池预览在每次状态广播时刷新

## 2. 奖池分配重构 (server.js)

- [x] 2.1 实现 `distributePots(sidePots, players)` 函数：遍历每个池，评比该池 eligible 玩家的手牌，确定每个池的赢家并分配筹码
- [x] 2.2 重构 `doShowdown()`：用 `calculateSidePots` + `distributePots` 替换当前的简单 `pot / winners.length` 分配逻辑
- [x] 2.3 重构 `endGame()`：支持从 `distributePots` 返回的 per-pot breakdown 信息，生成包含 `potBreakdown` 的 `roundResults`
- [x] 2.4 处理 everyone-folded 场景：当所有人弃牌只剩一人时，跳过边池计算，直接将全部 pot 给剩余玩家
- [x] 2.5 实现 uncalled bet 退还：当最后一个加注/下注没有被完全跟注时，将未匹配部分退还给下注玩家

## 3. Winners 数据结构扩展 (server.js)

- [x] 3.1 扩展 `winners` 数组和 `roundResults` 格式，包含 `potBreakdown: [{ potLabel, amount, winnerIds, winnerNames }]`
- [x] 3.2 更新 `publicState()` 输出，确保 `potBreakdown` 信息传递到前端

## 4. 前端边池显示 (client.js + style.css + index.html)

- [x] 4.1 在 `I18N` 对象中添加边池相关文案：主池/Main Pot、边池 N/Side Pot N
- [x] 4.2 更新 `renderGame()` 中的奖池显示逻辑：当 `state.sidePots` 存在且有多个池时，渲染主池 + 边池列表
- [x] 4.3 在 `index.html` 的 pot-display 区域添加边池容器 DOM 元素（如有需要）
- [x] 4.4 在 `style.css` 中添加边池标签样式：紧凑标签、颜色区分主池/边池
- [x] 4.5 更新 showdown 结果面板：展示每个池的赢家和金额（potBreakdown 渲染）

## 5. 测试验证

- [x] 5.1 手动测试：2人对局，一人 all-in 筹码不足，验证边池正确计算和分配
- [x] 5.2 手动测试：3+人对局，多人不同金额 all-in，验证多层边池正确拆分
- [x] 5.3 手动测试：所有人弃牌场景，验证退化为单池正常分配
- [x] 5.4 手动测试：所有人下注相同（无边池场景），验证行为与改动前一致
- [x] 5.5 验证 bot 在边池场景下行为正常，不出现卡死或异常
