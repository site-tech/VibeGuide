# Vibe Guide

A modern, responsive React web application built with Vite, Tailwind CSS, and dark mode support. This single-page application is designed to integrate with the Twitch API and other services.

## Features

- ⚡ Built with Vite for lightning-fast development
- ⚛️ React 18 with modern hooks
- 🎨 Tailwind CSS for styling
- 🌓 Dark mode support with localStorage persistence
- 📱 Fully responsive and mobile-friendly
- 🎮 Ready for Twitch API integration
- 🚀 Single-page application (no routing needed)

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Add your Twitch API credentials to `.env`:
   - Get credentials from https://dev.twitch.tv/console/apps
   - Add your `VITE_TWITCH_CLIENT_ID` and `VITE_TWITCH_CLIENT_SECRET`

### Development

Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Project Structure

```
├── public/              # Static assets
├── src/
│   ├── components/      # React components
│   │   ├── Header.jsx   # Navigation with dark mode toggle
│   │   ├── Hero.jsx     # Hero section
│   │   ├── Content.jsx  # Main content area
│   │   └── Footer.jsx   # Footer section
│   ├── utils/
│   │   └── twitchApi.js # Twitch API utilities
│   ├── App.jsx          # Main app component
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles with Tailwind
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

## Twitch API Integration

The app includes utility functions for Twitch API integration in `src/utils/twitchApi.js`:

- `getTwitchToken()` - Get OAuth token
- `getTopStreams()` - Fetch top live streams
- `getTopGames()` - Fetch top games
- `searchChannels()` - Search for channels

## Customization

The app is ready for you to add your business logic and styling. Key areas to customize:

- Update components in `src/components/` with your content
- Modify Tailwind theme in `tailwind.config.js`
- Add API integrations in `src/utils/`
- Update colors, fonts, and spacing to match your brand

## Dark Mode

Dark mode is implemented using Tailwind's `dark:` variant and persists user preference in localStorage. Toggle is available in the header on both desktop and mobile.

## License

MIT
