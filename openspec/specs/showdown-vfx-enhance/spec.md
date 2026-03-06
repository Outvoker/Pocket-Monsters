## ADDED Requirements

### Requirement: 胜者光柱升天特效
showdown 阶段显示获胜者时，系统 SHALL 在获胜者展示区域播放光柱升天效果。

#### Scenario: 获胜者光柱特效
- **WHEN** showdown overlay 显示，且有明确获胜者（非全员弃牌情况）
- **THEN** 系统 SHALL 在 `.showdown-winner` 元素后方生成一道垂直光柱，从底部向顶部延伸，光柱颜色为金色渐变到白色，宽度为获胜者区域的 60%，持续 2 秒，带有微弱的左右摇曳动画

### Requirement: 胜者粒子爆发特效
光柱升天的同时，系统 SHALL 从光柱位置向四周喷射星形粒子。

#### Scenario: 光柱粒子爆发
- **WHEN** 胜者光柱特效开始播放
- **THEN** 系统 SHALL 从光柱顶部持续喷射 20-30 个星形粒子（✨⭐🌟），粒子沿抛物线轨迹向两侧扩散并逐渐消失，喷射持续 1.5 秒

### Requirement: 败者灰化消散特效
showdown 阶段的非获胜者信息 SHALL 播放灰化消散动画。

#### Scenario: 败者信息灰化
- **WHEN** showdown overlay 中显示非获胜者的结果行（`.round-result-row:not(.is-winner)`）
- **THEN** 非获胜者行 SHALL 在出现 1 秒后播放颜色去饱和（变灰）+ 轻微缩小（scale 0.95）+ 降低透明度（opacity 0.6）的动画，持续 0.8 秒

### Requirement: 锦标赛对决的攻击碰撞特效增强
现有锦标赛对决动画中两个玩家攻击时，系统 SHALL 增加碰撞冲击波效果。

#### Scenario: 对决碰撞时产生冲击波
- **WHEN** 锦标赛对决动画进入攻击阶段（Phase 3，两个玩家同时 attacking）
- **THEN** 系统 SHALL 在两个玩家之间的 VS 位置生成圆形扩散冲击波，冲击波从小到大扩散并逐渐透明，同时伴随 4-6 道放射状光线，持续 0.8 秒

### Requirement: 冠军加冕特效增强
最终冠军界面 SHALL 增加更华丽的视觉效果。

#### Scenario: 冠军界面增强特效
- **WHEN** `#champion-overlay` 显示（finalChampion 存在）
- **THEN** 系统 SHALL 在冠军卡片后方显示旋转的光圈，同时从底部持续升起金色气泡粒子，冠军名字文字增加渐变色流动动画
