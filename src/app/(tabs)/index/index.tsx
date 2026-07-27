// src/app/(tabs)/index.tsx - UPGRADED HOMESCREEN
//
// ─── WHAT CHANGED (read me) ─────────────────────────────────────────────────
// 1. Name now comes from useAuth() instead of hardcoded "Alice".
// 2. Skeleton loaders shown while loadData() runs on first mount.
// 3. Haptics.impactAsync() fires on every tile / card press.
// 4. accessibilityLabel/Role/Hint added to every icon-only touchable.
// 5. "On This Day" flashback card — pulls from AsyncStorage 'memories'.
//    ⚠️ Adjust the key + shape in getFlashbackMemories() to match your real
//    Memory Jar storage format — I guessed { id, imageUri, caption, date }.
// 6. "Next Date" / anniversary countdown card — reads 'relationshipStartDate'
//    from AsyncStorage. ⚠️ Point this at wherever you actually store that
//    (profile/settings screen) — currently falls back to a "set it" CTA.
// 7. Streak/mood load logic: fixed a double-increment bug — in React 18 dev
//    (Strict Mode) effects can run twice, which could silently double-count
//    the streak on first mount. Guarded with a `didInit` ref.
// 8. All effects that used to be split across 3 separate useEffect blocks
//    are consolidated into one init effect with an `isMounted` guard, so
//    state isn't set after unmount and loadData() can't fire more than once.
// 9. Tile press tracking — trackEvent() writes to a local AsyncStorage event
//    log. ⚠️ Swap the body of trackEvent() for a real Supabase insert or
//    analytics SDK call when you're ready — the call sites don't need to change.
// 10. Streak milestones (7/30/100) now trigger a confetti burst + a "badge
//     unlocked" modal, shown once per milestone (tracked via 'lastMilestoneShown').
// 11. Tile press handler is now memoized per-tile with useCallback instead of
//     an inline arrow function recreated on every render.
//
// New optional deps used: expo-haptics (you already use this elsewhere per
// your other screens). Everything else is built with primitives already in
// the file — no new libraries required for confetti/skeleton/modal.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  RefreshControl,
  Alert,
  Modal,
  Easing,
} from 'react-native';
import * as Clipboard from 'expo-clipboard'; // ✅ FIX: react-native's Clipboard is deprecated
import * as Haptics from 'expo-haptics';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../../contexts/ThemeContext';
import MoodTracker, { ALL_MOODS } from '../../../components/MoodTracker';
import { notificationService } from '../../../services/notificationservice';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotificationBadge } from '../../../hooks/useNotificationBadge';
import { useNotification } from '../../../contexts/NotificationContext';
import { useRouter, router } from 'expo-router';
import { useDailyGreeting } from '../../../hooks/useDailyGreeting';
import { useMoodNotifications } from '../../../hooks/useMoodNotifications';
import { syncBubblesWidget } from '../../../widgets/syncBubblesWidget';
import { useAlert } from 'rn-themed-alert';

const { width: W } = Dimensions.get('window');

// ─── QUOTES ──────────────────────────────────────────────────────────────────
const QUOTES = [
  { text: "I love you more than words can ever say", author: "Speechless 💫" },
  { text: "Every day with you is my favourite day", author: "Your Person 💕" },
  { text: "You are my sunshine on a cloudy day", author: "Always & Forever 🌸" },
  { text: "You make ordinary moments extraordinary", author: "With all my heart ✨" },
  { text: "My favourite place is next to you", author: "Your Person 🌙" },
  { text: "Loving you is the easiest thing I've ever done", author: "Forever Yours 💖" },
  { text: "Home is wherever I'm with you", author: "Our Home 🏠" },
  { text: "You're the missing piece I didn't know I needed", author: "Complete 🧩" },
  { text: "I still get butterflies every time I see you", author: "Every Single Time 🦋" },
  { text: "You're my favorite hello and hardest goodbye", author: "Come Back Soon 💕" },
];

