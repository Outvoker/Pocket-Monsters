## 1. 基础设施 — DOM 容器与工具函数

- [ ] 1.1 在 `index.html` 中添加特效所需的 DOM 容器：震屏闪白层 `#screen-flash`、属性技能特效层 `#skill-effect-overlay`、筹码动画层 `#chip-anim-layer`、阶段转场闪光层 `#phase-flash`
- [ ] 1.2 在 `client.js` 中添加工具函数：`getDominantType(hand)` 根据手牌判定主要属性；`getPlayerChipEl(playerId)` 获取指定玩家的筹码显示元素位置
- [ ] 1.3 在 `client.js` 中添加连胜追踪状态变量 `winStreak` 和行动计时器 `turnStartTime`，在 `renderGame` 适当位置重置和更新

## 2. 震屏与闪白系统 (screen-shake-flash)

- [ ] 2.1 在 `style.css` 中添加 `@keyframes screen-shake` 动画（随机方向 translate，0.6s，8px 偏移）和 `.screen-shaking` 类
- [ ] 2.2 在 `style.css` 中添加 `#screen-flash` 全屏闪白层样式和 `@keyframes flash-white` 动画（opacity 0.6→0，0.4s ease-out）
- [ ] 2.3 在 `client.js` 中实现 `triggerScreenShake()` 函数，对 `#game-screen` 添加 `.screen-shaking` 类，带 debounce 防止叠加
- [ ] 2.4 在 `client.js` 中实现 `triggerScreenFlash()` 函数，显示 `#screen-flash` 闪白层
- [ ] 2.5 在 `showActionLog` 中，当 action 为 `allin` 时调用 `triggerScreenShake()` 和 `triggerScreenFlash()`

## 3. 属性技能特效系统 (type-skill-effects)

- [ ] 3.1 在 `style.css` 中添加 `#skill-effect-overlay` 容器样式（全屏 fixed，pointer-events:none，z-index 低于操作面板）
- [ ] 3.2 在 `style.css` 中添加火系技能动画：`@keyframes fire-vortex`（螺旋火焰柱从底部升起汇聚爆散）、相关粒子样式
- [ ] 3.3 在 `style.css` 中添加水系技能动画：`@keyframes water-cannon`（两侧水流涌入碰撞爆发）
- [ ] 3.4 在 `style.css` 中添加草系技能动画：`@keyframes leaf-storm`（树叶旋转飞入形成旋风）
- [ ] 3.5 在 `style.css` 中添加电系技能动画：`@keyframes thunderbolt`（闪电劈下形成电球放电）
- [ ] 3.6 在 `client.js` 中实现 `playSkillEffect(type)` 函数，在 `#skill-effect-overlay` 中动态生成对应属性的特效 DOM 元素，动画结束后自动回收
- [ ] 3.7 在 `showActionLog` 中，当 action 为 `raise` 或 `allin` 时，根据当前玩家手牌的 `getDominantType()` 调用 `playSkillEffect()`
- [ ] 3.8 在 `showShowdown` 中为获胜者触发一次属性技能特效

## 4. 阶段转场特效 (phase-transition-effects)

- [ ] 4.1 在 `style.css` 中添加精灵球转场动画：`@keyframes pokeball-spin-open`（旋转+放大+发光）、`@keyframes pokeball-pulse`（脉冲放大）、`.pokeball-transitioning` 类
- [ ] 4.2 在 `style.css` 中添加光环扩散效果 `@keyframes ring-expand` 和能量线条闪现 `@keyframes energy-lines`
- [ ] 4.3 在 `style.css` 中添加 `.phase-banner` 弹入动画 `@keyframes phase-bounce-in`（scale 0→1 弹性缓动）
- [ ] 4.4 在 `client.js` 的 `renderGame` 中检测阶段切换（对比 `lastPhase`），触发 `playPhaseTransition(fromPhase, toPhase)` 函数
- [ ] 4.5 在 `client.js` 中实现 `playPhaseTransition()` 函数，根据目标阶段选择不同强度的精灵球动画和光效

## 5. 筹码变化动画 (chip-animations)

- [ ] 5.1 在 `style.css` 中添加金币飞入动画 `@keyframes coin-fly-in`（弧形轨迹 + 旋转）和碎裂消散 `@keyframes chip-shatter`（向四周扩散 + 透明消失）
- [ ] 5.2 在 `style.css` 中添加下注飞出动画 `@keyframes coin-fly-to-pot`（从玩家位置飞向奖励池）
- [ ] 5.3 在 `client.js` 中实现 `playChipWinAnimation(targetEl, count)` 函数，从 pot 位置生成金币粒子飞向目标
- [ ] 5.4 在 `client.js` 中实现 `playChipLoseAnimation(targetEl)` 函数，在目标位置生成碎裂消散粒子
- [ ] 5.5 在 `client.js` 中实现 `playBetAnimation(fromEl)` 函数，从玩家位置生成少量金币飞向 pot
- [ ] 5.6 在 `showShowdown` 中遍历 `roundResults`，对 delta>0 的调用 `playChipWinAnimation`，delta<0 的调用 `playChipLoseAnimation`
- [ ] 5.7 在 `showActionLog` 中，当 action 为 `call` 或 `raise` 时调用 `playBetAnimation`

