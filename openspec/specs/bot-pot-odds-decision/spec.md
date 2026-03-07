## ADDED Requirements

### Requirement: Bot calculates pot odds before call/fold decisions
Bot SHALL compute pot odds (`toCall / (pot + toCall)`) and compare against estimated hand equity before deciding to call or fold.

#### Scenario: Positive EV call
- **WHEN** bot's estimated equity exceeds pot odds
- **THEN** bot SHALL call or raise (MUST NOT fold except with ≤5% random trap frequency)

#### Scenario: Clear negative EV
- **WHEN** bot's estimated equity is less than 70% of pot odds
- **THEN** bot SHALL fold with high probability (≥70%)

#### Scenario: Marginal EV (grey zone)
- **WHEN** bot's estimated equity is between 70%–100% of pot odds
- **THEN** bot SHALL use secondary factors (opponent aggression, stack depth, position) to break the tie

### Requirement: Raise sizing reflects hand strength and pot
Bot SHALL size raises proportionally to hand strength and pot size, not purely as multiples of big blind.

#### Scenario: Very strong hand raise
- **WHEN** bot has strength > 0.75 and decides to raise
- **THEN** raise amount SHALL be 60–100% of pot size

#### Scenario: Medium hand raise
- **WHEN** bot has strength 0.45–0.75 and decides to raise
- **THEN** raise amount SHALL be 40–70% of pot size

#### Scenario: Bluff raise
- **WHEN** bot has strength < 0.35 and decides to bluff-raise
- **THEN** raise amount SHALL be 50–75% of pot size to appear credible
