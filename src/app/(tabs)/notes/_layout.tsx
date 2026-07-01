import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
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
      </Stack>
    </View>
  );
}

