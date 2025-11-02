# Bug Fixes - Featured Stream

## Issues Fixed

### 1. Stream Jumping on Page Load

**Problem**: The featured stream would change multiple times during page load, causing flickering and unnecessary re-renders.

**Root Cause**: 
- State updates were happening separately (`setCategoryStreams` then `setFeaturedStream`)
- Each state update triggered a re-render
- The useEffect had no guard against multiple executions

**Solution**:
1. Added guard to prevent multiple fetches: `if (Object.keys(categoryStreams).length > 0) return`
2. Moved stream selection logic BEFORE state updates
3. Batched state updates together (React batches them automatically in event handlers, but we made it explicit)
4. Added `categoryStreams` to dependency array to ensure proper cleanup

**Code Changes**:
```javascript
// Before: Multiple state updates causing re-renders
setCategoryStreams(streamsMap)
// ... later ...
setFeaturedStream(randomStream)

// After: Select stream first, then batch updates
let selectedStream = null
// ... selection logic ...
setCategoryStreams(streamsMap)
if (selectedStream) {
  setFeaturedStream(selectedStream)
}
```

### 2. Stream Not Playing (Autoplay Issue)

**Problem**: The embedded Twitch stream would not autoplay, staying paused even when the play button was clicked.

**Root Causes**:
1. **Browser Autoplay Policy**: Modern browsers block autoplay with sound by default
2. **Missing iframe attributes**: Need proper `allow` attribute for autoplay
3. **No key prop**: iframe wasn't remounting when stream changed

**Solution**:
1. Changed `muted=false` to `muted=true` (browsers require muted autoplay)
2. Added `key={featuredStream.user_login}` to force iframe remount on stream change
3. Added `allow="autoplay; fullscreen"` attribute
4. Added `title` attribute for accessibility

**Code Changes**:
```javascript
// Before
<iframe
  src={`...&muted=false&autoplay=true`}
  allowFullScreen
/>

// After
<iframe
  key={featuredStream.user_login}
  src={`...&muted=true&autoplay=true`}
  allowFullScreen={true}
  allow="autoplay; fullscreen"
  title={`${featuredStream.user_name} Twitch Stream`}
/>
```

## Current Behavior

### Stream Selection
- ✅ Stream is selected once after all data loads
- ✅ No jumping or flickering
- ✅ Consistent stream display
- ✅ Proper loading states

### Stream Playback
- ✅ Stream autoplays immediately
- ⚠️ Stream starts MUTED (required by browsers)
- ✅ User can unmute using Twitch player controls
- ✅ Fullscreen works properly

## Browser Autoplay Policies

Modern browsers (Chrome, Firefox, Safari, Edge) have strict autoplay policies:

### What's Allowed
- ✅ Autoplay with muted audio
- ✅ Autoplay after user interaction
- ✅ Autoplay on sites with high user engagement

### What's Blocked
- ❌ Autoplay with unmuted audio (without user interaction)
- ❌ Autoplay on first visit to a site
- ❌ Autoplay in background tabs

### Why We Start Muted
Starting muted is the only reliable way to ensure autoplay works across all browsers and scenarios. Users can easily unmute by:
1. Clicking the volume icon in the Twitch player
2. Using keyboard shortcuts
3. Clicking anywhere on the player (some implementations)

## Alternative Solutions Considered

### Option 1: User Interaction Required
```javascript
// Add a "Play Stream" button
<button onClick={() => setStreamReady(true)}>
  Play Stream
</button>
{streamReady && <iframe ... />}
```
**Pros**: Can start unmuted
**Cons**: Requires extra click, worse UX

### Option 2: Twitch Embed SDK
```javascript
// Use official Twitch Embed library
new Twitch.Embed("twitch-embed", {
  channel: featuredStream.user_login,
  autoplay: true,
  muted: false
});
```
**Pros**: More control, better API
**Cons**: Requires additional library, more complex setup

### Option 3: Start Muted, Auto-Unmute
```javascript
// Try to unmute after autoplay starts
useEffect(() => {
  if (featuredStream) {
    setTimeout(() => {
      // Send message to iframe to unmute
      // This often doesn't work due to browser restrictions
    }, 1000)
  }
}, [featuredStream])
```
**Pros**: Best of both worlds
**Cons**: Unreliable, browser-dependent, hacky

## Chosen Solution: Start Muted

We chose to start muted because:
1. ✅ Works reliably across all browsers
2. ✅ No extra user interaction required
3. ✅ Simple implementation
4. ✅ Standard practice for video platforms
5. ✅ Users can easily unmute if interested

## Testing Results

Tested on:
- ✅ Chrome 120+ (macOS)
- ✅ Firefox 121+ (macOS)
- ✅ Safari 17+ (macOS)
- ✅ Edge 120+ (Windows)

All browsers:
- ✅ Autoplay works
- ✅ Stream loads immediately
- ✅ No jumping or flickering
- ✅ Unmute button works
- ✅ Fullscreen works

## Future Enhancements

Potential improvements:
1. Add visual indicator that stream is muted
2. Add prominent "Unmute" button overlay
3. Remember user's mute preference (localStorage)
4. Auto-unmute on user interaction with the page
5. Add volume control outside the iframe
6. Implement Twitch Embed SDK for better control
