// app/_layout.tsx - FIXED
import { initializeCallingRuntime } from '../lib/callAvailability';
initializeCallingRuntime();	
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, InteractionManager } from 'react-native';
import { Stack } from 'expo-router';
import * as Updates from 'expo-updates';
import * as Sentry from '@sentry/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { useNotificationActions } from '../hooks/useNotificationActions';
import { PremiumProvider } from '../contexts/PremiumContext';
import { useAuth } from '../contexts/AuthContext';
import { useWidgetForegroundSync } from '../widgets/useWidgetForegroundSync';
import { MungaBot } from '../components/MungaBot';
import { useIncomingCallListener } from '../hooks/useIncomingCallListener';
import { NotificationHandler } from '../services/NotificationHandler';
import CallService from '../services/CallService'; // default import — no curly braces
import { markNavigationReady } from '../utils/navigation';

const WHITE = '#FFFFFF';

// ✅ PERF FIX: Don't require('@livekit/react-native') or call registerGlobals()
// at module-eval time — that runs before the first frame even paints, on
// every launch, whether or not the user ever makes a call. Deferred to
// initializeCallingRuntime() (already fired 5s post-mount below) via
// ensureLiveKitGlobals(), which is idempotent and safe to call multiple times.
let liveKitGlobalsRegistered = false;
export function ensureLiveKitGlobals() {
  if (liveKitGlobalsRegistered) return;
  try {
    const livekit = require('@livekit/react-native');
    (livekit.registerGlobals || (() => {}))();
    liveKitGlobalsRegistered = true;
  } catch (e) {
    console.log('ℹ️ LiveKit not available in Expo Go');
  }
}

// ✅ FIX: Only initialize Sentry in production
if (!__DEV__) {
  Sentry.init({
    dsn: 'https://7505066db21919d4bdf65fb56ebdad8e@o4511667237093376.ingest.de.sentry.io/4511667330809936',
    sendDefaultPii: true,
    enableLogs: true,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],
    spotlight: __DEV__,
  });
}

function InnerLayout() {
  useNotificationActions();
  useWidgetForegroundSync();
  const [isMungaVisible, setIsMungaVisible] = useState(true);
  const [isMungaOpen, setIsMungaOpen] = useState(false);
  // ✅ PERF FIX: mount MungaBot one tick after first paint instead of
  // synchronously alongside the Stack — same visible behavior, just doesn't
  // compete with the initial screen for the first frame.
  const [mungaReady, setMungaReady] = useState(false);
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => setMungaReady(true));
    return () => handle.cancel();
  }, []);
  
const auth = useAuth();
const user = auth?.user;

useIncomingCallListener(user?.id);
  
  const USER_ID = user?.username || user?.email || 'Guest';

  const toggleMunga = () => setIsMungaOpen(!isMungaOpen);

  const checkForUpdates = async () => {
    try {
      if (!__DEV__) {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      }
    } catch (error) {
      console.log('Update check failed:', error);
    }
  };


useEffect(() => {
  markNavigationReady();
}, []);

useEffect(() => {
  const timer = setTimeout(() => {
    checkForUpdates();
  }, 10000); // wait 10 seconds after launch

  return () => clearTimeout(timer);
}, []);

useEffect(() => {
  const timer = setTimeout(() => {
    ensureLiveKitGlobals();
  }, 5000);

  return () => clearTimeout(timer);
}, []);


  useEffect(() => {
    NotificationHandler.setup();
    if (user?.id) {
      CallService.setUserId(user.id);
      NotificationHandler.registerForPushNotifications();
    }
  }, [user?.id]);

  return (
    <ThemeProvider>
      <NotificationProvider>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="CallHistoryScreen" options={{ headerShown: false, title: 'Calls' }} />
            <Stack.Screen name="CallingScreen" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="IncomingCallScreen" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="VideoCallScreen" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
            <Stack.Screen name="AudioCallScreen" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
            <Stack.Screen name="mood-checkin" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="premium" options={{ presentation: 'modal', animation: 'slide_from_right' }} />
          </Stack>
        </View>
        {mungaReady && (
          <MungaBot userId={USER_ID} isVisible={isMungaVisible} onToggle={toggleMunga} />
        )}
      </NotificationProvider>
    </ThemeProvider>
  );
}

function RootLayout() {
  return (
    <AuthProvider>
      <PremiumProvider>
        <SafeAreaProvider>
          <InnerLayout />
        </SafeAreaProvider>
      </PremiumProvider>
    </AuthProvider>
  );
}

export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  secretZone: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 60,
    height: 60,
    zIndex: 999,
  },
  secretDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
    opacity: 0.6,
  },
  devToast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 14,
  },
  devToastTxt: {
    color: WHITE,
    fontWeight: '700',
    fontSize: 14,
  },
  toastStyle: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: '#FF6B9D',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    zIndex: 9999,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
});
