// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

/**
 * Fetch top Twitch categories
 * @param {number} limit - Number of categories to fetch (default: 50, max: 100)
 * @returns {Promise<Array>} Array of category objects
 */
export async function getTopCategories(limit = 50) {
  try {
    console.log(`Fetching categories from: ${API_BASE_URL}/v1/twitch/categories?limit=${limit}`)
    const response = await fetch(`${API_BASE_URL}/v1/twitch/categories?limit=${limit}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error Response:', errorText)
      throw new Error(`Failed to fetch categories: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    console.log('Full API response:', data)
    console.log('Categories fetched successfully:', data.data?.data?.length || 0, 'categories')
    return data.data?.data || []
  } catch (error) {
    console.error('Error fetching categories:', error)
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
    console.error('Error fetching streams:', error)
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
    console.error(`Error fetching streams for category ${gameId}:`, error)
    return [] // Return empty array on error to avoid breaking the UI
  }
}
