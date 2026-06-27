// src/app/chat/_layout.tsx
import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { supabase } from '../../../config/supabase';
import NotificationBanner from './NotificationBanner';

export default function ChatLayout() {
  const router = useRouter();
  // The real signed-in user's id, pulled from the live Supabase Auth session —
  // NOT a hardcoded placeholder. This file sits above index/chatroom in the
  // route tree, so it can't receive `user` as a prop from them; it has to ask
  // Supabase directly, which is what getSession() + onAuthStateChange do below.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    // 1. Get whatever session already exists right now (e.g. on a cold app start).
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user?.id ?? null);
    });

    // 2. Keep it in sync if the user signs in / out / refreshes their session
    //    while this layout is mounted, so the banner never goes stale.
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {/* Only mount the banner once we actually know who's signed in — render-
          ing it with a null/placeholder id is exactly what caused the
          "current-user-id is not a real UUID" error. */}
      {currentUserId && (
        <NotificationBanner
          currentUserId={currentUserId}
          onOpenChat={(chatId) => router.push(`/chat/${chatId}` as any)}
        />
      )}

      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="chatroom" />
      </Stack>
    </View>
  );
}