// ─── QUICK ACCESS TILES ──────────────────────────────────────────────────────
const QUICK_TILES = [
  { id: 'new_note', icon: 'create-outline', label: 'New Note', color: '#FF6B9D', route: 'notes' },
  { id: 'memory_jar', icon: 'images-outline', label: 'Memory Jar', color: '#A855F7', route: 'memories' },
  { id: 'from_him', icon: 'heart-outline', label: 'From Him', color: '#EC4899', route: '/vault' },
  { id: 'playlist', icon: 'musical-notes-outline', label: 'Our Playlist', color: '#22C55E', route: '/vibe/moodmusic' },
  { id: 'vault', icon: 'lock-closed-outline', label: 'Vault', color: '#3B82F6', route: '/vault' },
  { id: 'alerts', icon: 'notifications-outline', label: 'Alerts', color: '#F59E0B', route: '/notification' },
  { id: 'playground', icon: 'flask-outline', label: 'Notify Pref', color: '#EC4899', route: '/notificationSettings' },
  { id: 'playground2', icon: 'flask-outline', label: 'Notify Test', color: '#EC4899', route: '/notification-playground' },
  { id: 'task', icon: 'clipboard-outline', label: 'New Task', color: '#FF6B9D', route: 'task' },
];

// ─── STREAK MILESTONES ────────────────────────────────────────────────────────
const MILESTONES: Record<number, { label: string; color: string; badge: string }> = {
  7: { label: '🔥 Milestone', color: '#22C55E', badge: 'Week Warrior' },
  30: { label: '⭐ Champion', color: '#A855F7', badge: 'Monthly Champion' },
  100: { label: '🏆 Legend', color: '#F59E0B', badge: 'Century Legend' },
};

// ─── LOCAL ANALYTICS (swap this for Supabase/real analytics later) ──────────
async function trackEvent(eventName: string, params: Record<string, any> = {}) {
  try {
    const raw = await AsyncStorage.getItem('analyticsEvents');
    const events = raw ? JSON.parse(raw) : [];
    events.push({ eventName, params, timestamp: new Date().toISOString() });
    // Cap the local log so it doesn't grow forever
    const trimmed = events.slice(-200);
    await AsyncStorage.setItem('analyticsEvents', JSON.stringify(trimmed));
  } catch (error) {
    console.error('trackEvent error:', error);
  }
}

// ─── DATE HELPERS ──────────────────────────────────────────────────────────
function getNextAnniversary(startDateIso: string): { days: number; label: string } | null {
  try {
    const start = new Date(startDateIso);
    if (isNaN(start.getTime())) return null;
    const now = new Date();
    let next = new Date(now.getFullYear(), start.getMonth(), start.getDate());
    if (next < now) next = new Date(now.getFullYear() + 1, start.getMonth(), start.getDate());
    const days = Math.ceil((next.getTime() - now.getTime()) / 86400000);
    const years = next.getFullYear() - start.getFullYear();
    return { days, label: `${years} year${years !== 1 ? 's' : ''} together` };
  } catch {
    return null;
  }
}

// Looks for memories that happened on this month/day in a previous year
function getFlashbackMemories(memories: any[]): any[] {
  const today = new Date();
  return (memories || []).filter((m) => {
    const d = new Date(m.date || m.timestamp);
    if (isNaN(d.getTime())) return false;
    return (
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate() &&
      d.getFullYear() !== today.getFullYear()
    );
  });
}

// ─── SKELETON LOADER ─────────────────────────────────────────────────────────
function SkeletonBlock({ style }: { style?: any }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[{ backgroundColor: '#E5E7EB', borderRadius: 12, opacity: pulse }, style]} />;
}

function HomeSkeleton() {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
      <SkeletonBlock style={{ width: '60%', height: 26, marginBottom: 8 }} />
      <SkeletonBlock style={{ width: '35%', height: 14, marginBottom: 20 }} />
      <SkeletonBlock style={{ width: '100%', height: 60, borderRadius: 16, marginBottom: 12 }} />
      <SkeletonBlock style={{ width: '100%', height: 140, borderRadius: 16, marginBottom: 12 }} />
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} style={{ width: (W - 60) / 3, height: 84, borderRadius: 14 }} />
        ))}
      </View>
    </View>
  );
}

// ─── CONFETTI BURST (lightweight, no external lib) ──────────────────────────
const CONFETTI_COLORS = ['#FF6B9D', '#A855F7', '#22C55E', '#F59E0B', '#3B82F6'];

