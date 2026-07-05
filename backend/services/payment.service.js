import { intasendClient } from '../config/intasend.js'
import { supabase } from '../config/supabase.js'

const PLANS = {
  monthly: {
    amount: 499, // KES
    duration: 30, // days
    description: 'Premium Monthly Plan'
  },
  yearly: {
    amount: 4990, // KES
    duration: 365,
    description: 'Premium Yearly Plan'
  }
}

export class PaymentService {
  /**
   * Initiate STK Push payment
   */
  async initiatePayment(userId, email, phoneNumber, plan) {
    try {
      const planDetails = PLANS[plan]
      if (!planDetails) {
        throw new Error('Invalid plan selected')
      }

      // Format phone number (remove leading 0 or +254)
      const formattedPhone = phoneNumber.replace(/^0/, '254').replace(/^\+254/, '254')

      // Create transaction record
      const { data: transaction, error: dbError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          amount: planDetails.amount,
          plan: plan,
          phone_number: formattedPhone,
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (dbError) throw dbError


// In initiatePayment method, replace the IntaSend call with:

// CORRECT ENDPOINT for STK Push
const response = await intasendClient.post('/payment/mpesa-stk-push/', {
  amount: planDetails.amount,
  phone_number: formattedPhone,
  provider: 'm-pesa',
  reference: `PREMIUM_${transaction.id}_${Date.now()}`,
  description: planDetails.description,
  email: email,
  api_key: process.env.INTASEND_PUBLISHABLE_KEY
})

      // Update transaction with checkout request id
      await supabase
        .from('transactions')
        .update({
          checkout_id: response.data.id,
          provider_ref: response.data.invoice?.id
        })
        .eq('id', transaction.id)

      return {
        transactionId: transaction.id,
        checkoutId: response.data.id,
        status: response.data.status,
        provider: 'm-pesa'
      }
    } catch (error) {
      console.error('Payment initiation error:', error)
      throw error
    }
  }


async verifyPayment(transactionId) {
  try {
    const { data: transaction, error: dbError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single()

    if (dbError || !transaction) {
      throw new Error('Transaction not found')
    }

    // CORRECT ENDPOINT - use checkout_id from transaction
    const checkoutId = transaction.checkout_id
    
    if (!checkoutId) {
      throw new Error('No checkout ID found for this transaction')
    }

    // Correct IntaSend status endpoint
    const response = await intasendClient.get(`/payment/status/${checkoutId}/`)
    // OR try this if above doesn't work:
    // const response = await intasendClient.get(`/api/v1/payment/status/${checkoutId}/`)

    console.log('📡 Status response:', response.data)

    const isSuccessful = response.data.status === 'completed' || 
                        response.data.state === 'completed' ||
                        response.data.status === 'success'

    if (isSuccessful) {
      // Update transaction
      await supabase
        .from('transactions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          mpesa_code: response.data.mpesa_code || response.data.mpesa_receipt || null
        })
        .eq('id', transactionId)

      // Update user's subscription
      await this.updateUserSubscription(transaction.user_id, transaction.plan)
    }

    return {
      status: response.data.status || response.data.state || 'unknown',
      isSuccessful,
      transaction,
      data: response.data
    }
  } catch (error) {
    console.error('Verification error:', error.response?.data || error.message)
    throw new Error('Failed to check payment status: ' + (error.response?.data?.message || error.message))
  }
}
  /**
   * Handle webhook from IntaSend
   */
  async handleWebhook(payload) {
    try {
      const { checkout_id, status, amount, mpesa_code } = payload

      // Find transaction
      const { data: transaction, error: dbError } = await supabase
        .from('transactions')
        .update({
          status: status === 'completed' ? 'completed' : 'failed',
          completed_at: status === 'completed' ? new Date().toISOString() : null,
          mpesa_code: mpesa_code || null
        })
        .eq('checkout_id', checkout_id)
        .select()
        .single()

      if (dbError) throw dbError

      // If payment completed, update subscription
      if (status === 'completed' && transaction) {
        await this.updateUserSubscription(transaction.user_id, transaction.plan)
      }

      return { success: true, transaction }
    } catch (error) {
      console.error('Webhook error:', error)
      throw error
    }
  }

  /**
   * Update user's subscription
   */
  async updateUserSubscription(userId, plan) {
    const planDetails = PLANS[plan]
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + planDetails.duration)

    const { data, error } = await supabase
      .from('profiles')
      .update({
        premium_plan: plan,
        premium_expires_at: expiresAt.toISOString(),
        premium_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Check if user is premium
   */
  async checkPremiumStatus(userId) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('premium_plan, premium_expires_at, premium_status')
      .eq('id', userId)
      .single()

    if (error) throw error

    // Check if premium is expired
    const isExpired = profile.premium_status === 'active' && 
      new Date(profile.premium_expires_at) < new Date()

    if (isExpired) {
      // Update status to expired
      await supabase
        .from('profiles')
        .update({
          premium_status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      return {
        isPremium: false,
        plan: null,
        expiresAt: profile.premium_expires_at,
        status: 'expired'
      }
    }

    return {
      isPremium: profile.premium_status === 'active',
      plan: profile.premium_plan,
      expiresAt: profile.premium_expires_at,
      status: profile.premium_status
    }
  }

  /**
   * Restore purchase (for app reinstall)
   */
  async restorePurchase(userId) {
    // Check existing subscription
    const status = await this.checkPremiumStatus(userId)
    
    if (status.isPremium) {
      return status
    }

    // Check for completed transactions that weren't applied
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) throw error

    if (transactions && transactions.length > 0) {
      const lastTransaction = transactions[0]
      await this.updateUserSubscription(userId, lastTransaction.plan)
      return this.checkPremiumStatus(userId)
    }

    return {
      isPremium: false,
      plan: null,
      expiresAt: null,
      status: 'none'
    }
  }
}

export const paymentService = new PaymentService()
