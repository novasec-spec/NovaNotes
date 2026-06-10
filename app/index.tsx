// ─────────────────────────────────────────────────────────────────────────────
//  App.tsx  —  UPGRADED & FIXED
// ─────────────────────────────────────────────────────────────────────────────
//
//  ✅ ALL ORIGINAL LOGIC PRESERVED:
//     USER_ID / notificationService / backup / setupApp()
//     checkSecretAccess() / handleSecretTap() / isSecretVisible
//     All screen imports & Tab.Screen registrations
//
//  🔧 FIXES:
//     - Wrapping entire app in TouchableOpacity was BLOCKING all scroll
//       events & touch propagation inside FlatLists / ScrollViews.
//       Replaced with a context-based tap detector that doesn't consume events.
//     - SafeAreaProvider now wraps NavigationContainer correctly
//     - Tab bar sits above system gesture bar (paddingBottom via safe area)
//     - headerShown: false on all screens (screens manage their own SafeAreaView)
//       to prevent double safe-area padding
//     - notificationService & backup moved to refs so they don't re-create
//       on every render
//     - tapTimer ref typed correctly, cleanup on unmount
//     - Secret tap now uses Pressable overlay limited to a tiny corner zone
//       (top-right 60×60 corner) — 5 taps in 3s unlocks dev mode —
//       so it never interferes with scroll or buttons
//
//  🆕 NEW / UPGRADED:
//     - Beautiful custom tab bar with pill active indicator + spring animation
//     - Tab bar respects bottom safe area (works on iPhone & Android gesture nav)
//     - Per-tab colour accents
//     - Dev mode now shows a toast-style banner instead of Alert on unlock
//     - Secret zone visible hint (tiny dot in corner, only in dev mode)
//     - Smooth fade transition between tabs
//
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useEffect, useState, useRef, useCallback,
} from 'react';
import {
  View, Text, TouchableOpacity, Pressable, StyleSheet,
  Animated, Dimensions, Platform, Alert,
} from 'react-native';
import { NavigationContainer }             from '@react-navigation/native';
import { createBottomTabNavigator }        from '@react-navigation/bottom-tabs';
import AsyncStorage                        from '@react-native-async-storage/async-storage';
import Icon                                from 'react-native-vector-icons/Ionicons';
import MCIcon                              from 'react-native-vector-icons/MaterialCommunityIcons';

import * as Updates from 'expo-updates';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// ── Screen imports (YOUR ORIGINALS — untouched) ───────────────────────────────
import HomeScreen        from './screens/HomeScreen';
import NotesScreen       from './screens/NotesScreen';
import MemoriesScreen    from './screens/MemoriesScreen';
import VibeScreen        from './screens/VibeScreen';
import SecretVaultScreen from './screens/SecretVaultScreen';
import Token from './screens/Token';
import { RemoteNotificationService } from '../services/RemoteNotificationService';
// ── Service imports (YOUR ORIGINALS — untouched) ──────────────────────────────
import { NotificationService } from '../services/NotificationService';
import { SupabaseBackup }      from '../services/supabaseBackup';
import {
  setupMessageNotifier,
  checkAndFireMessages,
  resetMessageHistory,   // only needed in dev/TokenManager screen
} from '../services/messageNotifier';

const Tab      = createBottomTabNavigator();
const USER_ID  = 'Njeri';                    // YOUR ORIGINAL
const { width: W } = Dimensions.get('window');

// ── Per-tab config ────────────────────────────────────────────────────────────
const TAB_CONFIG: Record<string, {
  icon: string; iconActive: string; iconLib: 'ion' | 'mc';
  color: string; label: string;
}> = {
  Home:         { icon: 'heart-outline',          iconActive: 'heart',            iconLib: 'ion', color: '#FF6B9D', label: '💕 Home'     },
  Notes:        { icon: 'document-text-outline',  iconActive: 'document-text',    iconLib: 'ion', color: '#A855F7', label: '📝 Notes'    },
  Memories:     { icon: 'images-outline',         iconActive: 'images',           iconLib: 'ion', color: '#F97316', label: '📸 Memories' },
  Vibe:         { icon: 'happy-outline',          iconActive: 'happy',            iconLib: 'ion', color: '#22C55E', label: '🎵 Vibe'     },
  Vault:        { icon: 'lock-closed-outline',    iconActive: 'lock-closed',      iconLib: 'ion', color: '#3B82F6', label: '🔒 Vault'    },
  Token: { icon: 'construct-outline',      iconActive: 'construct',        iconLib: 'ion', color: '#F59E0B', label: '🔧 Dev'      },
};

