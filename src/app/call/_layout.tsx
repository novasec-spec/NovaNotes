// src/app/call/_layout.tsx
import { Stack } from 'expo-router';

export default function CallLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        presentation: 'fullScreenModal',
      }}
    >
      <Stack.Screen name="CallScreen" options={{ headerShown: false }} />
      <Stack.Screen name="IncomingCallScreen" options={{ headerShown: false }} />
    </Stack>
  );
}
