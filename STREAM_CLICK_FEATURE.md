# Stream Click Feature

## Overview
Users can now click on any stream in the TV guide grid to update the featured stream preview.

## Implementation

### Click Handler
When a user clicks on a stream button:
1. The `handleStreamClick` function is called
2. It updates the `featuredStream` state with the clicked stream's data
3. The UI automatically updates to show the new stream

### Updated Elements
When a stream is clicked, the following elements update automatically:

**Top Left Quadrant:**
- Twitch iframe switches to the clicked stream
- Uses the stream's `user_login` to load the correct channel

**Top Right Quadrant:**
- **Category Name** - Shows the game/category of the clicked stream
- **Streamer Name** - Shows the display name of the clicked streamer
- **Channel Number** - Shows the category rank (1-50)

### Code Changes

#### Stream Button Enhancement
```javascript
// Get the stream for this block
const stream = streams && streams[block.streamIndex]

// Handle stream click
const handleStreamClick = () => {
  if (stream && category) {
    setFeaturedStream({
      ...stream,
      categoryName: category.name,
      categoryRank: categoryIndex + 1
    })
  }
}
```

#### Button Properties
- `onClick={handleStreamClick}` - Triggers the stream change
- `disabled={!stream}` - Disables button if no stream data
- `cursor: stream ? 'pointer' : 'default'` - Shows pointer only for valid streams
- `opacity: stream ? 1 : 0.6` - Dims buttons without streams

## User Experience

### Before Click
- Random stream is featured on page load
- Shows a stream from the loaded categories

### After Click
- Clicked stream immediately appears in the preview
- All details update to match the selected stream
- Iframe reloads with the new channel
- Stream starts playing automatically (muted)

### Visual Feedback
- Valid streams show pointer cursor on hover
- Invalid/empty slots show default cursor
- Empty slots are slightly dimmed (60% opacity)
- Hover effects still work on all buttons

## Technical Details

### State Management
- Uses React's `useState` for `featuredStream`
- State updates trigger automatic re-render
- Iframe key changes to force reload: `key={featuredStream.user_login}`

### Data Structure
Featured stream object includes:
```javascript
{
  ...stream,              // All Twitch stream data
  categoryName: string,   // Game/category name
  categoryRank: number    // Position in top 50 (1-50)
}
```

### Stream Data
Each stream includes:
- `user_login` - Twitch username (for iframe)
- `user_name` - Display name (for UI)
- `title` - Stream title
- `viewer_count` - Current viewers
- `thumbnail_url` - Stream thumbnail
- Plus other Twitch API fields

## Benefits

✅ **Interactive** - Users can explore different streams
✅ **Instant** - No page reload needed
✅ **Seamless** - Smooth transition between streams
✅ **Intuitive** - Click to watch, just like a real TV guide
✅ **Responsive** - Works with all screen sizes

## Auto-Rotation Feature

### Automatic Stream Rotation
- Featured stream automatically changes every **90 seconds**
- Picks a random stream from all loaded categories
- Ensures new stream is different from current one
- Starts automatically when page loads

### Manual Control
- **User clicks stream** → Auto-rotation stops
- User maintains full control after clicking
- Stream stays on selected channel until user clicks another

### Behavior
```
Page Load → Auto-rotation ON → Changes every 90s
     ↓
User Clicks Stream → Auto-rotation OFF → Stays on selected stream
```

### Implementation Details
- Uses `setInterval` with 90-second timer
- State: `isAutoRotating` (true by default)
- Ref: `streamRotationRef` for cleanup
- Cleans up timer on unmount or when disabled

## Future Enhancements

Potential improvements:
- Add visual indicator for currently featured stream
- Add button to re-enable auto-rotation
- Show stream title on hover
- Add viewer count to stream buttons
- Implement favorites/bookmarks
- Add stream history/recently watched
- Configurable rotation interval
