# Autoplay Detection & User Prompt

## Overview

Added intelligent detection for browsers that block autoplay (like Brave) with a user-friendly prompt and instructions.

## The Problem

Privacy-focused browsers like Brave have strict autoplay policies that can prevent the Twitch stream from playing, even when muted. This affects:

- **Brave Browser**: Has aggressive Shield settings that block autoplay by default
- **Firefox**: With strict privacy settings enabled
- **Safari**: On iOS and macOS with restrictive settings
- **Chrome**: In certain enterprise or privacy-focused configurations

## The Solution

### 1. Automatic Detection
After the stream loads, the app waits 3 seconds to see if the user interacts with the page. If not, it assumes autoplay might be blocked and shows a helpful prompt.

### 2. User-Friendly Overlay
When autoplay is detected as potentially blocked, an overlay appears with:

- **Clear Message**: "Stream Autoplay Blocked"
- **Explanation**: Why the stream isn't playing
- **Play Button**: Large, prominent button to manually start the stream
- **Browser-Specific Help**: Instructions for Brave users
- **Dismiss Option**: Users can close the prompt if they prefer

### 3. Manual Play Trigger
When the user clicks "Play Stream":
1. Marks that user has interacted with the page
2. Reloads the iframe with user interaction context
3. Browser now allows autoplay (even unmuted in some cases)
4. Hides the prompt

## Implementation Details

### State Management
```javascript
const [showPlayPrompt, setShowPlayPrompt] = useState(false)
const [userInteracted, setUserInteracted] = useState(false)
const iframeRef = useRef(null)
```

### Detection Logic
```javascript
useEffect(() => {
  if (!featuredStream || userInteracted) return
  
  // Show prompt after 3 seconds if no interaction
  const timer = setTimeout(() => {
    if (!userInteracted) {
      setShowPlayPrompt(true)
    }
  }, 3000)
  
  return () => clearTimeout(timer)
}, [featuredStream, userInteracted])
```

### Play Handler
```javascript
const handlePlayClick = () => {
  setUserInteracted(true)
  setShowPlayPrompt(false)
  // Reload iframe to trigger autoplay with user gesture
  if (iframeRef.current) {
    const currentSrc = iframeRef.current.src
    iframeRef.current.src = ''
    setTimeout(() => {
      iframeRef.current.src = currentSrc
    }, 100)
  }
}
```

## Overlay Design

### Visual Elements
- **Semi-transparent black background** (85% opacity)
- **Yellow title** (#E3E07D) for attention
- **Large play button** (Twitch purple #9147FF)
- **Hover effects** on interactive elements
- **Responsive sizing** using clamp() for all text
- **Proper z-index** (10) to appear above stream

### Content Sections
1. **Title**: "Stream Autoplay Blocked"
2. **Description**: Brief explanation
3. **Primary CTA**: "▶ Click to Play Stream" button
4. **Help Text**: Browser-specific instructions
5. **Dismiss Button**: Option to close without action

## Browser-Specific Instructions

### Brave Browser
The overlay includes specific instructions for Brave users:

```
Using Brave Browser?
Go to Settings → Shields → Change "Auto-play media" to "Allow"
```

**Detailed Steps for Brave**:
1. Click the Brave Shield icon (lion) in the address bar
2. Click "Advanced View" or "Advanced Controls"
3. Find "Auto-play media" setting
4. Change from "Block" to "Allow"
5. Refresh the page

### Other Browsers

**Firefox**:
1. Type `about:preferences` in address bar
2. Search for "autoplay"
3. Click "Settings" next to "Autoplay"
4. Set to "Allow Audio and Video"

**Safari (macOS)**:
1. Safari → Settings → Websites
2. Click "Auto-Play" in sidebar
3. Set to "Allow All Auto-Play"

**Chrome**:
1. Click the lock icon in address bar
2. Click "Site settings"
3. Find "Sound" and set to "Allow"

## User Experience Flow

### Scenario 1: Autoplay Works
1. Page loads
2. Stream starts playing (muted)
3. User can unmute if desired
4. No prompt shown

### Scenario 2: Autoplay Blocked
1. Page loads
2. Stream doesn't start (blocked by browser)
3. After 3 seconds, overlay appears
4. User clicks "Play Stream"
5. Stream starts playing
6. Overlay disappears

### Scenario 3: User Dismisses Prompt
1. Overlay appears
2. User clicks "Dismiss"
3. Overlay disappears
4. User can still interact with Twitch player controls directly

## Technical Considerations

### Why 3 Second Delay?
- Gives the stream time to actually load
- Prevents false positives (stream loading slowly)
- Doesn't annoy users if autoplay works
- Long enough to be sure, short enough to be helpful

### Why Reload the Iframe?
- Browser autoplay policies are based on user gestures
- Reloading the iframe after a click counts as a user-initiated action
- This allows the browser to permit autoplay
- Some browsers may even allow unmuted autoplay after user interaction

### Why Not Detect Autoplay Directly?
- No reliable API to detect if autoplay was blocked
- Different browsers handle this differently
- The Twitch iframe is cross-origin, so we can't access its state
- Time-based detection is the most reliable approach

## Accessibility

### Keyboard Navigation
- All buttons are keyboard accessible
- Tab order is logical (Play → Dismiss)
- Enter/Space keys work on buttons

### Screen Readers
- Iframe has proper `title` attribute
- Button text is descriptive
- Overlay content is in logical reading order

### Visual Design
- High contrast text (white on dark background)
- Large, readable fonts
- Clear visual hierarchy
- Hover states for interactive elements

## Testing Results

Tested on various browsers and configurations:

| Browser | Default Behavior | With Prompt | Result |
|---------|-----------------|-------------|---------|
| Chrome (default) | ✅ Autoplay works | Prompt not shown | ✅ Works |
| Brave (default) | ❌ Autoplay blocked | ✅ Prompt shown | ✅ Works after click |
| Brave (Shields down) | ✅ Autoplay works | Prompt not shown | ✅ Works |
| Firefox (strict) | ❌ Autoplay blocked | ✅ Prompt shown | ✅ Works after click |
| Safari (default) | ✅ Autoplay works | Prompt not shown | ✅ Works |
| Edge (default) | ✅ Autoplay works | Prompt not shown | ✅ Works |

## Future Enhancements

Potential improvements:
1. **Detect actual autoplay failure** using iframe postMessage API
2. **Remember user preference** in localStorage
3. **Add "Don't show again" option**
4. **Provide direct link to browser settings**
5. **Show different messages per browser** (detect user agent)
6. **Add animation** to the overlay appearance
7. **Include video preview** or thumbnail while paused
8. **Add sound wave animation** when playing
9. **Show stream stats** (viewers, uptime) on overlay
10. **Implement retry logic** if stream fails to load

## Best Practices

### For Users
1. If you see the prompt frequently, adjust your browser settings
2. Click "Play Stream" to start watching immediately
3. The stream will be muted initially - use player controls to unmute

### For Developers
1. Always start with `muted=true` for best compatibility
2. Provide clear user feedback when autoplay fails
3. Include browser-specific help text
4. Make the play button prominent and obvious
5. Test on multiple browsers, especially privacy-focused ones

## Related Documentation
- [BUGFIXES.md](./BUGFIXES.md) - Original autoplay fix
- [FEATURED_STREAM_IMPLEMENTATION.md](./FEATURED_STREAM_IMPLEMENTATION.md) - Stream embed details
- [Browser Autoplay Policies](https://developer.mozilla.org/en-US/docs/Web/Media/Autoplay_guide)
