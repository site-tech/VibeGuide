# Implementation Plan

- [ ] 1. Create DVDBounce component with animation logic
  - Create `src/components/DVDBounce.jsx` with bouncing logo animation
  - Implement requestAnimationFrame-based animation loop at 100 pixels/second
  - Add boundary detection using window.innerWidth and window.innerHeight
  - Implement direction reversal on edge collision
  - Add corner detection logic that changes color when both x and y directions reverse
  - Use fixed positioning with high z-index (9999) and pointer-events: none
  - Apply CSS transforms for GPU-accelerated positioning
  - Use color array: ['#674D82', '#E3E07D', '#FF6B9D', '#4ECDC4', '#95E1D3', '#F38181']
  - Set logo size to 120px width with auto height
  - Clean up animation frame on component unmount
  - _Requirements: 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 5.1, 5.4_

- [ ] 2. Create FunModeOverlay component with AFK detection
  - Create `src/components/FunModeOverlay.jsx` that wraps children
  - Implement activity detection for mousemove, mousedown, keydown, touchstart, and wheel events
  - Add debounced activity handler (100ms) to avoid excessive state updates
  - Create timer that checks every second if 60 seconds have elapsed since last activity
  - Set isAFK state to true after 60 seconds of inactivity
  - Reset isAFK and timer on any detected activity
  - Conditionally render DVDBounce component only when isAFK is true and isEnabled prop is true
  - Clean up event listeners and timers on component unmount
  - _Requirements: 2.1, 2.5, 2.6, 4.1, 4.2, 4.3, 4.4_

- [ ] 3. Create ModeToggle component
  - Create `src/components/ModeToggle.jsx` as a button component
  - Accept isEnabled and onToggle props
  - Style to match existing UI (Barlow Condensed font, purple theme colors)
  - Add visual indicator showing current mode (e.g., "Fun Mode" vs "Standard Mode")
  - Apply hover effects consistent with existing buttons (background color transition)
  - Use existing button styling patterns from App.jsx (3D border effect)
  - Make keyboard accessible with proper focus indicators
  - _Requirements: 1.1, 1.2, 1.5_

- [ ] 4. Integrate fun mode into App.jsx
  - Add funModeEnabled state using useState with localStorage initialization
  - Create toggleFunMode function that updates state and persists to localStorage
  - Wrap entire app return content with FunModeOverlay component
  - Pass isEnabled prop to FunModeOverlay
  - Add ModeToggle component in the top-right quadrant (stream info section)
  - Position toggle button near the stream info text
  - Pass funModeEnabled and toggleFunMode to ModeToggle
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 5. Add CSS styles for fun mode components
  - Add .dvd-bounce class in App.css with fixed positioning and will-change: transform
  - Add .mode-toggle class with styling matching existing UI buttons
  - Ensure pointer-events: none on bouncing logo
  - Add transition effects for smooth mode toggle
  - _Requirements: 3.3, 5.1, 5.4_

- [ ] 6. Add logo asset and fallback handling
  - Check for existing logo in /public/images/ directory
  - If no logo exists, use /public/vite.svg as fallback
  - Implement error handling in DVDBounce for failed logo loads
  - Add fallback to text-based element ("VIBE") if image fails
  - Ensure logo has appropriate size and transparent background
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 7. Implement performance optimizations
  - Use CSS transform instead of top/left for positioning
  - Add will-change: transform hint to DVDBounce
  - Implement delta time calculation for consistent animation speed
  - Use passive event listeners where appropriate in FunModeOverlay
  - Ensure animation frame is cancelled when component unmounts
  - _Requirements: 5.2, 5.3, 5.4_

- [ ]* 8. Add accessibility features
  - Implement prefers-reduced-motion media query check
  - Disable animations if user prefers reduced motion
  - Add ARIA labels to ModeToggle button
  - Ensure keyboard navigation works for toggle button
  - Add focus indicators to toggle button
  - _Requirements: 1.1, 1.2_