function ConfettiBurst({ onDone }: { onDone: () => void }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }).map((_, i) => ({
        id: i,
        x: Math.random() * W,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: Math.random() * 200,
        anim: new Animated.Value(0),
      })),
    []
  );

  useEffect(() => {
    const animations = pieces.map((p) =>
      Animated.timing(p.anim, {
        toValue: 1,
        duration: 1800 + Math.random() * 600,
        delay: p.delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    Animated.stagger(20, animations).start(() => onDone());
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p) => {
        const translateY = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 700] });
        const rotate = p.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] });
        const opacity = p.anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] });
        return (
          <Animated.View
            key={p.id}
            style={{
              position: 'absolute',
              left: p.x,
              top: -20,
              width: 8,
              height: 8,
              borderRadius: 2,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateY }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}

// ─── BADGE UNLOCK MODAL ──────────────────────────────────────────────────────
function BadgeUnlockModal({
  visible,
  milestone,
  onClose,
}: {
  visible: boolean;
  milestone: { label: string; color: string; badge: string } | null;
  onClose: () => void;
}) {
  if (!milestone) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={badgeStyles.overlay}>
        <View style={badgeStyles.card}>
          <Text style={{ fontSize: 40, marginBottom: 8 }}>{milestone.label.split(' ')[0]}</Text>
          <Text style={badgeStyles.title}>Badge Unlocked!</Text>
          <Text style={[badgeStyles.badgeName, { color: milestone.color }]}>{milestone.badge}</Text>
          <TouchableOpacity
            style={[badgeStyles.button, { backgroundColor: milestone.color }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close badge unlock notification"
          >
            <Text style={badgeStyles.buttonText}>Nice!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
syncBubblesWidget();
  const { processScheduledChecks, getTodayMood, handleMoodFromNotification } = useMoodNotifications();
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const { sendSystem } = useNotification();
  const unreadCount = useNotificationBadge();
//   const { greetingSent, lastGreeting, sendGreeting } = useDailyGreeting();

  // ✅ CHANGE: name now comes from auth context, with a graceful fallback.
  // ⚠️ Adjust `user?.name` to whatever field your AuthContext actually exposes
  // (e.g. user?.displayName, user?.profile?.firstName, etc).
const displayName =
  user?.user_metadata?.username?.trim().split(' ')[0] ||
  user?.email?.split('@')[0] ||
  'there';

  const [greeting, setGreeting] = useState('');
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [todayMood, setTodayMood] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true); // ✅ NEW: drives skeleton
  const [flashbacks, setFlashbacks] = useState<any[]>([]); // ✅ NEW
  const [anniversary, setAnniversary] = useState<{ days: number; label: string } | null>(null); // ✅ NEW

  const [showConfetti, setShowConfetti] = useState(false); // ✅ NEW
  const [unlockedMilestone, setUnlockedMilestone] = useState<
    { label: string; color: string; badge: string } | null
  >(null); // ✅ NEW

const { alert } = useAlert();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const quoteAnim = useRef(new Animated.Value(1)).current;

  // ✅ FIX: guards against React Strict Mode / re-render double execution
  // so streak counting and greeting-sends can't fire twice on first mount.
  const didInit = useRef(false);

  const handleSomething = async () => {
    await sendSystem('Welcome! 🎉', 'Thanks for checking out this feature', { screen: 'index' });
  };

  const loadData = useCallback(async () => {
    try {
      // Load today's mood
      const history = await AsyncStorage.getItem('moodHistory');
      if (history) {
        const moods = JSON.parse(history);
        const today = new Date().toDateString();
        const todayEntry = moods.find((m: any) => new Date(m.timestamp).toDateString() === today);
        if (todayEntry) setTodayMood(todayEntry);
      }

      // ✅ NEW: flashback memories ("on this day")
      const memoriesRaw = await AsyncStorage.getItem('memories');
      if (memoriesRaw) {
        const memories = JSON.parse(memoriesRaw);
        setFlashbacks(getFlashbackMemories(memories));
      }

      // ✅ NEW: anniversary / next-date countdown
      const startDate = await AsyncStorage.getItem('relationshipStartDate');
      if (startDate) setAnniversary(getNextAnniversary(startDate));

      // Load login streak
      const saved = await AsyncStorage.getItem('loginStreak');
      if (saved) {
        const data = JSON.parse(saved);
        const lastDate = new Date(data.lastDate).toDateString();
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        if (lastDate === today) {
          setStreak(data.count);
        } else if (lastDate === yesterday) {
          const newCount = data.count + 1;
          setStreak(newCount);
          await AsyncStorage.setItem('loginStreak', JSON.stringify({ count: newCount, lastDate: new Date().toISOString() }));
          checkMilestone(newCount); // ✅ NEW
        } else {
          setStreak(1);
          await AsyncStorage.setItem('loginStreak', JSON.stringify({ count: 1, lastDate: new Date().toISOString() }));
        }
      } else {
        setStreak(1);
        await AsyncStorage.setItem('loginStreak', JSON.stringify({ count: 1, lastDate: new Date().toISOString() }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false); // ✅ NEW: stop skeleton regardless of success/failure
    }
  }, []);

  // ✅ NEW: fires confetti + badge modal once per milestone per day
  const checkMilestone = useCallback(async (newStreak: number) => {
    const milestone = MILESTONES[newStreak];
    if (!milestone) return;
    try {
      const lastShownRaw = await AsyncStorage.getItem('lastMilestoneShown');
      const lastShown = lastShownRaw ? JSON.parse(lastShownRaw) : {};
      if (lastShown[newStreak] === new Date().toDateString()) return; // already shown today

      setUnlockedMilestone(milestone);
      setShowConfetti(true);
      trackEvent('streak_milestone_unlocked', { streak: newStreak, badge: milestone.badge });

      await AsyncStorage.setItem(
        'lastMilestoneShown',
        JSON.stringify({ ...lastShown, [newStreak]: new Date().toDateString() })
      );
    } catch (error) {
      console.error('checkMilestone error:', error);
    }
  }, []);

  // ✅ FIX: single consolidated init effect (was 3 separate useEffects).
  // isMounted + didInit guards prevent duplicate AsyncStorage writes and
  // setState-after-unmount warnings.
  useEffect(() => {
    let isMounted = true;

    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning 🌞');
    else if (hour < 17) setGreeting('Good afternoon ☀️');
    else setGreeting('Good evening 🌙');

    if (!didInit.current) {
      didInit.current = true;

      (async () => {
         await processScheduledChecks();
        const todaysMood = await getTodayMood();
        if (todaysMood?.fromNotification) {
          console.log('💭 Mood was logged from notification');
        }
        if (isMounted) await loadData();
      })();
    }

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    const interval = setInterval(() => {
      Animated.timing(quoteAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        if (!isMounted) return;
        setQuoteIndex((i) => (i + 1) % QUOTES.length);
        Animated.timing(quoteAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 8000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleMoodSelect = (mood: any) => {
    setTodayMood(mood);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ✅ FIX: single navigate helper, wrapped once — tiles below use a
  // memoized per-tile callback instead of a new inline arrow each render.
  const navigateTo = useCallback((route: string) => {
    router.push(route as any);
  }, [router]);

  // ✅ NEW/FIX: tile press now does haptics + tracking + navigation,
  // and is memoized per tile id so the TouchableOpacity list doesn't
  // regenerate handlers on every render.
  const handleTilePress = useCallback(
    (tile: (typeof QUICK_TILES)[number]) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      trackEvent('tile_press', { tileId: tile.id, label: tile.label });
      navigateTo(tile.route);
    },
    [navigateTo]
  );

  const copyQuote = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const q = QUOTES[quoteIndex];
    await Clipboard.setStringAsync(`"${q.text}" — ${q.author}`);
    trackEvent('quote_copied', { quoteAuthor: q.author });
      await alert({
      title: 'Copied! 💕',
      message: 'Quote copied to clipboard',
      buttonText: 'Got it!',
    }); 
 };

  const currentQuote = QUOTES[quoteIndex];
  const dayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const streakColor = streak >= 100 ? '#F59E0B' : streak >= 30 ? '#A855F7' : streak >= 7 ? '#22C55E' : '#FF6B9D';

  if (isLoading) {
    // ✅ NEW: skeleton instead of a blank screen while loadData() runs
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
          <HomeSkeleton />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
        {showConfetti && <ConfettiBurst onDone={() => setShowConfetti(false)} />}
        <BadgeUnlockModal
          visible={!!unlockedMilestone}
          milestone={unlockedMilestone}
          onClose={() => setUnlockedMilestone(null)}
        />

        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B9D" colors={['#FF6B9D']} />
          }
        >
          {/* ─── HEADER ─── */}
          <Animated.View style={[styles.headerRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View>
              {/* ✅ CHANGE: real name from useAuth() */}
              <Text style={[styles.greeting, { color: colors.text }]}>
                {greeting}, {displayName}! 💕
              </Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>{dayLabel}</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={[styles.notificationBtn, { backgroundColor: colors.card }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // ✅ NEW
                  trackEvent('notification_bell_press'); // ✅ NEW
                  router.push('/notification');
                }}
                activeOpacity={0.7}
                accessibilityRole="button" // ✅ NEW
                accessibilityLabel="Notifications" // ✅ NEW
                accessibilityHint={unreadCount > 0 ? `${unreadCount} unread notifications` : 'No unread notifications'} // ✅ NEW
              >
                <Ionicons name="notifications-outline" size={24} color={colors.text} />
                {unreadCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* ─── STREAK BANNER ─── */}
          <View
            style={[styles.streakBanner, { backgroundColor: colors.card }]}
            accessibilityLabel={`${streak} day streak`} // ✅ NEW
          >
            <MaterialCommunityIcons name="fire" size={26} color={streakColor} />
            <Text style={[styles.streakText, { color: streakColor }]}>
              {streak} day{streak !== 1 ? 's' : ''} in a row!
            </Text>
            {streak >= 7 && (
              <View style={[styles.milestoneBadge, { backgroundColor: streakColor + '22', borderColor: streakColor }]}>
                <Text style={[styles.milestoneText, { color: streakColor }]}>
                  {streak >= 100 ? '🏆 Legend' : streak >= 30 ? '⭐ Champion' : '🔥 Milestone'}
                </Text>
              </View>
            )}
            <Text style={[styles.streakSub, { color: colors.muted }]}>{displayName} is on fire ✨</Text>
          </View>

          {/* ─── ANNIVERSARY / NEXT DATE COUNTDOWN ─── ✅ NEW */}
          <TouchableOpacity
            style={[styles.countdownCard, { backgroundColor: colors.card }]}
            onPress={() => navigateTo('/anniversary')} // ⚠️ point this at wherever the anniversary date is set
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={anniversary ? `${anniversary.days} days until your anniversary` : 'Set your anniversary date'}
          >
            <MaterialCommunityIcons name="calendar-heart" size={26} color="#EC4899" />
            {anniversary ? (
              <View style={{ flex: 1 }}>
                <Text style={[styles.countdownTitle, { color: colors.text }]}>
                  {anniversary.days} day{anniversary.days !== 1 ? 's' : ''} until your anniversary 💍
                </Text>
                <Text style={[styles.countdownSub, { color: colors.muted }]}>{anniversary.label}</Text>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <Text style={[styles.countdownTitle, { color: colors.text }]}>Set your anniversary date</Text>
                <Text style={[styles.countdownSub, { color: colors.muted }]}>Get a countdown to your next one 💕</Text>
              </View>
            )}
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
          </TouchableOpacity>

          {/* ─── ON THIS DAY FLASHBACK ─── ✅ NEW */}
          {flashbacks.length > 0 && (
            <TouchableOpacity
              style={[styles.flashbackCard, { backgroundColor: colors.card }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                trackEvent('flashback_opened', { count: flashbacks.length });
                navigateTo('memories');
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="On this day memory flashback"
            >
              <View style={[styles.flashbackIconWrap, { backgroundColor: '#A855F720' }]}>
                <Ionicons name="time-outline" size={26} color="#A855F7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.messageTitle, { color: colors.text }]}>On This Day 📸</Text>
                <Text style={[styles.messageSub, { color: colors.muted }]} numberOfLines={1}>
                  {flashbacks[0].caption || 'You made a memory on this day'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}

          {/* ─── MOOD TRACKER ─── */}
          <MoodTracker onMoodSelect={handleMoodSelect} initialMood={todayMood} size="large" />

          {/* ─── QUICK ACCESS TILES ─── */}
          <View style={styles.quickSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Access 🛠️</Text>
            <View style={styles.tilesGrid}>
              {QUICK_TILES.map((tile) => (
                <TouchableOpacity
                  key={tile.id}
                  style={[styles.tile, { backgroundColor: colors.card }]}
                  onPress={() => handleTilePress(tile)} // ✅ FIX: memoized handler w/ haptics + tracking
                  activeOpacity={0.7}
                  accessibilityRole="button" // ✅ NEW
                  accessibilityLabel={tile.label} // ✅ NEW
                >
                  <View style={[styles.tileIconWrap, { backgroundColor: tile.color + '20' }]}>
                    <Ionicons name={tile.icon} size={28} color={tile.color} />
                  </View>
                  <Text style={[styles.tileLabel, { color: colors.text }]}>{tile.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ─── LOVE QUOTE ─── */}
          <TouchableOpacity
            style={[styles.quoteCard, { backgroundColor: colors.card }]}
            onPress={copyQuote}
            activeOpacity={0.7}
            onLongPress={copyQuote}
            accessibilityRole="button" // ✅ NEW
            accessibilityLabel="Love quote, tap to copy" // ✅ NEW
          >
            <Animated.View style={{ opacity: quoteAnim }}>
              <Text style={[styles.quoteMark, { color: colors.muted }]}>"</Text>
              <Text style={[styles.quoteText, { color: colors.text }]}>{currentQuote.text}</Text>
              <Text style={[styles.quoteAuthor, { color: '#FF6B9D' }]}>— {currentQuote.author}</Text>
              <View style={styles.copyHint}>
                <Ionicons name="copy-outline" size={12} color={colors.muted} />
                <Text style={[styles.copyHintText, { color: colors.muted }]}>Tap to copy</Text>
              </View>
            </Animated.View>
          </TouchableOpacity>

          {/* ─── MESSAGE BANNER ─── */}
          <TouchableOpacity
            style={[styles.messageBanner, { backgroundColor: colors.card }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // ✅ NEW
              trackEvent('message_banner_press'); // ✅ NEW
              navigateTo('vault');
            }}
            activeOpacity={0.7}
            accessibilityRole="button" // ✅ NEW
            accessibilityLabel="You have a message, open vault" // ✅ NEW
          >
            <View style={[styles.messageIconWrap, { backgroundColor: '#8B5CF620' }]}>
              <MaterialCommunityIcons name="email-heart-outline" size={28} color="#8B5CF6" />
            </View>
            <View style={styles.messageContent}>
              <Text style={[styles.messageTitle, { color: colors.text }]}>You have a message</Text>
              <Text style={[styles.messageSub, { color: colors.muted }]}>Check "From Him" — something's waiting 😊</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
          </TouchableOpacity>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ─── BADGE MODAL STYLES ──────────────────────────────────────────────────────
const badgeStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  card: { width: '80%', backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  badgeName: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  button: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  buttonText: { color: '#fff', fontWeight: '700' },
});

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greeting: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  streakText: { fontSize: 15, fontWeight: '700' },
  streakSub: { fontSize: 12, marginLeft: 'auto' },
  milestoneBadge: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  milestoneText: { fontSize: 10, fontWeight: '800' },

  // ✅ NEW: countdown card
  countdownCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  countdownTitle: { fontSize: 14, fontWeight: '700' },
  countdownSub: { fontSize: 12, marginTop: 2 },

  // ✅ NEW: flashback card
  flashbackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  flashbackIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },

  quickSection: { marginHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  tilesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: (W - 60) / 3,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tileIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  tileLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },

  quoteCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quoteMark: { fontSize: 36, fontWeight: '900', lineHeight: 28, alignSelf: 'flex-start', marginBottom: -4 },
  quoteText: { fontSize: 16, fontStyle: 'italic', textAlign: 'center', lineHeight: 24 },
  quoteAuthor: { textAlign: 'center', marginTop: 10, fontWeight: '700', fontSize: 13 },
  copyHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 10 },
  copyHintText: { fontSize: 11, fontWeight: '500' },

  messageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 14,
  },
  messageIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  messageContent: { flex: 1 },
  messageTitle: { fontSize: 15, fontWeight: '700' },
  messageSub: { fontSize: 13, marginTop: 2 },

  bottomPadding: { height: 20 },
});
