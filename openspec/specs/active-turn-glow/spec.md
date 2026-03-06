## ADDED Requirements

### Requirement: 当前回合玩家卡牌呼吸脉冲光效
当轮到当前玩家行动时，系统 SHALL 为该玩家的手牌区域添加呼吸脉冲发光效果，明确指示轮到谁行动。

#### Scenario: 轮到我的回合时手牌发光
- **WHEN** `turnIndex` 指向当前客户端玩家（isMyTurn = true），且游戏不在 waiting/showdown 阶段
- **THEN** `#my-cards` 容器中的每张卡牌 `.poke-mon` SHALL 添加 `active-turn-glow` CSS 类，该类实现持续的 box-shadow 脉冲动画（从微弱到明亮再回到微弱），颜色为金色(#FFD700)，周期为 1.5 秒，无限循环

#### Scenario: 不是我的回合时移除光效
- **WHEN** `turnIndex` 不指向当前客户端玩家
- **THEN** 所有 `.poke-mon` 元素 SHALL 移除 `active-turn-glow` 类，光效立即停止

### Requirement: 对手区域当前行动者指示增强
在对手列表中，当前行动者的 slot SHALL 有更明显的视觉指示。

#### Scenario: 对手行动时边框发光
- **WHEN** 某个对手是当前行动者（is-turn 状态）
- **THEN** 该对手的 `.opponent-slot.is-turn` SHALL 显示与其手牌属性对应颜色的脉冲边框发光效果（如果属性未知则使用白色），脉冲周期为 1.2 秒

### Requirement: 行动倒计时视觉紧迫感
当轮到玩家行动时，系统 SHALL 通过视觉渐变提示紧迫感。

#### Scenario: 行动面板的紧迫感动画
- **WHEN** 轮到当前玩家行动超过 5 秒
- **THEN** `#action-panel` 的边框 SHALL 开始以加速频率闪烁红色，提示玩家尽快行动
