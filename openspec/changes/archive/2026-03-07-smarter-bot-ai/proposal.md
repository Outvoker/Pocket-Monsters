## Why

当前 AI（bot）在面对加注或 all-in 时过于容易弃牌，导致玩家只需无脑 all-in 即可稳赢。核心原因是 `botDecide` 函数的手牌强度评估过于粗糙、缺乏底池赔率计算、没有对手行为建模，弱牌面对任何下注都有 50% 概率弃牌，无法形成有效对抗。

## What Changes

- **重写手牌强度评估**：引入听牌潜力（顺子/同花 draw）计算，preflop 阶段使用更精确的起手牌分级表，而非简单的 value 平均值
- **引入底池赔率决策**：bot 在面对下注时计算 pot odds vs hand equity，只在赔率不利时才弃牌，而不是基于固定概率
- **对手行为感知**：根据对手下注模式（激进度、all-in 频率）动态调整策略，识别并惩罚频繁 all-in 的玩家
- **分层策略体系**：根据手牌强度 + 底池赔率 + 对手模式，构建更细粒度的决策树，减少随机性、增加理性
- **all-in 防御机制**：面对 all-in 时，中等以上手牌根据底池赔率大概率跟注，不再轻易弃牌

## Capabilities

### New Capabilities
- `bot-hand-evaluation`: 增强手牌强度评估——preflop 起手牌分级、postflop 听牌潜力（同花draw/顺子draw）、更精确的 strength 0-1 映射
- `bot-pot-odds-decision`: 底池赔率决策引擎——计算 pot odds、对比 hand equity、基于 EV 正负决定 call/fold/raise
- `bot-opponent-modeling`: 对手行为建模——追踪玩家激进度（VPIP/PFR 简化版）、识别 all-in 滥用者、动态调整弃牌阈值
- `bot-allin-defense`: all-in 防御策略——面对 all-in 时的专用决策逻辑，中等牌力以上根据底池赔率跟注而非随机弃牌

### Modified Capabilities

## Impact

- **server.js** — `botDecide()` 函数完全重写，`RoomState` 需新增对手统计字段
- **shared/gameLogic.js** — 可能需要导出额外的手牌评估工具函数（draw 判断等）
- **无前端改动** — 纯服务端逻辑，不影响 UI
- **无破坏性变更** — bot 对外行为接口不变（仍返回 `{ action, amount }`），仅决策质量提升
