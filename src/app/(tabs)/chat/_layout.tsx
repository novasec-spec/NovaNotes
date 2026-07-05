// src/app/chat/_layout.tsx
import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function ChatLayout() {
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
