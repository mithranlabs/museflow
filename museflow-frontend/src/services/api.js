import axios from 'axios'

// ==================== CONFIGURATION ====================
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 120000, // 2 minutes for AI generation
})

// ==================== API ENDPOINTS ====================

/**
 * Generate a complete song from user input (lyrics, composition, vocals, cover, title, production)
 * POST /api/muse/generate
 * 
 * @param {Object} input
 * @param {string} input.prompt - free text
 * @param {string} input.mood
 * @param {string} input.story
 * @param {string} input.genre
 * @param {string} input.memory - contextual memory string
 * @param {string} input.journalEntry
 * @param {string} input.emotion
 * @returns {Promise<Object>} { success, data: { songTitle, lyrics, compositionUrl, vocalsUrl, coverArtUrl, productionStyle } }
 */
export async function generateSong(input) {
  try {
    const response = await apiClient.post('/muse/generate', input)
    return { success: true, data: response.data }
  } catch (error) {
    console.error('Generate song error:', error)
    return { success: false, error: error.response?.data?.message || error.message }
  }
}

/**
 * Get all songs created by the user (for Playlist & My Songs)
 * GET /api/user/songs
 */
export async function getUserSongs() {
  try {
    const response = await apiClient.get('/user/songs')
    return { success: true, data: response.data }
  } catch (error) {
    console.error('Fetch songs error:', error)
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * Get status and details of all AI agents
 * GET /api/agents/status
 */
export async function getAgentsStatus() {
  try {
    const response = await apiClient.get('/agents/status')
    return { success: true, data: response.data }
  } catch (error) {
    console.error('Agents status error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get user profile + memory agent insights (favorite genres, instruments, patterns)
 * GET /api/user/profile
 */
export async function getUserProfile() {
  try {
    const response = await apiClient.get('/user/profile')
    return { success: true, data: response.data }
  } catch (error) {
    console.error('Profile error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update user settings
 * PUT /api/user/settings
 */
export async function updateSettings(settings) {
  try {
    const response = await apiClient.put('/user/settings', settings)
    return { success: true, data: response.data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Save a generated song to user's library (called after generation)
 * POST /api/user/songs/save
 */
export async function saveSong(songData) {
  try {
    const response = await apiClient.post('/user/songs/save', songData)
    return { success: true, data: response.data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}