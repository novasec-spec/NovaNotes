import React, { useContext, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { Tabs } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppContext } from '../_layout';
import { useColors } from '../../hooks/useColors'; // Import the hook


const { width: W } = Dimensions.get('window');
const WHITE = '#FFFFFF';
const TAB_BG = '#FFFFFF';
// ⚠️ Keys MUST match the file names in the (tabs) folder!
const TAB_CONFIG: Record<string, { icon: string; iconActive: string; color: string }> = {
  index: { icon: 'heart-outline', iconActive: 'heart', color: '#FF6B9D' },
  notes: { icon: 'document-text-outline', iconActive: 'document-text', color: '#A855F7' },
  memories: { icon: 'images-outline', iconActive: 'images', color: '#F97316' },
  vibe: { icon: 'happy-outline', iconActive: 'happy', color: '#22C55E' },
  vault: { icon: 'lock-closed-outline', iconActive: 'lock-closed', color: '#3B82F6' },
  chat: { icon: 'chatbubbles-outline', iconActive: 'chatbubbles', color: '#F59E0B' },
  notifications: { icon: 'notifications-outline', iconActive: 'notifications', color: '#F5685' },
};

// Helper to format the label exactly like your original code
const getTabLabel = (name: string) => {
  if (name === 'token') return 'Dev';
  if (name === 'index') return 'Home';
  return name.charAt(0).toUpperCase() + name.slice(1);
};

// ── Custom Tab Bar (Preserved exactly, just updated config keys) ─────────────
function CustomTabBar({ state, navigation }: any) {
  const { PINK, TEXT_SOFT, TAB_BG, BORDER_PINK } = useColors();

  const insets = useSafeAreaInsets();
  const tabCount = state.routes.length;
  const tabWidth = W / tabCount;
  const pillX = useRef(new Animated.Value(state.index * tabWidth)).current;
  const scaleAnimMap = useRef<Map<string, Animated.Value>>(new Map()).current;

  state.routes.forEach((route: any) => {
    if (!scaleAnimMap.has(route.key)) scaleAnimMap.set(route.key, new Animated.Value(1));
  });

  useEffect(() => {
    Animated.spring(pillX, { toValue: state.index * tabWidth, friction: 8, tension: 60, useNativeDriver: true }).start();
    const activeKey = state.routes[state.index]?.key;
    const anim = activeKey ? scaleAnimMap.get(activeKey) : undefined;
    if (anim) {
      Animated.sequence([
        Animated.spring(anim, { toValue: 1.22, friction: 4, tension: 120, useNativeDriver: true }),
        Animated.spring(anim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),      ]).start();
    }
  }, [state.index, tabWidth, pillX]);

  const bottomPad = Math.max(insets.bottom, 8);

  return (
<View style={[
      styles.tabBar,
      {
        paddingBottom: bottomPad,
        backgroundColor: TAB_BG,      // 👈 Overrides the static style
        borderTopColor: BORDER_PINK,  // 👈 Overrides the static style
      }
    ]}>
      <Animated.View
        style={[
          styles.tabPill,
          {
            width: tabWidth * 0.55,
            left: tabWidth * 0.225,
            transform: [{ translateX: pillX }],
            backgroundColor: TAB_CONFIG[state.routes[state.index]?.name]?.color ?? PINK,
          },
        ]}
      />

      {state.routes.map((route: any, i: number) => {
        const cfg = TAB_CONFIG[route.name];
        const focused = state.index === i;
        const color = focused ? (cfg?.color ?? PINK) : TEXT_SOFT; // Uses dynamic TEXT_SOFT/PINK
        const scaleAnim = scaleAnimMap.get(route.key) ?? new Animated.Value(1);

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        const onLongPress = () => { navigation.emit({ type: 'tabLongPress', target: route.key }); };

        return (
          <TouchableOpacity key={route.key} style={[styles.tabItem, { width: tabWidth }]} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.7}>
            <Animated.View style={[styles.tabIconWrap, { transform: [{ scale: scaleAnim }] }]}>
              <Icon name={(focused ? cfg?.iconActive : cfg?.icon) as any} size={22} color={color} />
            </Animated.View>
            <Text style={[styles.tabLabel, { color, fontWeight: focused ? '800' : '500' }]} numberOfLines={1}>
              {getTabLabel(route.name)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Tabs Layout ──────────────────────────────────────────────────────────────
export default function TabsLayout() {  // Read the secret state from the Root Layout context
  const { isSecretVisible } = useContext(AppContext);

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      {/* Names must match the file names in this folder */}
      <Tabs.Screen name="index" options={{ title: '💕 My Love' }} />
      <Tabs.Screen name="notes" options={{ title: '📝 Love Notes' }} />
      <Tabs.Screen name="memories" options={{ title: '📸 Memories' }} />
      <Tabs.Screen name="vibe" options={{ title: "🎵 Today's Vibe" }} />
      <Tabs.Screen name="vault" options={{ title: '🔒 Secret Vault' }} />
    <Tabs.Screen name="notifications" options={{ title: 'Not' }} />
      {/* Conditionally render the Dev tab just like before */}
      {isSecretVisible && (
        <Tabs.Screen name="chat" options={{ title: ' Chat ' }} />
      )}
    </Tabs>
  );
}

// ── Styles (Preserved exactly) ───────────────────────────────────────────────
const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', backgroundColor: TAB_BG, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#FFE4EE', position: 'relative', shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 16 },
  tabPill: { position: 'absolute', top: 6, height: 3, borderRadius: 2 },
  tabItem: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4, gap: 2 },
  tabIconWrap: { alignItems: 'center', justifyContent: 'center', width: 32, height: 32 },
  tabLabel: { fontSize: 9.5, letterSpacing: 0.1 },
});
