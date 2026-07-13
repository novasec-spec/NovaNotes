// src/app/faith/_layout.tsx
import { Stack } from 'expo-router';

export default function FaithLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="bible" options={{ headerShown: false }} />
      <Stack.Screen name="prayer" options={{ headerShown: false }} />
      <Stack.Screen name="sermon" options={{ headerShown: false }} />
      <Stack.Screen name="praise" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
    </Stack>
  );
}
