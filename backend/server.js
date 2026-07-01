import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import premiumRoutes from './routes/premium.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['http://127.0.0.1:8081'] 
    : '*'
}))
app.use(express.json())

// Routes
app.use('/api/premium', premiumRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})
