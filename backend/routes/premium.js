import express from 'express'
import { paymentService } from '../services/payment.service.js'
import { supabase } from '../config/supabase.js'

const router = express.Router()

// Middleware to get user from Supabase auth header
const getUserFromToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    req.user = user
    next()
  } catch (error) {
    console.error('Auth error:', error)
    res.status(401).json({ error: 'Authentication failed' })
  }
}

// Initiate payment
router.post('/pay', getUserFromToken, async (req, res) => {
  try {
    const { plan, phoneNumber } = req.body

    if (!plan || !phoneNumber) {
      return res.status(400).json({ 
        error: 'Missing required fields: plan, phoneNumber' 
      })
    }

    if (!['monthly', 'yearly'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan selected' })
    }

    const result = await paymentService.initiatePayment(
      req.user.id,
      req.user.email,
      phoneNumber,
      plan
    )

    res.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Payment initiation error:', error)
    res.status(500).json({ 
      error: 'Payment initiation failed',
      details: error.message 
    })
  }
})


router.post('/test/activate', getUserFromToken, async (req, res) => {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)
  
  await supabase
    .from('profiles')
    .update({
      premium_plan: 'monthly',
      premium_expires_at: expiresAt.toISOString(),
      premium_status: 'active'
    })
    .eq('id', req.user.id)
  
  res.json({ success: true, message: 'Premium activated for testing' })
})

// Check payment status
router.get('/status/:transactionId', getUserFromToken, async (req, res) => {
  try {
    const { transactionId } = req.params
    
    const result = await paymentService.verifyPayment(transactionId)
    
    res.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Status check error:', error)
    res.status(500).json({ 
      error: 'Failed to check payment status',
      details: error.message 
    })
  }
})

// Add this test endpoint - NO AUTH REQUIRED
router.get('/test', async (req, res) => {
  try {
    res.json({ 
      success: true, 
      message: 'API is working!',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Also add a public check endpoint (for testing)
router.get('/public-check', async (req, res) => {
  try {
    // This would normally check a user's premium status
    // For testing, just return a mock response
    res.json({
      isPremium: false,
      plan: null,
      status: 'none',
      message: 'Public endpoint - no auth required'
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Check premium status
router.get('/check', getUserFromToken, async (req, res) => {
  try {
    const status = await paymentService.checkPremiumStatus(req.user.id)
    
    res.json({
      success: true,
      ...status
    })
  } catch (error) {
    console.error('Premium check error:', error)
    res.status(500).json({ 
      error: 'Failed to check premium status',
      details: error.message 
    })
  }
})

// Restore purchase
router.post('/restore', getUserFromToken, async (req, res) => {
  try {
    const status = await paymentService.restorePurchase(req.user.id)
    
    res.json({
      success: true,
      ...status
    })
  } catch (error) {
    console.error('Restore error:', error)
    res.status(500).json({ 
      error: 'Failed to restore purchase',
      details: error.message 
    })
  }
})

// Webhook for IntaSend
router.post('/webhook', async (req, res) => {
  try {
    const result = await paymentService.handleWebhook(req.body)
    
    res.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(500).json({ 
      error: 'Webhook processing failed',
      details: error.message 
    })
  }
})

export default router
