## ADDED Requirements

### Requirement: 连胜光环特效
系统 SHALL 追踪当前玩家的连胜次数，并在连胜时为玩家区域添加渐强的光环特效。

#### Scenario: 2 连胜触发铜色光环
- **WHEN** 玩家连续获胜 2 局（chip delta > 0 连续 2 轮）
- **THEN** 玩家的 `.my-area` SHALL 显示铜色脉冲光环边框效果

#### Scenario: 3 连胜触发银色光环
- **WHEN** 玩家连续获胜 3 局
- **THEN** 光环升级为银色，脉冲频率加快，同时在对手列表中该玩家的 `.opponent-slot` 也显示银色光环

#### Scenario: 5 连胜触发金色光环
- **WHEN** 玩家连续获胜 5 局或以上
- **THEN** 光环升级为金色，增加粒子环绕效果，脉冲频率最快

#### Scenario: 连胜中断时光环消失
- **WHEN** 玩家在某轮的 chip delta ≤ 0（输了或平局折叠）
- **THEN** 连胜计数重置为 0，光环特效 SHALL 立即移除

### Requirement: 稀有牌型高光特效
当玩家达成高等级牌型时，系统 SHALL 播放专属稀有特效动画。

#### Scenario: 四天王牌型（四条）高光
- **WHEN** 玩家的最佳牌型为「四天王」（four_of_a_kind, rank 7）
- **THEN** 系统 SHALL 在手牌区域播放金色光柱 + 闪电环绕特效，持续 2 秒，并播放特殊音效

#### Scenario: 传说阵容/同系进化链高光
- **WHEN** 玩家的最佳牌型为「传说阵容」(rank 9) 或「同系进化链」(rank 8)
- **THEN** 系统 SHALL 播放全屏彩虹光波 + 星尘爆发特效，持续 3 秒，配合更强烈的音效，牌面上的宝可梦精灵图片增加发光描边动画

#### Scenario: 精英小队（满堂红）高光
- **WHEN** 玩家的最佳牌型为「精英小队」（full_house, rank 6）
- **THEN** 系统 SHALL 在手牌区域播放蓝色能量脉冲特效，持续 1.5 秒
