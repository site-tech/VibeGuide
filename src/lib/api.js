// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

import { supabase } from './supabase'

/**
 * Fetch top Twitch categories
 * @param {number} limit - Number of categories to fetch (default: 50, max: 100)
 * @returns {Promise<Array>} Array of category objects
 */
export async function getTopCategories(limit = 50) {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/twitch/categories?limit=${limit}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch categories: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.data?.data || []
  } catch (error) {
    throw error
  }
}

/**
 * Fetch top Twitch streams
 * @param {number} count - Number of streams to fetch
 * @returns {Promise<Array>} Array of stream objects
 */
export async function getTopStreams(count = 100) {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/twitch/streams/top?count=${count}`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch streams: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.data?.data || []
  } catch (error) {
    throw error
  }
}

/**
 * Fetch streams for a specific game/category
 * @param {string} gameId - The Twitch game/category ID
 * @param {number} limit - Number of streams to fetch (default: 20)
 * @returns {Promise<Array>} Array of stream objects
 */
export async function getStreamsByCategory(gameId, limit = 20) {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/twitch/streams?game_id=${gameId}&limit=${limit}`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch streams for category ${gameId}: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.data?.data || []
  } catch (error) {
    return [] // Return empty array on error to avoid breaking the UI
  }
}

/**
 * Fetch current authenticated user's Twitch profile
 * @returns {Promise<Object>} User profile object with id, login, display_name, etc.
 */
export async function getCurrentUser() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }
    
    // For direct Twitch API calls, we need the provider token
    const twitchToken = session.provider_token
    if (!twitchToken) {
      throw new Error('No Twitch access token found in session')
    }
    
    const response = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${twitchToken}`,
        'Client-Id': import.meta.env.VITE_TWITCH_CLIENT_ID || 'scu48w0dp5jzgnctaqq01dpfwdxhxg'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch user profile: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    const user = data.data?.[0]
    if (!user) {
      throw new Error('No user data returned from Twitch API')
    }
    
    return user
  } catch (error) {
    throw error
  }
}

/**
 * Fetch channels that the authenticated user follows
 * @returns {Promise<Array>} Array of follow objects
 */
export async function getUserFollows() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }
    
    // Backend-only approach with provider token fallback
    const supabaseToken = session.access_token
    const twitchToken = session.provider_token
    
    if (!supabaseToken) {
      throw new Error('No Supabase access token found in session')
    }
    
    const headers = {
      'Authorization': `Bearer ${supabaseToken}`,
      'Content-Type': 'application/json'
    }
    
    // Add Twitch provider token as fallback if available
    if (twitchToken) {
      headers['X-Twitch-Token'] = twitchToken
    }
    
    const response = await fetch(`${API_BASE_URL}/v1/twitch/follows`, {
      headers
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch follows from backend: ${response.status} ${response.statusText} - ${errorText}`)
    }
    
    const data = await response.json()
    return data.data?.follows || []
  } catch (error) {
    throw error
  }
}

// Twitch OAuth is handled by Supabase - no custom API calls needed
