// src/app/(tabs)/_layout.tsx - COMPLETE FIX
import React, { useState, useContext, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppContext } from '../_layout';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';
import NotificationBanner from './chat/NotificationBanner';
import { NotificationService } from './index/task/services/notificationService';
import * as Notifications from 'expo-notifications';
const { width: W } = Dimensions.get('window');

// ✅ 5 CORE TABS ONLY
const TAB_CONFIG: Record<string, { icon: string; iconActive: string; color: string }> = {
  index: { icon: 'home-outline', iconActive: 'home', color: '#FF6B9D' },
  notes: { icon: 'document-text-outline', iconActive: 'document-text', color: '#A855F7' },
  memories: { icon: 'images-outline', iconActive: 'images', color: '#F97316' },
  vibe: { icon: 'happy-outline', iconActive: 'happy', color: '#22C55E' },
  chat: { icon: 'chatbubbles-outline', iconActive: 'chatbubbles', color: '#F59E0B' },
  faith: { icon: 'book-outline', iconActive: 'book', color: '#F59E0B' },
};

// Helper to format the label
const getTabLabel = (name: string) => {
  if (name === 'index') return 'Home';
  return name.charAt(0).toUpperCase() + name.slice(1);
};

// ── Custom Tab Bar with REAL GLASSMORPHISM ──────
function CustomTabBar({ state, navigation }: any) {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const tabCount = state.routes.length;
  const tabWidth = W / tabCount;
  const pillX = useRef(new Animated.Value(state.index * tabWidth)).current;
  const scaleAnimMap = useRef<Map<string, Animated.Value>>(new Map()).current;

  state.routes.forEach((route: any) => {
    if (!scaleAnimMap.has(route.key)) scaleAnimMap.set(route.key, new Animated.Value(1));
  });

  useEffect(() => {
    Animated.spring(pillX, { 
      toValue: state.index * tabWidth, 
      friction: 8, 
      tension: 60, 
      useNativeDriver: true 
    }).start();
    
    const activeKey = state.routes[state.index]?.key;
    const anim = activeKey ? scaleAnimMap.get(activeKey) : undefined;
    if (anim) {
      Animated.sequence([
        Animated.spring(anim, { toValue: 1.22, friction: 4, tension: 120, useNativeDriver: true }),
        Animated.spring(anim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      ]).start();
    }
  }, [state.index, tabWidth, pillX]);

  const bottomPad = Math.max(insets.bottom, 8);

  // ✅ REAL GLASSMORPHISM - Fully transparent with blur
  const glassBg = isDarkMode 
    ? 'rgba(20, 20, 30, 0.6)' 
    : 'rgba(255, 255, 255, 0.5)';
  const glassBorder = isDarkMode 
    ? 'rgba(255, 255, 255, 0.1)' 
    : 'rgba(255, 255, 255, 0.3)';
  const glassShadow = isDarkMode 
    ? 'rgba(0, 0, 0, 0.4)' 
    : 'rgba(0, 0, 0, 0.05)';

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          paddingBottom: bottomPad,
          backgroundColor: 'transparent', // ✅ FULLY TRANSPARENT
          shadowColor: glassShadow,
        }
      ]}
    >
      {/* ✅ Glass layer with blur */}
      <View 
        style={[
          styles.glassLayer,
          { 
            backgroundColor: glassBg,
            borderColor: glassBorder,
          }
        ]} 
      />
      
      {/* ✅ Inner glow */}
      <View 
        style={[
          styles.innerGlow,
          { 
            backgroundColor: isDarkMode 
              ? 'rgba(255, 107, 157, 0.06)' 
              : 'rgba(255, 107, 157, 0.03)'
          }
        ]} 
      />

      <Animated.View
        style={[
          styles.tabPill,
          {
            width: tabWidth * 0.5,
            left: tabWidth * 0.25,
            transform: [{ translateX: pillX }],
            backgroundColor: TAB_CONFIG[state.routes[state.index]?.name]?.color ?? '#FF6B9D',
          },
        ]}
      />

      {state.routes.map((route: any, i: number) => {
        const cfg = TAB_CONFIG[route.name];
        const focused = state.index === i;
        const color = focused ? (cfg?.color ?? '#FF6B9D') : (isDarkMode ? '#998' : '#999');
        const scaleAnim = scaleAnimMap.get(route.key) ?? new Animated.Value(1);

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        const onLongPress = () => { navigation.emit({ type: 'tabLongPress', target: route.key }); };

        return (
          <TouchableOpacity 
            key={route.key} 
            style={[styles.tabItem, { width: tabWidth }]} 
            onPress={onPress} 
            onLongPress={onLongPress} 
            activeOpacity={0.7}
          >
            <Animated.View style={[styles.tabIconWrap, { transform: [{ scale: scaleAnim }] }]}>
              <Icon 
                name={(focused ? cfg?.iconActive : cfg?.icon) as any} 
                size={22} 
                color={color} 
              />
            </Animated.View>
            <Text 
              style={[styles.tabLabel, { color, fontWeight: focused ? '700' : '500' }]} 
              numberOfLines={1}
            >
              {getTabLabel(route.name)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Tabs Layout ────────────────────────────────
export default function TabsLayout() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    // Initialize notifications
    const initNotifications = async () => {
      const notificationService = NotificationService.getInstance();
      await notificationService.initialize();
    };

    initNotifications();

    // Handle notification responses
    const subscription = Notifications.addNotificationResponseReceivedListener(
      response => {
        const data = response.notification.request.content.data;
        if (data.taskId) {
          // Navigate to the task
          console.log('Open task:', data.taskId);
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);
useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user?.id ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);


  return (
    <View style={{ flex: 1 }}>
      {/* NotificationBanner lives here — ONE mount for the whole app, above
          every tab. It uses the real Supabase session user id (never a
          placeholder) and appears on top of whatever screen is active.
          Do NOT also mount it in chat/_layout.tsx — that second instance was
          what caused the "current-user-id is not a real UUID" crash. */}
      {currentUserId && (
        <NotificationBanner
          currentUserId={currentUserId}
          onOpenChat={(chatId) => router.push(`/chat/${chatId}` as any)}
        />
      )}

      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="notes" options={{ title: 'Notes' }} />
        <Tabs.Screen name="memories" options={{ title: 'Memories' }} />
        <Tabs.Screen name="vibe" options={{ title: 'Vibe' }} />
        <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
        <Tabs.Screen name="faith" options={{ title: 'Faith' }} />  
    </Tabs>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────
const styles = StyleSheet.create({
tabBarContainer: {
    flexDirection: 'row',
    paddingTop: 10,
    position: 'absolute',
    paddingBottom: 8,
    borderTopWidth: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 30,
    zIndex: 999,
    // ✅ Curved top edges
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  glassLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    // ✅ iOS blur effect
    ...(Platform.OS === 'ios' && {
      backdropFilter: 'blur(30px)',
    }),
  },
  innerGlow: {
    position: 'absolute',
    top: 0,
    left: '10%',
    right: '10%',
    height: 1.5,
    borderRadius: 2,
  },
  tabPill: { 
    position: 'absolute',
    top: 8, 
    height: 3, 
    borderRadius: 2,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 10,
  },
  tabItem: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 2, 
    gap: 2,
    zIndex: 2,
  },
  tabIconWrap: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    width: 32, 
    height: 32,
  },
  tabLabel: { 
    fontSize: 10, 
    letterSpacing: 0.2,
  },
});
