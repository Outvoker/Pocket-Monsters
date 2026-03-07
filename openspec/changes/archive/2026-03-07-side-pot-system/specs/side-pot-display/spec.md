## ADDED Requirements

### Requirement: Display side pots in the pot area
The client SHALL display all side pots alongside the main pot in the pot display area. Each pot MUST show its amount. The main pot SHALL be visually prominent, and side pots SHALL be displayed as smaller secondary labels.

#### Scenario: Single pot (no side pots)
- **WHEN** the game state contains only one pot entry
- **THEN** the display SHALL show only the main pot amount, identical to the current behavior

#### Scenario: Multiple side pots during gameplay
- **WHEN** the game state contains multiple pot entries during an active betting round
- **THEN** the display SHALL show the main pot prominently and each side pot as a labeled secondary element (e.g., "边池 1: 400")

#### Scenario: Pot display updates in real-time
- **WHEN** a player action causes the side pot structure to change
- **THEN** the pot display SHALL update to reflect the new structure without a full page refresh

### Requirement: Show per-pot winners in showdown results
The showdown results panel SHALL display which player(s) won each pot. Each pot entry MUST show the pot amount and the winner's name.

#### Scenario: Single winner of all pots
- **WHEN** one player wins every pot
- **THEN** the showdown panel SHALL show the total winnings, optionally collapsed into a single line

#### Scenario: Different winners for different pots
- **WHEN** Player A wins the main pot and Player B wins a side pot
- **THEN** the showdown panel SHALL clearly show each pot with its respective winner and amount

### Requirement: Side pot labels use localized text
The side pot labels SHALL use the current language setting (zh/en). Main pot SHALL be labeled "主池"/"Main Pot" and side pots SHALL be labeled "边池 N"/"Side Pot N".

#### Scenario: Chinese language
- **WHEN** the language is set to 'zh'
- **THEN** pots SHALL be labeled "主池", "边池 1", "边池 2", etc.

#### Scenario: English language
- **WHEN** the language is set to 'en'
- **THEN** pots SHALL be labeled "Main Pot", "Side Pot 1", "Side Pot 2", etc.
