import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
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
import { CallProvider } from '../contexts/CallContext';
import { CallPushHandler } from '../components/CallPushHandler';
import { IncomingCallModal } from '../components/IncomingCallModal';

const WHITE = '#FFFFFF';


Sentry.init({
  dsn: 'https://7505066db21919d4bdf65fb56ebdad8e@o4511667237093376.ingest.de.sentry.io/4511667330809936',
  sendDefaultPii: true,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],
  spotlight: __DEV__,
});

function InnerLayout() {
  useNotificationActions();
  useWidgetForegroundSync();
  const [isMungaVisible, setIsMungaVisible] = useState(true);
  const [isMungaOpen, setIsMungaOpen] = useState(false);
  const { user } = useAuth();
  const USER_ID = user?.username || user?.email || 'Guest';

  const toggleMunga = () => setIsMungaOpen(!isMungaOpen);

  const checkForUpdates = async () => {
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      }
    } catch (error) {
      console.log('Update check failed:', error);
    }
  };

  useEffect(() => {
    if (!__DEV__) {
      checkForUpdates();
    }
  }, []);

  return (
    <ThemeProvider>
      <NotificationProvider>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="(tabs)" />

            <Stack.Screen
              name="mood-checkin"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
                headerShown: false,
              }}
            />

            <Stack.Screen
              name="calls"
              options={{
                headerShown: false,
                presentation: 'fullScreenModal',
                animation: 'fade',
              }}
            />
            <Stack.Screen name="call" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="premium" options={{ presentation: 'modal', animation: 'slide_from_right' }} />
          </Stack>
        </View>

        <MungaBot userId={USER_ID} isVisible={isMungaVisible} onToggle={toggleMunga} />
      </NotificationProvider>
    </ThemeProvider>
  );
}


function RootLayout() {
  return (
    <AuthProvider>
      <CallProviderWrapper />
    </AuthProvider>
  );
}

function CallProviderWrapper() {
  const { user } = useAuth();

  return (
    <CallProvider
      userId={user?.id}
      userName={user?.name}
    >
      <CallPushHandler />

      <PremiumProvider>
        <SafeAreaProvider>
          <InnerLayout />
          <IncomingCallModal />
        </SafeAreaProvider>
      </PremiumProvider>
    </CallProvider>
  );
}

export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({ secretZone: { position: 'absolute', top: 0, right: 0, width: 60, height: 60, zIndex: 999 },
  secretDot: { position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B', opacity: 0.6
  }, devToast: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor:
  '#1A1A2E', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, zIndex: 9999, shadowColor: '#000', shadowOffset: { width:
  0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 14 }, devToastTxt: { color: WHITE, fontWeight: '700', fontSize: 14
  }, toastStyle: { position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: '#FF6B9D', paddingHorizontal: 20,
  paddingVertical: 12, borderRadius: 24, zIndex: 9999, shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 4 }, shadowOpacity:
  0.4, shadowRadius: 10, elevation: 10 },
});
