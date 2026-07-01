import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { premiumService } from '../services/premium'
import { supabase } from '../config/supabase'

type PlanType = 'monthly' | 'yearly'

const PLANS = {
  monthly: {
    label: 'Monthly',
    price: 'KES 499',
    duration: 'per month',
  },
  yearly: {
    label: 'Yearly',
    price: 'KES 4,990',
    duration: 'per year (save 17%)',
  },
}

export default function PremiumScreen() {
 const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('monthly')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [premiumStatus, setPremiumStatus] = useState<{
    isPremium: boolean
    plan?: string
    expiresAt?: string
  } | null>(null)

  useEffect(() => {
    checkPremiumStatus()
  }, [])

  useEffect(() => {
    checkAuthAndPremium()
  }, [])



  const checkAuthAndPremium = async () => {
    try {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        Alert.alert(
          'Sign In Required',
          'Please sign in to access premium features',
          [{ text: 'OK', onPress: () => router.push('/auth') }]
        )
        setIsAuthenticated(false)
        setIsLoading(false)
        return
      }

      setIsAuthenticated(true)
      await checkPremiumStatus()
    } catch (error) {
      console.error('Auth check error:', error)
    } finally {
      setIsLoading(false)
    }
  }

// In your PremiumScreen, add a test button:
const testApiWithoutAuth = async () => {
  try {
    const response = await fetch('https://amendable-applaud-stank.ngrok-free.dev/api/premium/test')
    const data = await response.json()
    console.log('✅ API test:', data)
    Alert.alert('Success', 'API is reachable!')
  } catch (error) {
    console.error('❌ Test failed:', error)
    Alert.alert('Error', error.message)
  }
}

const testApiWithAuth = async () => {
  try {
    // This will fail but show the auth error properly
    const status = await premiumService.checkPremiumStatus()
    console.log('Premium status:', status)
  } catch (error) {
    console.error('Auth test failed:', error.message)
    Alert.alert('Auth Required', 'Please sign in first')
  }
}
  const checkPremiumStatus = async () => {
    try {
      const status = await premiumService.checkPremiumStatus()
      setPremiumStatus(status)
    } catch (error) {
      console.error('Error checking premium status:', error)
    }
  }

  const handleSubscribe = async () => {
    // Check authentication first
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      Alert.alert('Sign In Required', 'Please sign in to subscribe')
      return
    }

    // Validate phone number
    const phoneRegex = /^[0-9]{10,12}$/
    const cleanPhone = phoneNumber.replace(/\s/g, '')
    
    if (!phoneRegex.test(cleanPhone)) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number')
      return
    }

    setIsLoading(true)

    try {
      const result = await premiumService.subscribe(selectedPlan, cleanPhone)
      
      Alert.alert(
        'Payment Initiated',
        'Please check your phone for the M-Pesa STK Push prompt and enter your PIN to complete payment.',
        [
          {
            text: 'Check Status',
            onPress: () => checkPaymentStatus(result.transactionId),
          },
        ]
      )
    } catch (error) {
      Alert.alert(
        'Payment Failed',
        'Could not initiate payment. Please try again later.'
      )
      console.error('Subscribe error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const checkPaymentStatus = async (transactionId: string) => {
    try {
      const result = await premiumService.checkPaymentStatus(transactionId)
      
      if (result.isSuccessful) {
        Alert.alert('Success!', 'Your premium subscription is now active!')
        checkPremiumStatus()
      } else if (result.status === 'pending') {
        Alert.alert(
          'Pending',
          'Payment is still processing. Please wait a few moments and try again.',
          [
            {
              text: 'Check Again',
              onPress: () => checkPaymentStatus(transactionId),
            },
          ]
        )
      } else {
        Alert.alert('Failed', 'Payment was not successful. Please try again.')
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to check payment status')
      console.error('Status check error:', error)
    }
  }

  const handleRestore = async () => {
    try {
      const result = await premiumService.restorePurchase()
      
      if (result.isPremium) {
        Alert.alert('Restored', 'Your premium subscription has been restored!')
        checkPremiumStatus()
      } else {
        Alert.alert('No Purchase', 'No premium subscription found to restore.')
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to restore purchase')
      console.error('Restore error:', error)
    }
  }

  // If already premium
  if (premiumStatus?.isPremium) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.premiumBadge}>
          <Text style={styles.premiumBadgeText}>✨ Premium Active</Text>
        </View>
        <Text style={styles.premiumPlan}>
          {premiumStatus.plan === 'yearly' ? 'Yearly' : 'Monthly'} Plan
        </Text>
        {premiumStatus.expiresAt && (
          <Text style={styles.expiryText}>
            Expires: {new Date(premiumStatus.expiresAt).toLocaleDateString()}
          </Text>
        )}
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>✨ NovaNotes Premium</Text>
        <Text style={styles.subtitle}>
          Unlock unlimited notes, AI features, and more
        </Text>

        {/* Plan Selector */}
        <View style={styles.planContainer}>
          {Object.entries(PLANS).map(([key, plan]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.planCard,
                selectedPlan === key && styles.planCardSelected,
              ]}
              onPress={() => setSelectedPlan(key as PlanType)}
            >
              <Text style={styles.planLabel}>{plan.label}</Text>
              <Text style={styles.planPrice}>{plan.price}</Text>
              <Text style={styles.planDuration}>{plan.duration}</Text>
              {selectedPlan === key && (
                <View style={styles.checkmark}>
                  <Text>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Phone Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="0712345678"
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            maxLength={12}
          />
          <Text style={styles.inputHint}>
            Enter the phone number registered with M-Pesa
          </Text>
        </View>

        {/* Subscribe Button */}
        <TouchableOpacity
          style={[styles.subscribeButton, isLoading && styles.disabledButton]}
          onPress={handleSubscribe}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.subscribeButtonText}>
              Subscribe Now - {PLANS[selectedPlan].price}
            </Text>
          )}
        </TouchableOpacity>

        {/* Restore Button */}
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
        >
          <Text style={styles.restoreButtonText}>
            Already purchased? Restore
          </Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          By subscribing, you agree to our Terms and Privacy Policy
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A1A2E',
    textAlign: 'center',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 30,
  },
  planContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 30,
  },
  planCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  planCardSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  planLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  planPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4F46E5',
    marginTop: 4,
  },
  planDuration: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  checkmark: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  inputHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  subscribeButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
  subscribeButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  restoreButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  restoreButtonText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '500',
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 20,
  },
  premiumBadge: {
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 40,
  },
  premiumBadgeText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  premiumPlan: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
  },
  expiryText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
})
