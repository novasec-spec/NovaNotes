import { apiClient } from './api'

export const premiumService = {
  /**
   * Subscribe to premium plan
   */
  async subscribe(plan, phoneNumber) {
    const response = await apiClient.post('/premium/pay', {
      plan,
      phoneNumber,
    })
    return response
  },

  /**
   * Check payment status
   */
  async checkPaymentStatus(transactionId) {
   const response = await apiClient.get(`/premium/status/${transactionId}`)
    return response
  },

  /**
   * Check current premium status
   */
  async checkPremiumStatus() {
    const response = await apiClient.get('/premium/check')
    return response
  },

  /**
   * Restore purchase
   */
  async restorePurchase() {
    const response = await apiClient.post('/premium/restore')
    return response
  },
}
