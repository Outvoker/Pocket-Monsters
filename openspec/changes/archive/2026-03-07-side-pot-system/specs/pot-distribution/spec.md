## ADDED Requirements

### Requirement: Distribute each side pot independently
The system SHALL distribute each pot (main pot and all side pots) independently during showdown. For each pot, the system MUST evaluate the best hand among only the players eligible for that pot, and award the pot's amount to the winner(s) of that pot.

#### Scenario: All-in player wins main pot but not side pot
- **WHEN** Player A (all-in, totalBet=100, best hand) and Player B (totalBet=300, second best hand) and Player C (totalBet=300, worst hand)
- **THEN** Player A SHALL win the main pot (100 × 3 = 300) and Player B SHALL win side pot 1 (200 × 2 = 400)

#### Scenario: All-in player loses
- **WHEN** Player A (all-in, totalBet=100, worst hand) and Player B (totalBet=300, best hand)
- **THEN** Player B SHALL win both the main pot and side pot 1

#### Scenario: Tie within a side pot
- **WHEN** two eligible players in a pot have equal hand strength
- **THEN** the pot amount SHALL be split evenly between the tied players, with remainder chips distributed one at a time to tied players in order

### Requirement: Return uncalled bets
The system SHALL return any uncalled portion of a bet to the player. When a player raises or bets and no other player matches that full amount (because all others folded or went all-in for less), the unmatched portion MUST be returned to the betting player.

#### Scenario: Raise with no callers
- **WHEN** Player A raises to 500 and all other players fold
- **THEN** Player A's unmatched raise amount (the portion above the previous highest call) SHALL be returned to Player A

#### Scenario: All-in does not cover the full raise
- **WHEN** Player A bets 300, Player B all-ins for 150 (totalBet=150)
- **THEN** the main pot SHALL contain 150 × 2 = 300, and Player A's unmatched 150 SHALL be returned

### Requirement: Winners array includes per-pot breakdown
The system SHALL include per-pot winner information in the game state so the client can display which player won which pot. The `roundResults` MUST include a `potBreakdown` array detailing each pot's amount, eligible players, and winner(s).

#### Scenario: Multiple pots with different winners
- **WHEN** showdown resolves with Player A winning main pot and Player B winning side pot
- **THEN** the game state SHALL include a `potBreakdown` array with entries for each pot showing the amount, winners, and eligible players

#### Scenario: Single pot (no side pots)
- **WHEN** showdown resolves with all players having equal totalBet
- **THEN** the `potBreakdown` array SHALL contain a single entry for the main pot

### Requirement: Everyone-folded pot award
When all players except one have folded, the remaining player SHALL receive the entire pot. No side pot calculation is needed in this case since no showdown occurs.

#### Scenario: All opponents fold
- **WHEN** all players except Player A have folded
- **THEN** Player A SHALL receive the full pot amount and no side pot calculation SHALL be performed
