// app/welcome.tsx
// First screen a visitor sees. They pick Guest / Log In / Create Account.
// If they arrived here because a guest tapped an account-only feature,
// `redirect` carries the route to send them back to after auth.
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';

// ⚠️ Verify these two paths match your project structure
import { useTheme } from '../../../contexts/ThemeContext';

import { authStyles as styles } from './authStyles';
import { enterAsGuest } from './authGuard';

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  const handleGuest = async () => {
    await enterAsGuest();
    router.replace((redirect as string) || '/faith');
  };

  const goLogin = () => {
    router.push(
      redirect ? `/chat/login?redirect=${encodeURIComponent(redirect as string)}` : '/chat/login'
    );
  };

  const goSignup = () => {
    router.push(
      redirect ? `/chat/signup?redirect=${encodeURIComponent(redirect as string)}` : '/chat/signup'
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Icon name="chatbubbles" size={70} color="#FF6B9D" />
      <Text style={[styles.title, { color: colors.text }]}>💬 Chat</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Connect, chat, and stay close
      </Text>

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: '#FF6B9D' }]}
        onPress={goLogin}
      >
        <Text style={styles.primaryButtonText}>Log In</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryButton, { borderColor: '#FF6B9D' }]}
        onPress={goSignup}
      >
        <Text style={[styles.secondaryButtonText, { color: '#FF6B9D' }]}>
          Create Account
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleGuest} style={styles.guestLink}>
        <Text style={[styles.guestText, { color: colors.muted }]}>
          Continue as Guest
        </Text>
      </TouchableOpacity>

      <Text style={[styles.termsText, { color: colors.muted }]}>
        By continuing, you agree to our Terms and Privacy Policy
      </Text>
    </View>
  );
}
