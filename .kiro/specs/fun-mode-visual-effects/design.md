# Design Document

## Overview

The Fun Mode Visual Effects feature adds an optional "fun mode" toggle that enables playful visual effects across the entire application. The primary effect is a DVD-style bouncing logo that appears after 60 seconds of user inactivity. The system is designed to be non-intrusive, performant, and easily toggled on/off by the user.

The feature integrates with the existing React application structure and leverages the current CRT effects system. The entire app will be wrapped with an overlay layer that renders the bouncing logo when appropriate conditions are met, allowing it to bounce across all sections of the interface.

## Architecture

### Component Structure

```
App.jsx (existing)
├── FunModeOverlay.jsx (new) - wraps entire app
│   ├── DVDBounce.jsx (new)
│   └── [All existing app content]
└── ModeToggle.jsx (new) - positioned in UI
```

### State Management

The feature will use React's built-in state management:

- **Mode State**: Stored in localStorage and managed at the App level
- **AFK State**: Managed within FunModeOverlay using activity detection
- **Animation State**: Managed within DVDBounce component using requestAnimationFrame

### Data Flow

1. User toggles mode → State updates → localStorage persists → UI reflects change
2. User goes AFK → Timer triggers → DVDBounce component mounts → Animation starts
3. User interacts → Activity detected → Timer resets → DVDBounce unmounts

## Components and Interfaces

### 1. ModeToggle Component

**Purpose**: Provides UI control for switching between Standard and Fun modes

**Props**:
```typescript
interface ModeToggleProps {
  isEnabled: boolean;
  onToggle: () => void;
}
```

**Location**: Positioned in the top-right quadrant near the stream info

**Styling**: 
- Matches existing UI aesthetic (Barlow Condensed font, purple theme)
- Button with visual indicator showing current mode
- Hover effects consistent with existing buttons

**Implementation Details**:
- Simple button component with icon/text
- Calls parent callback on click
- Visual state reflects current mode

### 2. FunModeOverlay Component

**Purpose**: Manages AFK detection and conditionally renders visual effects across the entire app

**Props**:
```typescript
interface FunModeOverlayProps {
  isEnabled: boolean;
  children: React.ReactNode;
}
```

**State**:
```typescript
interface FunModeOverlayState {
  isAFK: boolean;
  lastActivityTime: number;
}
```

**Activity Detection**:
- Listens to: `mousemove`, `mousedown`, `keydown`, `touchstart`, `wheel`
- Debounced to avoid excessive state updates (100ms)
- Timer checks every second if 60 seconds have elapsed
- Resets on any detected activity

**Implementation Details**:
- Wraps entire app content with relative positioning
- Renders DVDBounce as fixed positioned overlay when AFK (covers entire viewport)
- Overlay spans full screen (100vw x 100vh)
- Cleans up event listeners on unmount

### 3. DVDBounce Component

**Purpose**: Renders and animates the bouncing logo

**Props**:
```typescript
interface DVDBounceProps {
  logoSrc: string;
  containerRef: React.RefObject<HTMLElement>;
}
```

**State**:
```typescript
interface DVDBounceState {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  color: string;
}
```

**Animation Logic**:
- Uses `requestAnimationFrame` for smooth 60fps animation
- Speed: 100 pixels per second (calculated per frame)
- Boundary detection: Checks viewport dimensions (window.innerWidth/innerHeight)
- Direction reversal: Inverts velocity on edge collision
- Corner detection: Changes color when both x and y reverse simultaneously
- Color palette: Array of vibrant hues for variety

**Logo Specifications**:
- Size: 120px width, auto height (maintains aspect ratio)
- Source: Application logo from `/public` directory
- Color tinting: Applied via CSS filter (hue-rotate)
- Z-index: High value to appear above all content but allow click-through

**Implementation Details**:
- Fixed positioned div with logo image (covers entire viewport)
- Transform-based positioning for GPU acceleration
- Pointer-events: none (click-through to all UI elements)
- Bounces across entire screen including video player, TV guide, and info sections
- Cleanup: Cancels animation frame on unmount

## Data Models

### LocalStorage Schema

```typescript
interface FunModeSettings {
  enabled: boolean;
}

// Stored as: localStorage.getItem('funModeEnabled')
// Value: 'true' | 'false'
```

### Animation State

```typescript
interface AnimationState {
  x: number;           // Current x position in pixels
  y: number;           // Current y position in pixels
  vx: number;          // Velocity x (pixels per second)
  vy: number;          // Velocity y (pixels per second)
  color: string;       // Current color (hex or hsl)
  lastFrameTime: number; // Timestamp for delta calculation
}
```

## Integration Points

### 1. App.jsx Modifications

Add state management for fun mode:

```javascript
const [funModeEnabled, setFunModeEnabled] = useState(() => {
  return localStorage.getItem('funModeEnabled') === 'true'
})

const toggleFunMode = () => {
  const newValue = !funModeEnabled
  setFunModeEnabled(newValue)
  localStorage.setItem('funModeEnabled', String(newValue))
}
```

Wrap entire app return content:

```javascript
return (
  <FunModeOverlay isEnabled={funModeEnabled}>
    <div style={{ /* existing root div styles */ }}>
      {/* All existing app content */}
    </div>
  </FunModeOverlay>
)
```

Add toggle button in top-right quadrant (within the stream info section):

```javascript
<ModeToggle isEnabled={funModeEnabled} onToggle={toggleFunMode} />
```

