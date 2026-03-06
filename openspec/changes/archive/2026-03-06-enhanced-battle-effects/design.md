## Context

Pocket Monsters Battle 是一个宝可梦主题的德州扑克网页游戏，使用 Express + Socket.io 后端和纯 vanilla JS 前端。当前已有的特效系统包括：

- **卡牌入场动画** (`playCardEntryAnimation`): 全屏属性特效 + 粒子爆发 + 飞入定位
- **属性音效** (`playTypeSound`): Web Audio API 合成的火/水/草/电音效
- **对战锦标赛动画** (`playTournamentAnimations`): showdown 阶段的逐对对决演出
- **操作公告** (`showActionAnnouncement`): raise/allin 时的全屏公告 + 粒子效果
- **sparkle 星星**: showdown 和冠军界面的装饰性闪烁

前端核心文件：`public/js/client.js`(~2068行)、`public/css/style.css`(~84KB)、`public/index.html`(312行)。所有特效均为纯前端实现，不涉及 Socket.io 协议变更。

## Goals / Non-Goals

**Goals:**
- 为每种属性设计专属的技能释放全屏特效，与宝可梦游戏中的经典招式视觉一致
- All-in 等关键操作增加震屏和闪光反馈，提升打击感
- 阶段切换（flop/turn/river）增加戏剧性转场，增强节奏感
- 筹码变化增加飞入/消散动画，强化输赢的情感反馈
- 连胜和稀有牌型触发专属高光特效，奖励优秀表现
- 当前回合玩家增加呼吸脉冲光效，清晰指示行动者
- showdown 胜者/败者增加差异化特效，强化结局仪式感
- 所有特效保持 60fps，使用 GPU 加速，兼容移动端

**Non-Goals:**
- 不修改游戏逻辑（server.js / shared/gameLogic.js）
- 不增加新的 Socket.io 事件或协议
- 不引入任何外部 JS/CSS 库（保持 vanilla 技术栈）
- 不修改宝可梦卡牌数据或牌型评估逻辑
- 不增加用户可配置的特效开关（后续迭代考虑）

## Decisions

### 1. 特效实现方式：CSS Keyframes + JS 粒子系统

**选择**: 延续现有架构，CSS `@keyframes` 负责主体动画，JS 负责动态粒子生成和生命周期管理。

**理由**: 现有代码已建立此模式（card-entry-effects、action-announcement-particles），团队熟悉；CSS 动画自动享受 GPU 合成加速（transform/opacity）；无需引入 Canvas 2D 或 WebGL 额外复杂度。

**替代方案**: Canvas 2D 粒子系统——性能更可控但需要全新渲染管线，与现有 DOM 动画不一致；WebGL——过度工程化。

### 2. 震屏实现：CSS transform 而非 window.scroll

**选择**: 对 `#game-screen` 容器应用 `transform: translate()` 的 CSS 动画实现震屏。

**理由**: 不触发 reflow，纯 GPU 合成；不影响页面实际滚动位置；可通过 `animation-duration` 精确控制震动频率和幅度。

**替代方案**: `window.scrollTo` 震动——会影响页面状态，移动端体验差；`margin` 偏移——触发 layout，性能差。

### 3. 特效触发点集成

**选择**: 在现有 `showActionLog`、`renderGame`、`showShowdown`、`renderCommunity` 等函数中插入特效触发调用，而非使用事件总线。

**理由**: 代码库规模适中（单文件 client.js），直接调用比抽象事件系统更简单可维护；现有 `showActionAnnouncement` 已采用此模式。

### 4. 粒子数量上限与性能保护

**选择**: 每个特效场景设置硬编码粒子上限（全屏技能 ≤ 30 个 DOM 元素，筹码动画 ≤ 20 个），并使用 `animationend` 事件自动回收。

**理由**: 防止低端设备 DOM 节点爆炸；与现有 `spawnActionParticles` 的回收模式一致。

### 5. 连胜追踪：客户端本地状态

**选择**: 在 client.js 中维护 `winStreak` 计数器，通过比较每轮 `roundResults` 中自己的 `delta > 0` 来递增/重置。

**理由**: 不需要服务端改动；连胜仅用于视觉增强，不影响游戏逻辑；断线重连后重置为 0 是可接受的。

### 6. 阶段转场动画：复用精灵球容器

**选择**: 复用 `index.html` 中已有的 `.arena-pokeball` 元素，在阶段切换时触发旋转+展开动画，同时叠加全屏闪光。

**理由**: 精灵球已是对战场地的视觉中心，利用它做转场符合宝可梦主题；减少新增 DOM 元素。

## Risks / Trade-offs

- **移动端性能**: 大量 CSS 动画可能在低端手机上掉帧 → 缓解：限制粒子数量，使用 `will-change` 提示，动画结束后立即移除 DOM 节点
- **动画时序冲突**: 多个特效可能同时触发（如 allin + 阶段切换 + 震屏） → 缓解：对震屏使用 debounce，特效使用 z-index 分层，避免视觉混乱
- **CSS 文件膨胀**: style.css 已有 84KB，新增大量 keyframes 会进一步增大 → 缓解：复用相似动画模式（如粒子爆发/飞散），命名空间化避免冲突
- **用户体验过载**: 特效过多可能反而分散注意力 → 缓解：控制每个特效的持续时间（≤2秒），避免遮挡关键 UI（操作按钮、筹码信息）
