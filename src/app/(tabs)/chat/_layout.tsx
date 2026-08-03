// src/app/chat/_layout.tsx
import { Stack, useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { isAuthenticated, isGuest } from './authGuard';
import { useEffect, useState } from 'react';

export default function ChatLayout() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthAndRedirect();
  }, []);

  const checkAuthAndRedirect = async () => {
    try {
      const authed = await isAuthenticated();
      const guest = await isGuest();
      
      // Small delay to ensure router is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!authed && !guest) {
        // Use replace with a slight delay
        requestAnimationFrame(() => {
          router.replace('/chat/welcome');
        });
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking auth
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF6B9D" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="chatroom" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="auth" />
      </Stack>
    </View>
  );
}