### 2. TwitchPlayer.jsx Modifications

No modifications needed - component remains unchanged. The overlay wraps the entire app externally.

### 3. CSS Additions

New styles in App.css:

```css
.fun-mode-overlay {
  position: relative;
  width: 100%;
  height: 100%;
}

.dvd-bounce {
  position: absolute;
  pointer-events: none;
  z-index: 10;
  will-change: transform;
}

.mode-toggle {
  /* Styling to match existing UI */
}
```

## Error Handling

### Logo Loading Failure

**Scenario**: Logo image fails to load

**Handling**:
- Fallback to text-based bouncing element
- Display "VIBE" text with same animation
- Log error to console for debugging

### Performance Degradation

**Scenario**: Animation causes frame drops

**Handling**:
- Monitor frame time in animation loop
- If average frame time exceeds 20ms (< 50fps), reduce animation complexity
- Option to disable effects automatically if performance threshold exceeded

### LocalStorage Unavailable

**Scenario**: Browser blocks localStorage access

**Handling**:
- Gracefully degrade to session-only state
- Default to Standard Mode
- Show warning message to user

## Testing Strategy

### Unit Tests

1. **ModeToggle Component**
   - Renders with correct initial state
   - Calls callback on click
   - Updates visual indicator on prop change

2. **FunModeOverlay Component**
   - Detects user activity correctly
   - Triggers AFK state after 60 seconds
   - Resets timer on activity
   - Cleans up event listeners

3. **DVDBounce Component**
   - Initializes with random position/velocity
   - Bounces off edges correctly
   - Changes color on corner hits
   - Maintains 60fps animation

### Integration Tests

1. **Mode Toggle Flow**
   - Toggle persists to localStorage
   - State restores on page reload
   - Effects only appear when enabled

2. **AFK Detection Flow**
   - Logo appears after 60 seconds of inactivity
   - Logo disappears on user interaction
   - Timer resets correctly

3. **Animation Performance**
   - Maintains 60fps on target hardware
   - CPU usage stays below 5% overhead
   - No memory leaks during extended use

### Manual Testing

1. **Visual Verification**
   - Logo bounces smoothly
   - Colors change on corner hits
   - No visual glitches or artifacts

2. **Interaction Testing**
   - Video controls remain clickable
   - Toggle button works reliably
   - No interference with existing features

3. **Cross-browser Testing**
   - Chrome, Firefox, Safari, Edge
   - Desktop and mobile viewports
   - Different screen sizes and aspect ratios

## Performance Considerations

### Optimization Techniques

1. **GPU Acceleration**
   - Use CSS transforms for positioning
   - Apply `will-change: transform` hint
   - Avoid layout-triggering properties

2. **Efficient Event Handling**
   - Debounce activity detection
   - Use passive event listeners where possible
   - Single timer instead of multiple intervals

3. **Conditional Rendering**
   - Only mount DVDBounce when AFK
   - Unmount immediately on activity
   - No hidden elements consuming resources

4. **Animation Frame Management**
   - Cancel animation frame on unmount
   - Use delta time for consistent speed
   - Skip frames if performance degrades

### Performance Targets

- **CPU Usage**: < 5% overhead when active
- **Frame Rate**: Consistent 60fps
- **Memory**: < 10MB additional allocation
- **Load Time**: < 50ms to initialize

## Accessibility Considerations

1. **Motion Sensitivity**
   - Respect `prefers-reduced-motion` media query
   - Disable animations if user prefers reduced motion
   - Provide static alternative

2. **Keyboard Navigation**
   - Toggle button accessible via keyboard
   - Focus indicators visible
   - ARIA labels for screen readers

3. **Visual Clarity**
   - Logo doesn't obscure important content
   - Sufficient contrast for visibility
   - No flashing or strobing effects

## Future Enhancements

The design is structured to easily accommodate additional effects:

1. **Random Overlays** (hats, mustaches, etc.)
   - New component: `RandomOverlay.jsx`
   - Similar mounting logic to DVDBounce
   - Random position and rotation

2. **Enhanced CRT Effects**
   - Additional CSS filters and animations
   - Configurable intensity levels
   - Per-effect toggle controls

3. **Customization Options**
   - User-selectable logo
   - Adjustable AFK timeout
   - Speed and color preferences

## Implementation Notes

### Logo Asset

The bouncing logo should use the application's existing logo. Based on the codebase:
- Check for logo in `/public/images/` directory
- If not present, use the Vite logo from `/public/vite.svg` as fallback
- Ensure logo has transparent background for clean overlay

### Coordinate System

- Origin (0,0) is top-left of viewport
- X increases rightward, Y increases downward
- Boundaries determined by `window.innerWidth` and `window.innerHeight`
- Logo position represents top-left corner of logo element
- Bounces across entire screen including all quadrants and sections

### Color Palette

Suggested colors for corner hits (matching app theme):
```javascript
const colors = [
  '#674D82', // Purple (primary)
  '#E3E07D', // Yellow (accent)
  '#FF6B9D', // Pink
  '#4ECDC4', // Teal
  '#95E1D3', // Mint
  '#F38181', // Coral
]
```

### Z-Index Hierarchy

Current app z-index layers:
- Video player: z-index 100
- CRT overlays: z-index 1
- Header/UI: z-index 3-4

Fun mode layers:
- DVDBounce: z-index 9999 (above all content, but with pointer-events: none for click-through)
- ModeToggle: z-index 5 (with other UI controls)
