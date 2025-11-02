# VibeGuide Setup Guide

## Running the Application

### Backend (Go API)

The backend needs to be running to fetch Twitch data. You have two options:

#### Option 1: Using Docker Compose (Recommended)
```bash
make up
```

This will start all services including the backend API on port 8080.

#### Option 2: Using Docker directly
```bash
make brl
```

This will build and run the backend locally.

### Frontend (React + Vite)

In a separate terminal, run:

```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Environment Variables

Make sure your `.env` file has the following:

```env
# Backend API URL
VITE_API_URL=http://localhost:8080

# Twitch OAuth credentials
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
```

## Features

### Featured Stream (Top Section)

- **Top Left**: Live Twitch stream embed with autoplay
- **Top Right**: Stream details including:
  - Category name
  - Streamer username
  - Current day
  - Category rank (1-50)

A random stream is selected from all available streams across all categories on page load.

### Categories Display

The app fetches the top 50 Twitch categories from the backend and displays them in the left column of the TV guide grid. Each channel (CH 1-50) shows its corresponding category name.

### Streamers Display

For each category, the app fetches the top 20 live streamers and displays their usernames as "shows" in the grid. Each row represents a category, and the blocks in that row show the streamers currently live in that category.

### API Endpoints Used

- `GET /v1/twitch/categories?limit=50` - Fetches top 50 Twitch categories
- `GET /v1/twitch/streams?game_id={categoryId}&limit=20` - Fetches top 20 streams for a specific category

## Troubleshooting

### Categories not loading

1. Make sure the backend is running on port 8080
2. Check browser console for errors
3. Verify Twitch credentials are set in the backend's environment variables
4. Test the API directly: `curl http://localhost:8080/v1/twitch/categories?limit=50`

### CORS errors

The backend has CORS middleware configured to allow requests from the frontend. If you're still seeing CORS errors, make sure both services are running on the expected ports.
