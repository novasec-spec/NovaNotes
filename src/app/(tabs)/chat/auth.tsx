// src/app/chat/auth.tsx - Without Google Auth
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../config/supabase';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../../contexts/ThemeContext';
import { registerPushToken } from './notification';
import { User } from './types';

export default function AuthScreen() {
  const { colors, isDarkMode } = useTheme();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // ─── EMAIL / PASSWORD AUTH ───
  const handleAuth = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (isSignUp && !username) {
      setError('Please choose a username');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let response;
      if (isSignUp) {
        response = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.trim(),
              avatar_url: `https://ui-avatars.com/api/?name=${username.trim()}&background=FF6B9D&color=fff&size=128`,
            },
          },
        });
      } else {
        response = await supabase.auth.signInWithPassword({
          email,
          password,
        });
      }

      if (response.error) throw response.error;

      if (response.data.user) {
        const { data: existingUser, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', response.data.user.id)
          .single();

        let userData;
        if (existingUser) {
          userData = existingUser;
        } else {
          const newUser = {
            id: response.data.user.id,
            email: response.data.user.email || email,
            username: response.data.user.user_metadata?.username || username || email.split('@')[0],
            avatar_url: response.data.user.user_metadata?.avatar_url || 
              `https://ui-avatars.com/api/?name=${username || email.split('@')[0]}&background=FF6B9D&color=fff&size=128`,
            online: true,
            last_seen: new Date().toISOString(),
          };

          const { data: insertedUser, error: insertError } = await supabase
            .from('users')
            .insert(newUser)
            .select()
            .single();

          if (insertError) throw insertError;
          userData = insertedUser;
        }

        const user: User = {
          id: userData.id,
          email: userData.email,
          username: userData.username,
          avatar_url: userData.avatar_url,
          online: true,
          last_seen: new Date().toISOString(),
        };

        await AsyncStorage.setItem('chat_user', JSON.stringify(user));
        await AsyncStorage.setItem('is_authenticated', 'true');
        await registerPushToken(user.id);
        
        router.replace('/chat');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── FORGOT PASSWORD ───
  const handleForgotPassword = async () => {
    if (!resetEmail) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: 'yourapp://reset-password',
      });

      if (error) throw error;

      setResetSent(true);
      Alert.alert(
        '✅ Reset Email Sent',
        'Check your email for password reset instructions.',
        [{ text: 'OK', onPress: () => {
          setIsForgotPassword(false);
          setResetSent(false);
          setResetEmail('');
        }}]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── RENDER FORGOT PASSWORD SCREEN ───
  if (isForgotPassword) {
    return (
      <KeyboardAvoidingView 
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity 
            onPress={() => {
              setIsForgotPassword(false);
              setResetEmail('');
              setResetSent(false);
            }}
            style={styles.backButton}
          >
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
            <Text style={styles.buttonText}>
              {loading ? 'Sending...' : '📧 Send Reset Link'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsForgotPassword(false)}>
            <Text style={[styles.switchText, { color: '#FF6B9D' }]}>
              ← Back to Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ─── MAIN AUTH SCREEN ───
  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Icon name="chatbubbles" size={60} color="#FF6B9D" />
          <Text style={[styles.title, { color: colors.text }]}>💬 Chat</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            {isSignUp ? 'Create your account' : 'Sign in to chat'}
          </Text>

          {isSignUp && (
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
              placeholder="Username"
              placeholderTextColor={colors.muted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          )}

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
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
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
            onPress={handleAuth}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          {/* Forgot Password Link */}
          {!isSignUp && (
            <TouchableOpacity 
              onPress={() => setIsForgotPassword(true)}
              style={styles.forgotPasswordLink}
            >
              <Text style={[styles.forgotPasswordText, { color: colors.muted }]}>
                Forgot password?
              </Text>
            </TouchableOpacity>
          )}

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.muted }]}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Switch between Sign Up / Sign In */}
          <TouchableOpacity onPress={() => { 
            setIsSignUp(!isSignUp); 
            setError(''); 
            setUsername('');
          }}>
            <Text style={[styles.switchText, { color: '#FF6B9D' }]}>
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
  },
  card: {
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    alignSelf: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  input: {
    width: '100%',
    flexDirection: 'row',
   alignItems: 'center',
   paddingHorizontal: 20,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: 12,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 8,
  },
  button: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  error: {
    color: '#F44336',
    fontSize: 14,
    marginBottom: 10,
  },
  switchText: {
    fontSize: 14,
    marginTop: 15,
  },
  forgotPasswordLink: {
    marginTop: 8,
    alignSelf: 'center',
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '500',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    paddingHorizontal: 12,
  },
  termsText: {
    fontSize: 11,
    marginTop: 16,
    textAlign: 'center',
  },
});
