// Twitch API utility functions
// You'll need to set up your Twitch API credentials

const TWITCH_CLIENT_ID = import.meta.env.VITE_TWITCH_CLIENT_ID || ''
const TWITCH_CLIENT_SECRET = import.meta.env.VITE_TWITCH_CLIENT_SECRET || ''

let accessToken = null

// Get OAuth token
export const getTwitchToken = async () => {
  if (accessToken) return accessToken

  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials',
      }),
    })

    const data = await response.json()
    accessToken = data.access_token
    return accessToken
  } catch (error) {
    console.error('Error getting Twitch token:', error)
    throw error
  }
}

// Fetch top streams
export const getTopStreams = async (limit = 20) => {
  try {
    const token = await getTwitchToken()
    
    const response = await fetch(
      `https://api.twitch.tv/helix/streams?first=${limit}`,
      {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`,
        },
      }
    )

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error('Error fetching top streams:', error)
    throw error
  }
}

// Fetch games
export const getTopGames = async (limit = 20) => {
  try {
    const token = await getTwitchToken()
    
    const response = await fetch(
      `https://api.twitch.tv/helix/games/top?first=${limit}`,
      {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`,
        },
      }
    )

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error('Error fetching top games:', error)
    throw error
  }
}

// Search channels
export const searchChannels = async (query) => {
  try {
    const token = await getTwitchToken()
    
    const response = await fetch(
      `https://api.twitch.tv/helix/search/channels?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`,
        },
      }
    )

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error('Error searching channels:', error)
    throw error
  }
}

// Backend OAuth functions
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const getTwitchAuthURL = async (redirectUri, state) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/v1/auth/twitch/url?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
    )

    if (!response.ok) {
      throw new Error(`Failed to get auth URL: ${response.status}`)
    }

    const data = await response.json()
    return data.data.auth_url
  } catch (error) {
    console.error('Error getting Twitch auth URL:', error)
    throw error
  }
}

export const exchangeTwitchCode = async (code, redirectUri, state) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/v1/auth/twitch/callback?code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
      { method: 'POST' }
    )

    if (!response.ok) {
      throw new Error(`Failed to exchange code: ${response.status}`)
    }

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error('Error exchanging Twitch code:', error)
    throw error
  }
}

export const validateTwitchToken = async (accessToken) => {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/twitch/validate`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to validate token: ${response.status}`)
    }

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error('Error validating Twitch token:', error)
    throw error
  }
}
