import React, { useEffect, useState } from 'react'
import { View, ActivityIndicator, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { premiumService } from '../services/premium'

export function PremiumGuard({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [isPremium, setIsPremium] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkPremium()
  }, [])

  const checkPremium = async () => {
    try {
      // Use cached status - instant!
      const status = await premiumService.checkPremiumStatus(true)
      setIsPremium(status.isPremium)
      
      if (!status.isPremium) {
        setTimeout(() => router.replace('/premium'), 500)
      }
    } catch (error) {
      console.error('Premium check error:', error)
      setIsPremium(false)
      setTimeout(() => router.replace('/premium'), 500)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={{ marginTop: 12, color: '#6B7280' }}>Loading...</Text>
      </View>
    )
  }

  if (!isPremium) return null

  return <>{children}</>
}
