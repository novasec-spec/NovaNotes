import React, { useEffect, useState, useRef, useCallback, createContext } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { Stack, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { useNotificationActions } from '../hooks/useNotificationActions';


import { SupabaseBackup } from '../services/supabaseBackup';
import { MungaBot } from '../components/MungaBot';

const USER_ID = 'Njeri';
const WHITE = '#FFFFFF';

export const AppContext = createContext({
  isSecretVisible: false,
  setIsSecretVisible: (val: boolean) => {},
});

function SecretZone({ onUnlock, isDevMode }: { onUnlock: () => void; isDevMode: boolean }) {
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const handleTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 3000);

    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.4, duration: 80, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();

    if (tapCount.current >= 5) {
      tapCount.current = 0;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      onUnlock();
    }
  };

  useEffect(() => { return () => { if (tapTimer.current) clearTimeout(tapTimer.current); }; }, []);
  return (
    <Pressable style={styles.secretZone} onPress={handleTap} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
      {isDevMode && <Animated.View style={[styles.secretDot, { transform: [{ scale: pulseAnim }] }]} />}
    </Pressable>
  );
}

function DevToast({ visible }: { visible: boolean }) {
  const translateY = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(translateY, { toValue: -60, duration: 300, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]).start();
        }, 2800);
      });
    }
  }, [visible]);

  return (
    <Animated.View style={[styles.devToast, { top: insets.top + 12, opacity, transform: [{ translateY }] }]}>
      <Icon name="construct" size={16} color={WHITE} />
      <Text style={styles.devToastTxt}>Developer mode unlocked</Text>
    </Animated.View>
  );
}

function InnerLayout() {
useNotificationActions();
  const [isMungaVisible, setIsMungaVisible] = useState(true);
  const [isMungaOpen, setIsMungaOpen] = useState(false);
  const [responseToast, setResponseToast] = useState<string | null>(null);
  const [isSecretVisible, setIsSecretVisible] = useState(false);
  const [showDevToast, setShowDevToast] = useState(false);
  
  const backup = useRef(new SupabaseBackup(USER_ID)).current;
  const toggleMunga = () => setIsMungaOpen(!isMungaOpen);

  const checkForUpdates = async () => {
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      }
    } catch (error) { console.log('Update check failed:', error); }
  };

  const setupApp = async () => {
    const hasRestored = await AsyncStorage.getItem('hasRestored');
    if (!hasRestored) {
      await backup.restoreFromBackup();
      await AsyncStorage.setItem('hasRestored', 'true');
    }
  };

  const checkSecretAccess = async () => {
    try {
      const hasAccess = await AsyncStorage.getItem('dev_access');
      if (hasAccess === 'true') setIsSecretVisible(true);
    } catch (error) { console.error('Error checking secret access:', error); }
  };

  const handleSecretUnlock = useCallback(async () => {
    try {
      const currentAccess = await AsyncStorage.getItem('dev_access');
      if (currentAccess === 'true') {
        setShowDevToast(true);
        setTimeout(() => setShowDevToast(false), 3200);
      } else {
        await AsyncStorage.setItem('dev_access', 'true');
        setIsSecretVisible(true);
        setShowDevToast(true);
        setTimeout(() => setShowDevToast(false), 3200);
      }
    } catch (error) { console.error('Secret unlock error:', error); }
  }, []);

  useEffect(() => { checkForUpdates(); }, []);
  useEffect(() => { setupApp(); checkSecretAccess(); }, []);

  return (
    <ThemeProvider>
<NotificationProvider>
      <AppContext.Provider value={{ isSecretVisible, setIsSecretVisible }}>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="splash" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="(tabs)" />
<Stack.Screen name="notification-playground" options={{ presentation: 'modal', animation: 'slide_from_right' }} />
// app/_layout.tsx

<Stack.Screen 
  name="mood-checkin" 
  options={{ 
    presentation: 'modal', 
    animation: 'slide_from_bottom',
    headerShown: false,
  }} 
/>
<Stack.Screen 
  name="notification-settings" 
  options={{ 
    presentation: 'modal', 
    animation: 'slide_from_bottom',
    headerShown: false,
  }} 
/>
            <Stack.Screen name="notification" options={{ presentation: 'modal', animation: 'slide_from_right' }} />
          </Stack>
        </View>

        <SecretZone onUnlock={handleSecretUnlock} isDevMode={isSecretVisible} />
        <DevToast visible={showDevToast} />

        {responseToast && (
          <Animated.View style={styles.toastStyle}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
              Alice reacted: {responseToast}
            </Text>
          </Animated.View>
        )}
        <MungaBot userId="Alice" isVisible={isMungaVisible} onToggle={toggleMunga} />
      </AppContext.Provider>
</NotificationProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <InnerLayout />
      </SafeAreaProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  secretZone: { position: 'absolute', top: 0, right: 0, width: 60, height: 60, zIndex: 999 },
  secretDot: { position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B', opacity: 0.6 },
  devToast: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1A1A2E', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, zIndex: 9999, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 14 },
  devToastTxt: { color: WHITE, fontWeight: '700', fontSize: 14 },
  toastStyle: { position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: '#FF6B9D', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, zIndex: 9999, shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 10 },
});
