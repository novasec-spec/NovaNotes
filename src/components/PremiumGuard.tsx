import React, { useEffect, useState } from 'react'
import { Alert, View, ActivityIndicator, StyleSheet, TouchableOpacity, Text } from 'react-native'
import { premiumService } from '../services/premium'
import { useRouter } from 'expo-router'
import { apiClient } from '../services/api'

export function PremiumGuard({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [isPremium, setIsPremium] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkPremium()
  }, [])

  const checkPremium = async () => {
    try {
      const status = await premiumService.checkPremiumStatus()
      setIsPremium(status.isPremium)
    } catch (error) {
      console.error('Premium check error:', error)
      setIsPremium(false)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={{ marginTop: 12, color: '#6B7280' }}>Checking subscription...</Text>
// In app/premium.tsx, add this temporary test button:

<TouchableOpacity 
  style={styles.testButton}
  onPress={async () => {
    try {
      await apiClient.post('/premium/test/activate')
      Alert.alert('Success', 'Premium activated!')
      checkPremiumStatus()
    } catch (error) {
      Alert.alert('Error', error.message)
    }
  }}
>
  <Text>🔓 Activate Premium (Test)</Text>
</TouchableOpacity>     
 </View>
    )
  }

  if (!isPremium) {
    router.replace('/premium')
    return null
  }

  return <>{children}</>
}

const styles = StyleSheet.create({
  testButton: {
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
});