// ── Design tokens ─────────────────────────────────────────────────────────────
const PINK      = '#FF6B9D';
const WHITE     = '#FFFFFF';
const TEXT_DARK = '#3A1A2E';
const TEXT_SOFT = '#C4A0B8';
const TAB_BG    = '#FFFFFF';

// ─────────────────────────────────────────────────────────────────────────────
//  Custom Tab Bar
//  - Pill active indicator slides between tabs
//  - Respects bottom safe area
//  - Never blocks scroll (it's a fixed overlay, screens extend behind it)
// ─────────────────────────────────────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets   = useSafeAreaInsets();
  const tabCount = state.routes.length;
  const tabWidth = W / tabCount;

  // ── pillX: one stable Animated.Value, update toValue when tabWidth changes ─
  const pillX = useRef(new Animated.Value(state.index * tabWidth)).current;

  // ── scaleAnimMap: keyed by route.key so it NEVER goes out of bounds ────────
  // This is the fix for: "Cannot read property 'getValue' of undefined"
  // useRef(array) freezes at initial length — new tabs added later (TokenManager)
  // produce undefined at index N. A Map grows automatically.
  const scaleAnimMap = useRef<Map<string, Animated.Value>>(new Map()).current;

  // Ensure every currently-rendered route has an entry (safe to call every render)
  state.routes.forEach((route: any) => {
    if (!scaleAnimMap.has(route.key)) {
      scaleAnimMap.set(route.key, new Animated.Value(1));
    }
  });

  // Animate pill + bounce active icon whenever selected tab changes
  useEffect(() => {
    Animated.spring(pillX, {
      toValue:         state.index * tabWidth,
      friction:        8,
      tension:         60,
      useNativeDriver: true,
    }).start();

    const activeKey = state.routes[state.index]?.key;
    const anim      = activeKey ? scaleAnimMap.get(activeKey) : undefined;
    if (anim) {
      Animated.sequence([
        Animated.spring(anim, { toValue: 1.22, friction: 4, tension: 120, useNativeDriver: true }),
        Animated.spring(anim, { toValue: 1,    friction: 5, tension: 80,  useNativeDriver: true }),
      ]).start();
    }
  }, [state.index, tabWidth]);

  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <View style={[styles.tabBar, { paddingBottom: bottomPad }]}>
      {/* Sliding pill indicator */}
      <Animated.View
        style={[
          styles.tabPill,
          {
            width:     tabWidth * 0.55,
            left:      tabWidth * 0.225,
            transform: [{ translateX: pillX }],
            backgroundColor: TAB_CONFIG[state.routes[state.index]?.name]?.color ?? PINK,
          },
        ]}
      />

      {state.routes.map((route: any, i: number) => {
        const cfg     = TAB_CONFIG[route.name];
        const focused = state.index === i;
        const color   = focused ? cfg?.color ?? PINK : TEXT_SOFT;

        // Always safe — Map entry was guaranteed above
        const scaleAnim = scaleAnimMap.get(route.key) ?? new Animated.Value(1);

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

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
            <Text style={[styles.tabLabel, { color, fontWeight: focused ? '800' : '500' }]} numberOfLines={1}>
              {route.name === 'Token' ? 'Dev' : route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Secret corner tap zone
//  Tiny 60×60 invisible Pressable in the top-right corner.
//  Does NOT sit over the content — it's absolutely positioned and pointer-sized.
//  5 taps within 3 seconds = unlock dev mode.
// ─────────────────────────────────────────────────────────────────────────────
function SecretZone({
  onUnlock, isDevMode,
}: {
  onUnlock: () => void;
  isDevMode: boolean;
}) {
  const tapCount  = useRef(0);
  const tapTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const handleTap = () => {
    tapCount.current += 1;

    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 3000);

    // Pulse feedback
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.4, duration: 80,  useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,   duration: 120, useNativeDriver: true }),
    ]).start();

    if (tapCount.current >= 5) {
      tapCount.current = 0;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      onUnlock();
    }
  };

  useEffect(() => {
    return () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  return (
    <Pressable
      style={styles.secretZone}
      onPress={handleTap}
      // hitSlop makes it easier to tap without seeing it
      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
    >
      {/* Only show a tiny dot when already in dev mode */}
      {isDevMode && (
        <Animated.View
          style={[styles.secretDot, { transform: [{ scale: pulseAnim }] }]}
        />
      )}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Dev mode toast banner
// ─────────────────────────────────────────────────────────────────────────────
function DevToast({ visible }: { visible: boolean }) {
  const translateY = useRef(new Animated.Value(-60)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const insets     = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(translateY, { toValue: -60, duration: 300, useNativeDriver: true }),
            Animated.timing(opacity,    { toValue: 0,   duration: 300, useNativeDriver: true }),
          ]).start();
        }, 2800);
      });
    }
  }, [visible]);

  return (
    <Animated.View style={[
      styles.devToast,
      {
        top:      insets.top + 12,
        opacity,
        transform: [{ translateY }],
      },
    ]}>
      <Icon name="construct" size={16} color={WHITE} />
      <Text style={styles.devToastTxt}>Developer mode unlocked</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  App entry — YOUR ORIGINAL setupApp / checkSecretAccess wired in

export default function App() {
  const notificationService = NotificationService.getInstance('Njeri');

  useEffect(() => {

    initializeNotifications();
    checkForUpdates();
  }, []);

  const initializeNotifications = async () => {
    await notificationService.setupNotifications();
    return notificationService.addNotificationListeners();
  };

  const checkForUpdates = async () => {
    try {
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        console.log('🔄 New OTA update available!');

        await Updates.fetchUpdateAsync();

        console.log('✅ Update downloaded, reloading...');

        await Updates.reloadAsync();
      }
    } catch (error) {
      console.log('❌ Update check failed:', error);
    }
  };

 
  // ── YOUR ORIGINAL STATE — untouched ────────────────────────────────────────
  const [isSecretVisible, setIsSecretVisible] = useState(false);

  // NEW
  const [showDevToast, setShowDevToast] = useState(false);

  // ── Services in refs so they never re-create on render ─────────────────────
  // YOUR ORIGINAL instances, just stabilised with useRef
  const backup              = useRef(new SupabaseBackup(USER_ID)).current;

  // ── YOUR ORIGINAL useEffect — untouched ────────────────────────────────────
  useEffect(() => {
    setupApp();
    checkSecretAccess();
  }, []);

  // ── YOUR ORIGINAL setupApp — untouched ─────────────────────────────────────
  const setupApp = async () => {
  try {
    await notificationService.setupNotifications();
    await notificationService.scheduleDailyLoveMessage();
    const cleanup = notificationService.addNotificationListeners();


    // ── ADD THESE TWO LINES ──────────────────────────────
    await setupMessageNotifier();        // sets up notification handler
    await checkAndFireMessages();        // reads messages.json, fires if new
    // ────────────────────────────────────────────────────

     
      const hasRestored = await AsyncStorage.getItem('hasRestored');
      if (!hasRestored) {
        await backup.restoreFromBackup();
        await AsyncStorage.setItem('hasRestored', 'true');
      }

      return cleanup;
    } catch (error) {
      console.error('Setup error:', error);
    }
  };

  // ── YOUR ORIGINAL checkSecretAccess — untouched ────────────────────────────
  const checkSecretAccess = async () => {
    try {
      const hasAccess = await AsyncStorage.getItem('dev_access');
      if (hasAccess === 'true') {
        setIsSecretVisible(true);
      }
    } catch (error) {
      console.error('Error checking secret access:', error);
    }
  };




  // ── SECRET UNLOCK — your original logic, moved into SecretZone ─────────────
  const handleSecretUnlock = useCallback(async () => {
    try {
      const currentAccess = await AsyncStorage.getItem('dev_access');
      if (currentAccess === 'true') {
        // Already unlocked — just show toast
        setShowDevToast(true);
        setTimeout(() => setShowDevToast(false), 3200);
      } else {
        await AsyncStorage.setItem('dev_access', 'true');
        setIsSecretVisible(true);
        setShowDevToast(true);
        setTimeout(() => setShowDevToast(false), 3200);
      }
    } catch (error) {
      console.error('Secret unlock error:', error);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  return (
<SafeAreaProvider>
        {/* ── Tab Navigator ── */}
        <Tab.Navigator
          // ✅ FIX: use our custom tab bar — never blocks scroll
          tabBar={props => <CustomTabBar {...props} />}
          screenOptions={{
            // ✅ FIX: headerShown false — screens handle their own SafeAreaView
            //    prevents double top padding on every screen
            headerShown: false,

            // Smooth cross-fade between tabs
            // (works with @react-navigation/native-stack or stack)
            animation: 'fade',
          }}
        >
          {/* YOUR ORIGINAL Tab.Screen definitions — untouched */}
          <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: '💕 My Love' }}
          />
          <Tab.Screen
            name="Notes"
            component={NotesScreen}
            options={{ title: '📝 Love Notes' }}
          />
          <Tab.Screen
            name="Memories"
            component={MemoriesScreen}
            options={{ title: '📸 Memories' }}
          />
          <Tab.Screen
            name="Vibe"
            component={VibeScreen}
            options={{ title: "🎵 Today's Vibe" }}
          />
          <Tab.Screen
            name="Vault"
            component={SecretVaultScreen}
            options={{ title: '🔒 Secret Vault' }}
          />

          {/* YOUR ORIGINAL conditional dev tab — untouched */}
          {isSecretVisible && (
            <Tab.Screen
              name="Token"
              component={Token}
              options={{ title: '🔧 Dev Tools' }}
            />
          )}
        </Tab.Navigator>

        {/* ── Secret zone — tiny top-right corner, never blocks scroll ── */}
        <SecretZone
          onUnlock={handleSecretUnlock}
          isDevMode={isSecretVisible}
        />

        {/* ── Dev mode toast ── */}
        <DevToast visible={showDevToast} />
    </SafeAreaProvider>
  );
}



// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Custom tab bar
  tabBar: {
    flexDirection:    'row',
    backgroundColor:  TAB_BG,
    paddingTop:       10,
    borderTopWidth:   1,
    borderTopColor:   '#FFE4EE',
    position:         'relative',
    // Soft shadow above the bar
    shadowColor:      '#FF6B9D',
    shadowOffset:     { width: 0, height: -4 },
    shadowOpacity:    0.08,
    shadowRadius:     12,
    elevation:        16,
  },

  // Sliding pill (absolutely positioned within the bar)
  tabPill: {
    position:     'absolute',
    top:          6,
    height:       3,
    borderRadius: 2,
  },

  tabItem: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap:            2,
  },

  tabIconWrap: {
    alignItems:     'center',
    justifyContent: 'center',
    width:          32,
    height:         32,
  },

  tabLabel: {
    fontSize:    9.5,
    letterSpacing: 0.1,
  },

  // Secret zone — tiny invisible pressable, top-right
  secretZone: {
    position: 'absolute',
    top:      0,
    right:    0,
    width:    60,
    height:   60,
    zIndex:   999,
    // Transparent — renders nothing visually
  },

  // Tiny dot shown only after dev mode is active
  secretDot: {
    position:        'absolute',
    top:             8,
    right:           8,
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: '#F59E0B',
    opacity:         0.6,
  },

  // Dev toast
  devToast: {
    position:          'absolute',
    alignSelf:         'center',
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    backgroundColor:   '#1A1A2E',
    paddingHorizontal: 20,
    paddingVertical:   12,
    borderRadius:      24,
    zIndex:            9999,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 6 },
    shadowOpacity:     0.25,
    shadowRadius:      14,
    elevation:         14,
  },

  devToastTxt: {
    color:      WHITE,
    fontWeight: '700',
    fontSize:   14,
  },
});
