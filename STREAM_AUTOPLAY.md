# Stream Autoplay Behavior

## Current Implementation

The featured stream in the top left quadrant uses Twitch's embedded player with the following configuration:

```javascript
<iframe
  src={`https://player.twitch.tv/?channel=${user_login}&parent=${hostname}&muted=true&autoplay=true`}
  allow="autoplay; fullscreen"
  allowFullScreen={true}
/>
```

## Autoplay Settings

- **Muted**: `true` - Stream starts with audio muted
- **Autoplay**: `true` - Stream attempts to play automatically
- **Allow**: `autoplay; fullscreen` - Requests browser permissions

## Browser Behavior

### Most Browsers (Chrome, Firefox, Safari, Edge)
- ✅ Stream autoplays successfully (muted)
- ✅ User can unmute using Twitch player controls
- ✅ Works reliably without user interaction

### Privacy-Focused Browsers (Brave, Firefox Strict Mode)
- ⚠️ May block autoplay depending on user settings
- ⚠️ Stream will not play automatically
- ✅ User can manually click play on the Twitch player
- ✅ This is expected and acceptable behavior

## Design Decision

We intentionally **do not** show any popups or prompts when autoplay is blocked. Here's why:

1. **User Choice**: If a user has configured their browser to block autoplay, they've made a conscious choice about their browsing experience
2. **Non-Intrusive**: No annoying overlays or prompts
3. **Simple UX**: The Twitch player has clear, built-in play controls
4. **Respects Privacy**: Honors user's browser security settings

## User Experience

### When Autoplay Works
1. Page loads
2. Stream starts playing (muted)
3. User can unmute if interested
4. Seamless experience

### When Autoplay is Blocked
1. Page loads
2. Stream shows paused state
3. User sees Twitch player with play button
4. User can click play if they want to watch
5. No popups or interruptions

## For Brave Users

If Brave users want autoplay to work, they can adjust their settings:

1. Click the Brave Shield icon (lion) in the address bar
2. Click "Advanced View"
3. Find "Auto-play media" setting
4. Change from "Block" to "Allow"
5. Refresh the page

**Note**: We don't prompt users to do this - it's their choice.

## Technical Details

### Why Start Muted?
Modern browsers require videos to be muted for autoplay to work. This is a web standard to prevent annoying auto-playing ads with sound.

### Why No Detection?
- No reliable way to detect if autoplay was blocked
- Cross-origin iframe prevents access to player state
- Time-based detection would be unreliable
- Adds unnecessary complexity

### Why No Prompts?
- Respects user's browser settings
- Avoids annoying UX patterns
- Twitch player already has clear controls
- Keeps the interface clean

## Best Practices

This implementation follows web best practices:
- ✅ Attempts autoplay with muted audio
- ✅ Provides proper iframe attributes
- ✅ Respects browser autoplay policies
- ✅ Doesn't force unwanted behavior
- ✅ Maintains clean, simple UX

## Summary

The stream will autoplay (muted) in most browsers. If a user's browser blocks it, that's perfectly fine - they can use the Twitch player's built-in controls to play manually. No popups, no prompts, no hassle.
