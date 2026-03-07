## Why

All-in后公共区宝可梦的登场动画（精灵球旋转→属性特效→飞入卡位）是按序逐张播放的，每张约2.65秒。但服务端 `autoRevealBoard()` 发送下一阶段 game_state 的定时器间隔不足以等待客户端动画队列全部播完，导致前面的宝可梦还在播放入场动画时，后面阶段的宝可梦已经被渲染到公共区并提前触发对决动画，画面严重混乱。

## What Changes

- **修复服务端 `autoRevealBoard()` 的发牌定时器间隔**：将每张卡的等待时间从 2200ms 调整为与客户端实际动画时长匹配（~2700ms），确保 flop 的 3 张卡动画全部播完后才发 turn 的 game_state。
- **客户端增加动画队列状态感知**：当动画队列正在播放时，`renderCommunity()` 不应插入新卡片到 DOM，而是等待队列清空后再处理新到达的 game_state。通过引入一个"待渲染状态缓存"机制，确保新 game_state 在动画队列空闲后才被应用到社区卡区域。
- **增加 showdown/tournament 动画的触发守卫**：只有当所有入场动画播放完毕后，才允许进入对决（tournament battle）动画流程，防止入场和对决动画重叠。

## Capabilities

### New Capabilities
- `allin-animation-sequencing`: 修复 all-in 场景下公共区宝可梦入场动画与对决动画的时序控制，确保动画严格按序播放，不发生重叠

### Modified Capabilities

## Impact

- **server.js**: `autoRevealBoard()` 函数 — 调整定时器间隔常量
- **public/js/client.js**: `renderCommunity()`, `renderGame()`, `processCardEntryQueue()`, `playTournamentAnimations()` — 增加动画队列状态守卫逻辑
- 无新增依赖，纯前端+服务端定时逻辑修改
