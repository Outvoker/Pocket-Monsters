## ADDED Requirements

### Requirement: Preflop hand strength uses tiered scoring
Bot SHALL evaluate preflop hand strength using a tiered scoring system based on pair status, suited status, card gap, and high card value, replacing the simple average-value formula.

#### Scenario: High pair dealt
- **WHEN** bot is dealt a pair with value ≥ 10
- **THEN** strength SHALL be in range 0.85–0.95

#### Scenario: Medium pair dealt
- **WHEN** bot is dealt a pair with value 6–9
- **THEN** strength SHALL be in range 0.65–0.80

#### Scenario: Low pair dealt
- **WHEN** bot is dealt a pair with value ≤ 5
- **THEN** strength SHALL be in range 0.55–0.65

#### Scenario: Suited connectors
- **WHEN** bot is dealt two suited cards with gap ≤ 1
- **THEN** strength SHALL be in range 0.50–0.65

#### Scenario: High card hand
- **WHEN** bot is dealt non-pair cards where at least one has value ≥ 11
- **THEN** strength SHALL be in range 0.40–0.55

#### Scenario: Weak hand
- **WHEN** bot is dealt non-pair, non-suited cards with both values < 11 and gap > 1
- **THEN** strength SHALL be in range 0.20–0.40

### Requirement: Postflop strength includes draw potential
Bot SHALL augment postflop hand strength with draw bonus when flush draws or straight draws are present on the board.

#### Scenario: Flush draw detected
- **WHEN** bot has 4 cards of the same type among hand + community cards
- **THEN** strength SHALL receive a bonus of +0.18

#### Scenario: Open-ended straight draw detected
- **WHEN** bot has 4 consecutive values with open ends among hand + community cards
- **THEN** strength SHALL receive a bonus of +0.15

#### Scenario: Gutshot straight draw detected
- **WHEN** bot has 4 of 5 consecutive values with one gap among hand + community cards
- **THEN** strength SHALL receive a bonus of +0.08

#### Scenario: No draw present
- **WHEN** bot has no flush draw and no straight draw
- **THEN** strength SHALL use base rank evaluation only with no bonus

### Requirement: Draw detection utility functions
The shared game logic module SHALL export `countFlushDraw(cards)` and `countStraightDraw(cards)` utility functions for use in bot decision-making.

#### Scenario: countFlushDraw identifies 4-card flush
- **WHEN** `countFlushDraw` is called with cards containing 4 of the same type
- **THEN** it SHALL return the count of cards in the most common type

#### Scenario: countStraightDraw identifies open-ended draw
- **WHEN** `countStraightDraw` is called with cards containing 4 consecutive values with both ends open
- **THEN** it SHALL return `{ type: 'open-ended', count: 4 }`

#### Scenario: countStraightDraw identifies gutshot draw
- **WHEN** `countStraightDraw` is called with cards containing 4 of 5 consecutive values
- **THEN** it SHALL return `{ type: 'gutshot', count: 4 }`
