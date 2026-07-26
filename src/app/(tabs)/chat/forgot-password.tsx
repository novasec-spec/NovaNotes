// app/forgot-password.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';

// ⚠️ Verify these paths match your project structure
import { supabase } from '../../../config/supabase';
import { useTheme } from '../../../contexts/ThemeContext';

import { authStyles as styles } from './authStyles';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  const [resetEmail, setResetEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: 'novanote://reset-password',
      });

      if (resetError) throw resetError;

      Alert.alert(
        '✅ Reset Email Sent',
        'Check your email for password reset instructions.',
        [
          {
            text: 'OK',
            onPress: () =>
              router.push(
                redirect
                  ? `/chat/login?redirect=${encodeURIComponent(redirect as string)}`
                  : '/chat/login'
              ),
          },
        ]
      );
    } catch (err: any) {
      setError(err.message);
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <Icon name="lock-open" size={50} color="#FF6B9D" />
        <Text style={[styles.title, { color: colors.text }]}>🔑 Forgot Password</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Enter your email to receive a reset link
        </Text>

        <TextInput
          style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          value={resetEmail}
          onChangeText={setResetEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#FF6B9D' }]}
          onPress={handleForgotPassword}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Sending...' : '📧 Send Reset Link'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            router.push(
              redirect ? `/chat/login?redirect=${encodeURIComponent(redirect as string)}` : '/chat/login'
            )
          }
        >
          <Text style={[styles.switchText, { color: '#FF6B9D' }]}>← Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
