import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function NotificationLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
      </Stack>
    </View>
  );
}
