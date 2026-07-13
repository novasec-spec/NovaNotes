import { apiClient } from './api'
import AsyncStorage from '@react-native-async-storage/async-storage'

const CACHE_KEY = '@premium_status'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export const premiumService = {
  async subscribe(plan, phoneNumber) {
    const response = await apiClient.post('/premium-pay', {
      plan,
      phoneNumber,
    })
    return response
  },

  async checkPremiumStatus(useCache = true) {
    try {
      // Check cache first
      if (useCache) {
        const cached = await AsyncStorage.getItem(CACHE_KEY)
        if (cached) {
          const data = JSON.parse(cached)
          if (Date.now() - data.timestamp < CACHE_DURATION) {
            return data.status
          }
        }
      }

      // Fetch fresh from Edge Function
      const status = await apiClient.get('/premium-check')
      
      // Cache the result
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        status,
        timestamp: Date.now()
      }))
      
      return status
    } catch (error) {
      console.error('Premium check error:', error)
      
      // Return cached even if expired
      const cached = await AsyncStorage.getItem(CACHE_KEY)
      if (cached) {
        return JSON.parse(cached).status
      }
      
      throw error
    }
  },

  async restorePurchase() {
    const status = await apiClient.post('/premium-restore')
    
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
      status,
      timestamp: Date.now()
    }))
    
    return status
  },

  async clearCache() {
    await AsyncStorage.removeItem(CACHE_KEY)
  }
}
