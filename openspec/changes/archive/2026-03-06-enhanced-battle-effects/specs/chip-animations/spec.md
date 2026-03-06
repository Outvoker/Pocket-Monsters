## ADDED Requirements

### Requirement: 赢得筹码的金币飞入动画
当 showdown 结束后获胜者的筹码增加时，系统 SHALL 播放金币从奖励池位置飞向获胜者筹码显示区域的动画。

#### Scenario: 获胜者筹码增加时金币飞入
- **WHEN** showdown 阶段结束，获胜者的 chip delta > 0
- **THEN** 系统 SHALL 从 `#pot-display` 位置生成 8-15 个金币粒子元素，沿弧形轨迹飞向获胜者的筹码显示区域，每个粒子飞行时间 0.6-1.0 秒（带随机延迟），金币元素使用 `🪙` 或圆形金色 div

#### Scenario: 金币粒子自动回收
- **WHEN** 金币飞入动画完成
- **THEN** 所有金币粒子 DOM 元素 SHALL 在动画结束后立即从 DOM 中移除

### Requirement: 失去筹码的碎裂消散动画
当玩家输掉筹码时（chip delta < 0），系统 SHALL 在该玩家的筹码显示区域播放碎裂消散效果。

#### Scenario: 失败者筹码减少时碎裂消散
- **WHEN** showdown 阶段结束，某玩家的 chip delta < 0
- **THEN** 系统 SHALL 在该玩家筹码数字位置生成 6-10 个碎片粒子，向四周扩散并逐渐透明消失，持续 0.8 秒，碎片颜色为红色系

### Requirement: 下注时的筹码飞出动画
当玩家执行 call 或 raise 操作时，系统 SHALL 播放筹码从玩家区域飞向奖励池的简短动画。

#### Scenario: 玩家下注时筹码飞向奖励池
- **WHEN** 任意玩家执行 call 或 raise 操作
- **THEN** 系统 SHALL 生成 3-5 个小型金币粒子从操作者位置飞向 `#pot-display`，飞行时间 0.4 秒
