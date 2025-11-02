# VibeGuide - Current Features

## Live TV Guide for Twitch Streams

### 🎬 Featured Stream Section (Top Half)

#### Left Side - Live Stream Player
- Embedded Twitch player with autoplay
- Audio enabled by default
- Fullscreen capable
- Randomly selected from all available streams

#### Right Side - Stream Information
Displays real-time data for the featured stream:
- **Category Name** - e.g., "Just Chatting", "Fortnite", "League of Legends"
- **Streamer Username** - The broadcaster's display name
- **Current Day** - e.g., "Saturday"
- **Category Rank** - Position in top 50 (e.g., "Channel #1")

### 📺 TV Guide Grid (Bottom Half)

#### Left Column - Categories
- Shows top 50 Twitch categories
- Each row = 1 category
- Displays category name below channel number
- Format: "CH 1" / "Just Chatting"

#### Main Grid - Live Streamers
- Each row shows up to 20 live streamers for that category
- Blocks display streamer usernames
- Variable width blocks (1, 1.5, or 2 cells)
- Scrollable horizontally and vertically
- Auto-scroll feature (pauses on user interaction)

#### Header Row
- Current time display (updates every second)
- Filter buttons (placeholder)
- RSS feed ticker (placeholder)
- Login button (placeholder)

### 🔄 Data Flow

1. **Page Load**
   - Fetch top 50 Twitch categories
   
2. **Categories Loaded**
   - Fetch top 20 streams for each category (50 parallel requests)
   
3. **Streams Loaded**
   - Select random stream from all available streams
   - Display in featured section
   - Populate grid with streamer names

### 🎨 Visual Design

- **Color Scheme**: Purple gradient (#674D82) with dark background (#1B0731)
- **Typography**: Futura Bold Condensed with text shadows
- **3D Borders**: Light borders on top/left, dark on bottom/right
- **Hover Effects**: Buttons change color on hover
- **Blur Effect**: Subtle blur (0.04vw) for retro TV aesthetic

### 📊 Data Sources

All data comes from Twitch API via the backend:
- **Categories**: Top games/categories by viewer count
- **Streams**: Live streams filtered by category, sorted by viewers
- **Stream Details**: Username, title, viewer count, etc.

### 🎯 Current Limitations

- Featured stream is random on page load (no manual selection yet)
- No click handlers on grid items
- Filter and RSS buttons are placeholders
- No stream refresh mechanism (requires page reload)
- No error recovery UI (just console logs)

### 🚀 Technical Stack

- **Frontend**: React + Vite
- **Backend**: Go (Chi router)
- **API**: Twitch Helix API
- **Embed**: Twitch Player iframe
- **Styling**: Inline styles (no CSS framework)

### 📱 Responsive Design

- Uses viewport units (vw, vh) for sizing
- clamp() for responsive font sizes
- Maintains 50/50 split between top and bottom sections
- Grid scrolls independently from header

### ⚡ Performance

- Parallel API requests for all categories
- Single page application (no routing)
- Minimal re-renders (useState, useEffect)
- Efficient scroll handling with refs
- Auto-scroll with configurable timing

---

**Last Updated**: November 1, 2025
**Version**: 0.1.0
