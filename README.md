# VibeGuide - Twitch TV Guide

A modern Twitch TV Guide application with OAuth authentication. Built with Go backend and React frontend.

## Features

- 🔐 **Twitch OAuth Authentication** - Sign in with Twitch
- 👤 **User Profiles** - Display user avatar and info
- 🎮 **Twitch API Integration** - Fetch streams and games
- ⚡ **Fast Development** - Vite + Go for quick iteration
- 🎨 **Modern UI** - Tailwind CSS with responsive design
- 🌓 **Dark Mode** - Built-in dark mode support
- 🔒 **Secure** - CSRF protection and token validation

## Quick Start

### Prerequisites

- Go 1.21+
- Node.js 18+
- Twitch Developer Account

### Setup

1. **Configure Twitch App**
   - Go to https://dev.twitch.tv/console/apps
   - Add redirect URI: `http://localhost:5173/`
   - Get Client ID and Secret

2. **Backend Setup**
   ```bash
   # Create .env
   cp .env.example .env
   
   # Add credentials
   TWITCH_CLIENT_ID=your_client_id
   TWITCH_CLIENT_SECRET=your_client_secret
   ```

3. **Frontend Setup**
   ```bash
   # Install dependencies
   npm install
   
   # Create .env
   echo "VITE_API_URL=http://localhost:8080" > .env
   ```

4. **Start Services**
   ```bash
   # Terminal 1 - Backend
   go run ./cmd/vibeguide
   
   # Terminal 2 - Frontend
   npm run dev
   ```

5. **Open Browser**
   - Navigate to http://localhost:5173
   - Click "Sign in with Twitch"
   - Authorize and enjoy!

📖 **Full setup guide**: [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md)

## Project Structure

```
VibeGuide/
├── cmd/vibeguide/          # Backend (Go)
│   ├── main.go            # Server, routing, CORS
│   ├── auth.go            # OAuth handlers
│   └── twitch_handlers.go # Twitch API handlers
├── pkg/twitch/            # Twitch client library
│   ├── client.go          # API client
│   ├── oauth.go           # OAuth manager
│   └── types.go           # Type definitions
├── src/                   # Frontend (React)
│   ├── components/
│   │   ├── Header.jsx            # Header with login button
│   │   ├── TwitchLoginButton.jsx # OAuth login component
│   │   └── ...
│   ├── utils/
│   │   └── twitchApi.js   # API utilities
│   └── App.jsx            # Main app
├── docs/                  # Documentation
│   ├── LOCAL_SETUP.md     # Setup guide
│   └── TROUBLESHOOTING.md # Common issues
├── .env.example           # Environment template
├── go.mod                 # Go dependencies
└── package.json           # Node dependencies
```

## Authentication

### Twitch OAuth Flow

1. User clicks "Sign in with Twitch"
2. Redirects to Twitch authorization
3. User authorizes the app
4. Redirects back with auth code
5. Backend exchanges code for token
6. User profile displayed in header

### API Endpoints

- `GET /v1/auth/twitch/url` - Get authorization URL
- `POST /v1/auth/twitch/callback` - Exchange code for token
- `GET /v1/auth/twitch/validate` - Validate token

## Development

### Backend (Go)
```bash
# Run
go run ./cmd/vibeguide

# Build
go build -o vibeguide ./cmd/vibeguide

# Test
curl http://localhost:8080/ping
```

### Frontend (React)
```bash
# Run
npm run dev

# Build
npm run build

# Preview
npm run preview
```

## Configuration

### Backend (.env)
```bash
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
PORT=8080
```

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:8080
```

## Troubleshooting

Common issues and solutions:

- **CORS errors**: Make sure backend is running
- **redirect_mismatch**: Check Twitch has `http://localhost:5173/`
- **Port in use**: Use `lsof -i :8080` to find and kill process

📖 **Full troubleshooting guide**: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

## Documentation

- 📖 [Local Setup Guide](docs/LOCAL_SETUP.md) - Complete setup instructions
- 🔧 [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and fixes
- 📚 [Documentation Index](docs/README.md) - All documentation

## Tech Stack

**Backend:**
- Go 1.21+
- chi router
- Twitch OAuth 2.0

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- Twitch API

## Features in Detail

### 🔐 Authentication
- Secure OAuth 2.0 flow
- CSRF protection
- Token validation
- User profile display

### 🎨 UI Components
- Responsive header with login button
- User profile dropdown
- Dark mode support
- Mobile-friendly design

### 🔒 Security
- CORS configured
- State parameter validation
- Secure token storage
- Error handling

## Testing

```bash
# Test backend
curl http://localhost:8080/ping

# Test auth endpoint
curl "http://localhost:8080/v1/auth/twitch/url?redirect_uri=http://localhost:5173/&state=test"

# Debug in browser
window.debugOAuth()
```

## License

MIT
