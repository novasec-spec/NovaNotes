// services/api.js
import { supabase } from '../config/supabase'

const API_URL = 'https://amendable-applaud-stank.ngrok-free.dev'

export const apiClient = {
  async request(endpoint, options = {}) {
    try {
      // Get session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('❌ Session error:', sessionError)
        throw new Error('Authentication error')
      }

      const token = session?.access_token

      // Don't make requests if no token (for protected endpoints)
      const requiresAuth = options.requiresAuth !== false
      
      if (requiresAuth && !token) {
        console.warn('⚠️ No auth token - user not logged in')
        throw new Error('Please sign in to access this feature')
      }

      const fullEndpoint = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`
      const url = `${API_URL}${fullEndpoint}`

      console.log(`📡 ${options.method || 'GET'} ${url}`)

      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      })

      console.log(`📡 Response status: ${response.status}`)

      // Handle 401 specifically
      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}))
        console.error('🔒 Auth error:', errorData)
        throw new Error(errorData.error || 'Authentication failed. Please sign in again.')
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('❌ Non-JSON response:', text.substring(0, 200))
        throw new Error(`Server returned ${response.status}. Please check backend.`)
      }

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Request failed')
      }
      
      return data
    } catch (error) {
      console.error('❌ API Error:', error.message)
      throw error
    }
  },

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' })
  },

  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
}
