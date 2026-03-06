## ADDED Requirements

### Requirement: All-in 操作触发震屏效果
当任意玩家（包括 bot）执行 allin 操作时，系统 SHALL 对游戏主容器 `#game-screen` 播放震屏动画。

#### Scenario: 玩家 All-in 时屏幕震动
- **WHEN** 任意玩家执行 allin 操作
- **THEN** `#game-screen` SHALL 播放持续 0.6 秒的随机方向震动动画，最大偏移量为 8px，震动频率为 50ms/帧

#### Scenario: 震屏不影响页面布局
- **WHEN** 震屏动画播放时
- **THEN** 震屏 SHALL 使用 CSS `transform: translate()` 实现，不触发 reflow，动画结束后 transform 恢复为 none

### Requirement: All-in 操作触发闪白效果
当任意玩家执行 allin 操作时，系统 SHALL 叠加一个全屏白色闪光层。

#### Scenario: All-in 闪白效果
- **WHEN** 任意玩家执行 allin 操作
- **THEN** 系统 SHALL 显示一个全屏白色半透明覆盖层（opacity 从 0.6 到 0），持续 0.4 秒，使用 ease-out 缓动

### Requirement: 震屏 debounce 防止叠加
短时间内多次触发震屏时，系统 SHALL 进行 debounce 防止动画叠加。

#### Scenario: 连续 All-in 不叠加震屏
- **WHEN** 在 0.8 秒内连续有两个玩家执行 allin
- **THEN** 系统 SHALL 只播放第一次震屏，忽略第二次触发，直到第一次动画完成
