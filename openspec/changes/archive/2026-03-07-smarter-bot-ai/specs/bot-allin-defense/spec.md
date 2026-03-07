## ADDED Requirements

### Requirement: Bot uses dedicated decision path when facing all-in
Bot SHALL detect when the current bet represents an all-in from another player and apply specialized logic instead of the standard betting decision tree.

#### Scenario: Medium+ hand with favorable pot odds
- **WHEN** bot faces an all-in AND strength ≥ 0.50 AND pot odds < 0.45
- **THEN** bot SHALL call (MUST NOT fold)

#### Scenario: Medium hand facing aggressive all-in player
- **WHEN** bot faces an all-in AND strength ≥ 0.35 AND opponent is classified as aggressive (aggression > 0.6 or allin rate > 0.3)
- **THEN** bot SHALL call with ≥80% probability

#### Scenario: Decent hand with very favorable pot odds
- **WHEN** bot faces an all-in AND strength ≥ 0.30 AND pot odds < 0.30
- **THEN** bot SHALL call with ≥70% probability

#### Scenario: Weak hand facing all-in
- **WHEN** bot faces an all-in AND strength < 0.25
- **THEN** bot SHALL fold with ≥75% probability but retain 10–25% hero-call chance

#### Scenario: Any hand facing minimum all-in (short stack)
- **WHEN** bot faces an all-in AND the all-in amount is ≤ 2× big blind
- **THEN** bot SHALL always call regardless of hand strength (pot odds are too favorable to fold)

### Requirement: Bot does not fold to all-in with strong made hands
Bot SHALL never fold when facing an all-in with a made hand of three-of-a-kind (rank 3) or better.

#### Scenario: Three-of-a-kind or better facing all-in
- **WHEN** bot has hand rank ≥ 3 (three_of_a_kind, straight, flush, full_house, four_of_a_kind, straight_flush, royal_battle) AND faces an all-in
- **THEN** bot SHALL call or re-raise all-in (MUST NOT fold)
