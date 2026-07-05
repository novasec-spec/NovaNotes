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
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { premiumService } from '../services/premium'
import { apiClient } from '../services/api'

type PlanType = 'monthly' | 'yearly'

const PLANS = {
  monthly: {
    label: 'Monthly',
    price: 'KES 499',
    duration: 'per month',
    popular: false,
  },
  yearly: {
    label: 'Yearly',
    price: 'KES 4,990',
    duration: 'per year (save 17%)',
    popular: true,
  },
}

export default function PremiumScreen() {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('monthly')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [premiumStatus, setPremiumStatus] = useState<any>(null)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    try {
      setIsChecking(true)
      const status = await premiumService.checkPremiumStatus(true)
      setPremiumStatus(status)
      
      if (status.isPremium) {
        setTimeout(() => router.replace('/'), 1000)
      }
    } catch (error) {
      console.error('Status check error:', error)
    } finally {
      setIsChecking(false)
    }
  }

  const handleSubscribe = async () => {
    const cleanPhone = phoneNumber.replace(/\s/g, '')
    const phoneRegex = /^[0-9]{10,12}$/
    
    if (!phoneRegex.test(cleanPhone)) {
      Alert.alert('Invalid Phone', 'Please enter a valid Safaricom number')
      return
    }

    setIsLoading(true)

    try {
      const result = await premiumService.subscribe(selectedPlan, cleanPhone)
      
      Alert.alert(
        '✅ Payment Initiated',
        'Check your phone for M-Pesa prompt and enter PIN',
        [
          {
            text: 'OK',
            onPress: () => {
              // Start checking status
              checkPaymentStatus(result.transactionId)
            }
          }
        ]
      )
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Payment failed')
      setIsLoading(false)
    }
  }

  const checkPaymentStatus = async (transactionId: string) => {
    try {
      // Poll for status changes
      let attempts = 0
      const maxAttempts = 20 // 60 seconds max
      
      const interval = setInterval(async () => {
        attempts++
        const status = await premiumService.checkPremiumStatus(false) // Force fresh
        
        if (status.isPremium) {
          clearInterval(interval)
          Alert.alert('🎉 Success!', 'Premium activated!', [
            { text: 'Go to App', onPress: () => router.replace('/') }
          ])
          setPremiumStatus(status)
          return
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(interval)
          Alert.alert(
            'Still Processing',
            'Payment may take a few minutes. Check back later.',
            [
              { text: 'Check Again', onPress: () => checkPaymentStatus(transactionId) },
              { text: 'Close', style: 'cancel' }
            ]
          )
        }
      }, 3000) // Check every 3 seconds
      
    } catch (error) {
      console.error('Status check error:', error)
    }
  }

  const handleRestore = async () => {
    setIsRestoring(true)
    try {
      const result = await premiumService.restorePurchase()
      if (result.isPremium) {
        Alert.alert('✅ Restored', 'Premium restored!', [
          { text: 'Go to App', onPress: () => router.replace('/') }
        ])
        setPremiumStatus(result)
      } else {
        Alert.alert('No Purchase', 'No premium subscription found')
      }
    } catch (error) {
      Alert.alert('Error', 'Restore failed')
    } finally {
      setIsRestoring(false)
    }
  }

  if (isChecking) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    )
  }

  if (premiumStatus?.isPremium) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.premiumActiveContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#10B981" />
          <Text style={styles.premiumTitle}>✨ Premium Active</Text>
          <Text style={styles.premiumPlan}>
            {premiumStatus.plan === 'yearly' ? 'Yearly' : 'Monthly'} Plan
          </Text>
          {premiumStatus.expiresAt && (
            <Text style={styles.expiryText}>
              Expires: {new Date(premiumStatus.expiresAt).toLocaleDateString()}
            </Text>
          )}
          <TouchableOpacity
            style={styles.goBackButton}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.goBackText}>Go to App</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Premium</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroSection}>
            <Text style={styles.title}>✨ NovaNotes Premium</Text>
            <Text style={styles.subtitle}>
              Unlock unlimited notes, AI features, and more
            </Text>
          </View>

          {/* Benefits */}
          <View style={styles.benefitsContainer}>
            <Benefit icon="infinite" text="Unlimited notes & folders" />
            <Benefit icon="sparkles" text="AI-powered writing assistant" />
            <Benefit icon="cloud" text="Cloud sync across devices" />
            <Benefit icon="shield" text="Premium support" />
          </View>

          {/* Plans */}
          <View style={styles.planContainer}>
            {Object.entries(PLANS).map(([key, plan]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.planCard,
                  selectedPlan === key && styles.planCardSelected,
                  plan.popular && styles.planCardPopular,
                ]}
                onPress={() => setSelectedPlan(key as PlanType)}
              >
                {plan.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>Popular</Text>
                  </View>
                )}
                <Text style={styles.planLabel}>{plan.label}</Text>
                <Text style={styles.planPrice}>{plan.price}</Text>
                <Text style={styles.planDuration}>{plan.duration}</Text>
                {selectedPlan === key && (
                  <View style={styles.checkmark}>
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Phone Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>📱 Phone Number</Text>
            <View style={styles.inputWrapper}>
              <View style={styles.countryCodeContainer}>
                <Text style={styles.countryCode}>+254</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="712345678"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                maxLength={12}
                editable={!isLoading}
              />
            </View>
            <Text style={styles.inputHint}>
              Safaricom number registered with M-Pesa
            </Text>
          </View>

          {/* Subscribe Button */}
          <TouchableOpacity
            style={[
              styles.subscribeButton,
              (isLoading || !phoneNumber) && styles.disabledButton,
            ]}
            onPress={handleSubscribe}
            disabled={isLoading || !phoneNumber}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.subscribeButtonText}>
                Subscribe - {PLANS[selectedPlan].price}
              </Text>
            )}
          </TouchableOpacity>

          {/* Restore Button */}
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={isRestoring}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color="#4F46E5" />
            ) : (
              <Text style={styles.restoreButtonText}>
                Already purchased? Restore
              </Text>
            )}
          </TouchableOpacity>

          {/* Footer */}
          <Text style={styles.footerText}>
            By subscribing, you agree to our Terms of Service
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function Benefit({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.benefitItem}>
      <Ionicons name={icon as any} size={20} color="#4F46E5" />
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  heroSection: {
    marginTop: 12,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 22,
  },
  benefitsContainer: {
    marginBottom: 24,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  benefitText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 10,
  },
  planContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  planCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  planCardSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  planCardPopular: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#F59E0B',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  popularText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  planLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  planPrice: {
    fontSize: 22,
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
    top: -6,
    right: -6,
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    overflow: 'hidden',
  },
  countryCodeContainer: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    justifyContent: 'center',
    height: 48,
    borderRightWidth: 1,
    borderRightColor: '#D1D5DB',
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A2E',
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A2E',
    height: 48,
  },
  inputHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
  },
  subscribeButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  subscribeButtonText: {
    color: '#FFF',
    fontSize: 17,
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
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
  premiumActiveContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  premiumTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A2E',
    marginTop: 12,
  },
  premiumPlan: {
    fontSize: 18,
    color: '#4F46E5',
    marginTop: 4,
    fontWeight: '500',
  },
  expiryText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  goBackButton: {
    marginTop: 24,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  goBackText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
})
