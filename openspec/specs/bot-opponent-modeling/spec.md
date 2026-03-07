## ADDED Requirements

### Requirement: Track per-player action statistics
The system SHALL maintain per-player statistics within a room tracking total actions, aggressive actions (raise + allin), and all-in count.

#### Scenario: Player raises
- **WHEN** any player (human or bot) performs a raise action
- **THEN** their `totalActions` and `aggressiveActions` counters SHALL both increment by 1

#### Scenario: Player goes all-in
- **WHEN** any player performs an all-in action
- **THEN** their `totalActions`, `aggressiveActions`, and `allinCount` counters SHALL all increment by 1

#### Scenario: Player calls or checks
- **WHEN** any player performs a call, check, or fold action
- **THEN** only their `totalActions` counter SHALL increment by 1

#### Scenario: New room starts
- **WHEN** a new room is created
- **THEN** all player stats SHALL be initialized to zero

### Requirement: Bot adjusts fold threshold based on opponent aggression
Bot SHALL calculate opponent aggression rate and reduce its fold probability when facing a highly aggressive opponent.

#### Scenario: Facing aggressive player (aggression > 0.6)
- **WHEN** the current bettor has aggression rate > 0.6 (aggressiveActions/totalActions) AND has at least 4 recorded actions
- **THEN** bot's fold probability SHALL be reduced by 30–50% compared to facing a neutral player

#### Scenario: Facing all-in abuser (allin rate > 0.3)
- **WHEN** the current bettor has allinCount/totalActions > 0.3 AND has at least 4 recorded actions
- **THEN** bot's fold probability SHALL be reduced by 40–60% compared to facing a neutral player

#### Scenario: Insufficient data
- **WHEN** the current bettor has fewer than 4 recorded actions
- **THEN** bot SHALL use default fold thresholds without aggression adjustment
