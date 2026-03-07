## ADDED Requirements

### Requirement: Calculate side pots from player total bets
The system SHALL calculate side pots based on all round participants' `totalBet` values. When players have different `totalBet` amounts (due to all-in with insufficient chips), the pot MUST be split into multiple layers. Each layer's amount equals the per-person contribution at that tier multiplied by the number of contributors. Folded players' bets contribute to pot amounts but folded players are NOT eligible to win.

#### Scenario: All players bet the same amount
- **WHEN** all non-folded players have the same `totalBet` value
- **THEN** the system SHALL produce a single pot (main pot) with all non-folded players as eligible

#### Scenario: One player all-in with fewer chips
- **WHEN** Player A all-ins with totalBet=100 and Player B has totalBet=300
- **THEN** the system SHALL produce two pots:
  - Main pot: 200 (100 × 2 players), eligible: [A, B]
  - Side pot 1: 200 (200 × 1 player), eligible: [B]

#### Scenario: Multiple players all-in at different amounts
- **WHEN** Player A (all-in, totalBet=50), Player B (all-in, totalBet=150), Player C (totalBet=300)
- **THEN** the system SHALL produce three pots:
  - Main pot: 150 (50 × 3), eligible: [A, B, C]
  - Side pot 1: 200 (100 × 2), eligible: [B, C]
  - Side pot 2: 150 (150 × 1), eligible: [C]

#### Scenario: Folded player's bets are included in pot amounts
- **WHEN** Player A (folded, totalBet=40), Player B (all-in, totalBet=100), Player C (totalBet=300)
- **THEN** Player A's 40 chips SHALL be distributed across the applicable tiers but Player A SHALL NOT appear in any pot's eligible list

#### Scenario: Two players all-in at the same amount
- **WHEN** Player A (all-in, totalBet=200) and Player B (all-in, totalBet=200) and Player C (totalBet=400)
- **THEN** the system SHALL produce two pots:
  - Main pot: 600 (200 × 3), eligible: [A, B, C]
  - Side pot 1: 200 (200 × 1), eligible: [C]

### Requirement: Side pot preview during active betting
The system SHALL calculate and broadcast a side pot preview in the game state during active betting rounds (not just at showdown). This preview MUST reflect the current `totalBet` values of all round participants, updating whenever a new bet or action occurs.

#### Scenario: Side pot preview updates after each action
- **WHEN** a player makes a bet/call/raise/all-in action
- **THEN** the emitted game state SHALL include an updated `sidePots` array reflecting the current pot structure

#### Scenario: No side pots needed
- **WHEN** no player has gone all-in or all active players have equal totalBet
- **THEN** the `sidePots` array SHALL contain a single entry representing the main pot