## 6. 连胜与稀有牌型高光 (streak-highlight-effects)

- [ ] 6.1 在 `style.css` 中添加连胜光环样式：`.streak-bronze`（铜色脉冲边框）、`.streak-silver`（银色加速脉冲）、`.streak-gold`（金色+粒子环绕），各自的 `@keyframes` 动画
- [ ] 6.2 在 `style.css` 中添加稀有牌型高光样式：`.rare-highlight-legendary`（彩虹光波+星尘）、`.rare-highlight-elite`（金色光柱+闪电）、`.rare-highlight-squad`（蓝色能量脉冲）
- [ ] 6.3 在 `client.js` 中实现连胜追踪逻辑：在 `showShowdown` 中检查自己的 `roundResults` delta，更新 `winStreak` 计数器
- [ ] 6.4 在 `client.js` 中实现 `applyStreakGlow(streak)` 函数，根据连胜数给 `.my-area` 和 `.opponent-slot.is-me` 添加对应光环类
- [ ] 6.5 在 `client.js` 中实现 `playRareHandEffect(rankKey)` 函数，根据牌型等级播放对应高光特效
- [ ] 6.6 在 `renderMyHand` 或 `renderGame` 中，当检测到高等级牌型（rank ≥ 6）时调用 `playRareHandEffect`

## 7. 当前回合呼吸光效 (active-turn-glow)

- [ ] 7.1 在 `style.css` 中添加 `.active-turn-glow` 类和 `@keyframes turn-pulse`（box-shadow 金色脉冲，1.5s 无限循环）
- [ ] 7.2 在 `style.css` 中增强 `.opponent-slot.is-turn` 的脉冲边框效果，添加属性色脉冲动画
- [ ] 7.3 在 `style.css` 中添加 `.action-urgent` 类和 `@keyframes urgent-blink`（红色边框加速闪烁）
- [ ] 7.4 在 `client.js` 的 `renderMyHand` 中，根据 `isMyTurn` 状态为手牌添加/移除 `active-turn-glow` 类
- [ ] 7.5 在 `client.js` 的 `renderActionPanel` 中，记录 `turnStartTime`，设置 5 秒后给 `#action-panel` 添加 `.action-urgent` 类的定时器

## 8. 对战结算特效增强 (showdown-vfx-enhance)

- [ ] 8.1 在 `style.css` 中添加胜者光柱样式 `.winner-light-pillar` 和 `@keyframes light-pillar-rise`（底部向顶部延伸的金色渐变光柱，带摇曳）
- [ ] 8.2 在 `style.css` 中添加光柱粒子喷射 `@keyframes pillar-particle-burst`（从顶部沿抛物线扩散消失）
- [ ] 8.3 在 `style.css` 中添加败者灰化样式 `.loser-fade` 和 `@keyframes desaturate-shrink`（去饱和+缩小+降透明度）
- [ ] 8.4 在 `style.css` 中添加锦标赛碰撞冲击波 `@keyframes collision-shockwave`（圆形扩散+放射光线）
- [ ] 8.5 在 `style.css` 中添加冠军界面增强：旋转光圈 `@keyframes champion-halo-rotate`、金色气泡升起 `@keyframes golden-bubble-rise`、名字渐变流动 `@keyframes gradient-flow`
- [ ] 8.6 在 `client.js` 的 `showShowdown` 中为 `.showdown-winner` 元素插入光柱和粒子 DOM 元素
- [ ] 8.7 在 `client.js` 的 `showShowdown` 中为非获胜者行添加 `.loser-fade` 类（延迟 1 秒后）
- [ ] 8.8 在 `client.js` 的 `showTournamentBattle` Phase 3 中插入冲击波 DOM 元素到 `.tournament-vs` 位置
- [ ] 8.9 在 `client.js` 的 `showFinalChampion` 中添加旋转光圈、金色气泡粒子和名字渐变动画

## 9. 集成测试与性能优化

- [ ] 9.1 手动测试所有特效在正常游戏流程中的触发时序和视觉效果，确认无冲突
- [ ] 9.2 验证特效在移动端（小屏幕）的表现，确认粒子数量适当、不遮挡操作按钮
- [ ] 9.3 使用 Chrome DevTools Performance 面板检查特效播放期间的帧率，确保不低于 30fps
- [ ] 9.4 确认所有粒子 DOM 元素在动画结束后被正确回收，无内存泄漏
