## 1. Draw Detection Utilities (shared/gameLogic.js)

- [x] 1.1 Add `countFlushDraw(cards)` function: count max cards of same type, return { type, count }
- [x] 1.2 Add `countStraightDraw(cards)` function: detect open-ended and gutshot draws, return { type, count }
- [x] 1.3 Export both functions in the `GameLogic` object and update `public/js/gameLogic.js` to match

## 2. Preflop Hand Strength (server.js)

- [x] 2.1 Create `evaluatePreflopStrength(hand)` function with tiered scoring: high pair (0.85-0.95), medium pair (0.65-0.80), low pair (0.55-0.65), suited connectors (0.50-0.65), high card (0.40-0.55), weak (0.20-0.40)
- [x] 2.2 Replace the existing preflop evaluation block in `botDecide` (lines 172-186) with call to `evaluatePreflopStrength`

## 3. Postflop Hand Strength with Draw Bonus (server.js)

- [x] 3.1 Create `calculateDrawBonus(hand, community)` function using `countFlushDraw` (+0.18) and `countStraightDraw` (open-ended +0.15, gutshot +0.08)
- [x] 3.2 Create `evaluatePostflopStrength(hand, community)` function combining rank-based strength + draw bonus, capped at 1.0
- [x] 3.3 Replace the existing postflop evaluation block in `botDecide` (lines 164-170) with call to `evaluatePostflopStrength`

## 4. Opponent Behavior Tracking (server.js)

- [x] 4.1 Add `playerStats` object to `RoomState` constructor, initialized as empty `{}`
- [x] 4.2 Create `recordPlayerAction(room, playerId, action)` helper that increments totalActions, aggressiveActions (for raise/allin), and allinCount (for allin)
- [x] 4.3 Call `recordPlayerAction` in `executeBotAction` and in the `player_action` socket handler for all actions
- [x] 4.4 Create `getOpponentAggression(room, botId)` function that returns aggression rate of the last raiser/bettor, defaulting to 0.3 if insufficient data (<4 actions)

## 5. Pot Odds Decision Engine (server.js)

- [x] 5.1 Create `decideAction(strength, potOdds, aggression, context)` function implementing the EV-based decision logic: positive EV → call/raise, negative EV → fold, grey zone → use secondary factors
- [x] 5.2 Implement raise sizing logic: strong hands 60-100% pot, medium 40-70% pot, bluffs 50-75% pot

## 6. All-in Defense Logic (server.js)

- [x] 6.1 Add all-in detection in `botDecide`: check if `toCall >= room.currentBet` and an opponent went all-in (or toCall is very large relative to pot)
- [x] 6.2 Implement dedicated all-in defense path: rank≥3 never fold, strength≥0.50 with potOdds<0.45 always call, strength≥0.35 vs aggressive 80% call, weak hands 10-25% hero-call, short-stack allin (≤2×BB) always call

## 7. Rewrite botDecide Integration (server.js)

- [x] 7.1 Rewrite `botDecide` to use the new sub-functions: evaluate strength → check all-in → calculate pot odds → get opponent aggression → call `decideAction`
- [x] 7.2 Retain raise count limit logic (maxRaises 3-4) from existing implementation
- [x] 7.3 Add 5-15% random noise to decisions for unpredictability (occasional suboptimal plays)

## 8. Smoke Test

- [x] 8.1 Start server, create room with bots, verify bots no longer fold to repeated all-in bluffs
- [x] 8.2 Verify bots still fold weak hands to normal-sized bets when pot odds are unfavorable
- [x] 8.3 Verify no infinite raise loops (raise count cap still works)
