// app/signup.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';

// ⚠️ Verify these paths match your project structure
import { supabase } from '../../../config/supabase';
import { useTheme } from '../../../contexts/ThemeContext';
import { registerPushToken } from './notification';
import { User } from './types';

import { authStyles as styles } from './authStyles';
import { clearGuestMode } from './authGuard';

export default function SignupScreen() {
  const { colors } = useTheme();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async () => {
    if (!email || !password || !username) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.trim(),
            avatar_url: `https://ui-avatars.com/api/?name=${username.trim()}&background=FF6B9D&color=fff&size=128`,
          },
        },
      });

      if (response.error) throw response.error;

      if (response.data.user) {
        const newUser = {
          id: response.data.user.id,
          email: response.data.user.email || email,
          username: username.trim(),
          avatar_url:
            response.data.user.user_metadata?.avatar_url ||
            `https://ui-avatars.com/api/?name=${username.trim()}&background=FF6B9D&color=fff&size=128`,
          online: true,
          last_seen: new Date().toISOString(),
        };

        const { data: insertedUser, error: insertError } = await supabase
          .from('users')
          .insert(newUser)
          .select()
          .single();

        if (insertError) throw insertError;

        const user: User = {
          id: insertedUser.id,
          email: insertedUser.email,
          username: insertedUser.username,
          avatar_url: insertedUser.avatar_url,
          online: true,
          last_seen: new Date().toISOString(),
        };

        await AsyncStorage.setItem('chat_user', JSON.stringify(user));
        await AsyncStorage.setItem('is_authenticated', 'true');
        await clearGuestMode();
        await registerPushToken(user.id);

        router.replace((redirect as string) || '/chat');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <Icon name="chatbubbles" size={60} color="#FF6B9D" />
          <Text style={[styles.title, { color: colors.text }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Join and start chatting</Text>

          <TextInput
            style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
            placeholder="Username"
            placeholderTextColor={colors.muted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <TextInput
            style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <View style={[styles.passwordContainer, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <TextInput
              style={[styles.passwordInput, { color: colors.text }]}
              placeholder="Password"
              placeholderTextColor={colors.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Icon
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={colors.muted}
              />
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#FF6B9D' }]}
            onPress={handleSignup}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Creating account...' : 'Sign Up'}</Text>
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.muted }]}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <TouchableOpacity
            onPress={() =>
              router.push(
                redirect ? `/chat/login?redirect=${encodeURIComponent(redirect as string)}` : '/chat/login'
              )
            }
          >
            <Text style={[styles.switchText, { color: '#FF6B9D' }]}>
              Already have an account? Sign In
            </Text>
          </TouchableOpacity>

          <Text style={[styles.termsText, { color: colors.muted }]}>
            By continuing, you agree to our Terms and Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
