import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

// Correct API endpoints
const INTASEND_API_URL = process.env.INTASEND_API_URL || 'https://sandbox.intasend.com/api/v1'
const INTASEND_SECRET_KEY = process.env.INTASEND_SECRET_KEY
const INTASEND_PUBLISHABLE_KEY = process.env.INTASEND_PUBLISHABLE_KEY

if (!INTASEND_SECRET_KEY || !INTASEND_PUBLISHABLE_KEY) {
  throw new Error('Missing IntaSend credentials')
}

export const intasendClient = axios.create({
  baseURL: INTASEND_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${INTASEND_SECRET_KEY}`
  }
})

export const intasendPublishableKey = INTASEND_PUBLISHABLE_KEY
