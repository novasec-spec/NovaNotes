// src/app/chat/_layout.tsx
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { isAuthenticated, isGuest } from './authGuard';
import { useEffect } from 'react';
export default function ChatLayout() {


useEffect(() => {
  (async () => {
    const authed = await isAuthenticated();
    const guest = await isGuest();
    if (!authed && !guest) {
      router.replace('/welcome');
    }
  })();
}, []);
  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="chatroom" />
        <Stack.Screen name="notifications" />
      </Stack>
    </View>
  );
}
