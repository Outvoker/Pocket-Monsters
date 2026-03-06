## ADDED Requirements

### Requirement: 翻牌阶段（Flop）转场动画
当游戏从 preflop 进入 flop 阶段时，系统 SHALL 播放精灵球旋转展开的转场动画。

#### Scenario: Preflop 到 Flop 的转场
- **WHEN** 游戏阶段从 preflop 切换到 flop
- **THEN** 场地中央的精灵球元素 `.arena-pokeball` SHALL 播放旋转+放大+发光动画，持续 1 秒，同时叠加从精灵球向四周扩散的光环效果

### Requirement: 转牌阶段（Turn）转场动画
当游戏进入 turn 阶段时，系统 SHALL 播放加速旋转的精灵球转场。

#### Scenario: Flop 到 Turn 的转场
- **WHEN** 游戏阶段从 flop 切换到 turn
- **THEN** 精灵球 SHALL 播放更快速的旋转动画（比 flop 快 50%），配合屏幕边缘的能量线条闪现效果，持续 0.8 秒

### Requirement: 河牌阶段（River）转场动画
当游戏进入 river 阶段时，系统 SHALL 播放最强烈的精灵球转场动画。

#### Scenario: Turn 到 River 的转场
- **WHEN** 游戏阶段从 turn 切换到 river
- **THEN** 精灵球 SHALL 播放剧烈旋转+脉冲放大动画，配合全屏闪光和能量爆发粒子效果，持续 1.2 秒

### Requirement: 阶段标签动画增强
阶段切换时，阶段标签 `.phase-banner` SHALL 播放缩放弹入动画。

#### Scenario: 阶段标签弹入
- **WHEN** 游戏阶段发生切换（preflop→flop→turn→river→showdown）
- **THEN** 阶段标签 SHALL 从 scale(0) 弹入到 scale(1)，使用弹性缓动函数，持续 0.5 秒
