# Requirements Document

## Introduction

This feature adds a "fun mode" toggle to the application that enables playful visual effects when activated. The primary effect is a DVD-style bouncing logo that appears after a period of user inactivity (AFK). The system provides users with the ability to switch between a standard viewing experience and an enhanced "fun mode" with visual effects overlaid on the Twitch stream player.

## Glossary

- **Fun Mode**: An optional viewing mode that enables playful visual effects and overlays on the stream player
- **Standard Mode**: The default viewing mode without additional visual effects
- **DVD Bounce Effect**: An animated logo that bounces around the screen similar to classic DVD screensaver behavior
- **AFK Timeout**: A period of user inactivity after which the DVD bounce effect is triggered
- **Stream Player**: The video player component displaying Twitch live streams
- **Mode Toggle**: A UI control that switches between Fun Mode and Standard Mode
- **User Activity**: Any mouse movement, keyboard input, or click interaction from the user

## Requirements

### Requirement 1

**User Story:** As a user, I want to toggle between standard and fun viewing modes, so that I can choose my preferred viewing experience

#### Acceptance Criteria

1. THE System SHALL provide a visible toggle control in the user interface for switching between Standard Mode and Fun Mode
2. WHEN the user clicks the Mode Toggle, THE System SHALL switch to the opposite mode within 200 milliseconds
3. THE System SHALL persist the user's mode preference in browser local storage
4. WHEN the application loads, THE System SHALL restore the user's last selected mode from local storage
5. THE System SHALL display a visual indicator showing which mode is currently active

### Requirement 2

**User Story:** As a user, I want a bouncing logo to appear when I'm inactive, so that the screen remains visually interesting during idle periods

#### Acceptance Criteria

1. WHILE Fun Mode is active, WHEN User Activity has not occurred for 60 seconds, THE System SHALL display the DVD Bounce Effect
2. THE System SHALL animate the logo to move continuously across the Stream Player area at a speed of 100 pixels per second
3. WHEN the logo reaches any edge of the Stream Player boundary, THE System SHALL reverse the logo's direction on that axis
4. WHEN the logo contacts a corner of the Stream Player boundary, THE System SHALL change the logo color to a random hue
5. WHEN User Activity is detected, THE System SHALL remove the DVD Bounce Effect within 100 milliseconds
6. THE System SHALL reset the AFK Timeout counter to zero when User Activity is detected

### Requirement 3

**User Story:** As a user, I want the bouncing logo to use our application branding, so that the effect feels integrated with the application

#### Acceptance Criteria

1. THE System SHALL use the application's logo image for the DVD Bounce Effect
2. THE System SHALL render the bouncing logo at a size of 120 pixels wide while maintaining aspect ratio
3. THE System SHALL apply color tinting to the logo without obscuring its recognizable shape
4. THE System SHALL ensure the logo remains fully visible within the Stream Player boundaries at all times

### Requirement 4

**User Story:** As a user, I want fun mode effects to only appear when I've enabled them, so that I have full control over my viewing experience

#### Acceptance Criteria

1. WHILE Standard Mode is active, THE System SHALL not display any DVD Bounce Effect regardless of AFK Timeout duration
2. WHILE Standard Mode is active, THE System SHALL not apply any visual effects to the Stream Player
3. WHEN the user switches from Fun Mode to Standard Mode, THE System SHALL immediately remove all active visual effects
4. THE System SHALL not track AFK Timeout while Standard Mode is active

### Requirement 5

**User Story:** As a user, I want the fun mode effects to work smoothly, so that they don't interfere with stream playback

#### Acceptance Criteria

1. THE System SHALL render the DVD Bounce Effect as an overlay layer above the Stream Player without blocking video controls
2. THE System SHALL maintain stream video playback performance with less than 5% CPU overhead when Fun Mode effects are active
3. THE System SHALL allow click-through interaction with Stream Player controls when the DVD Bounce Effect is active
4. THE System SHALL use CSS transforms and requestAnimationFrame for smooth 60fps animation performance
