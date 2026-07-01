
// src/app/(tabs)/index.tsx - UPDATED HOMESCREEN
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  RefreshControl,
  Clipboard,
  Alert,
} from 'react-native';
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
  { id: 'playlist', icon: 'musical-notes-outline', label: 'Our Playlist', color: '#22C55E', route: 'vibe' },
  { id: 'vault', icon: 'lock-closed-outline', label: 'Vault', color: '#3B82F6', route: '/vault' },
  { id: 'alerts', icon: 'notifications-outline', label: 'Alerts', color: '#F59E0B', route: '/notification' },
  { id: 'playground', icon: 'flask-outline', label: 'Notify Test', color: '#EC4899', route: '/notificationSettings' },
  { id: 'playground2', icon: 'flask-outline', label: 'Notify Test', color: '#EC4899', route: '/notification-playground' },
{ id: 'task', icon: 'clipboard-outline', label: 'New Task', color: '#FF6B9D', route: 'task' },
];


export default function HomeScreen() {
  const { sendGreetingOnAppLoad, sendGreeting, greetingSent } = useDailyGreeting();
const {
    processScheduledChecks,
    getTodayMood,
    handleMoodFromNotification
  } = useMoodNotifications();  
const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const [greeting, setGreeting] = useState('');
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const unreadCount = useNotificationBadge();
  const [refreshing, setRefreshing] = useState(false);
  const [todayMood, setTodayMood] = useState<any>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const quoteAnim = useRef(new Animated.Value(1)).current;
  const { sendSystem } = useNotification();

  const handleSomething = async () => {
    await sendSystem(
      'Welcome! 🎉',
      'Thanks for checking out this feature',
      { screen: 'index' }
    );
  };

  // Auto-send on load
  useEffect(() => {
    sendGreetingOnAppLoad();
  }, []);


useEffect(() => {
    const initMoodChecks = async () => {
      await processScheduledChecks();

      // Check if there's a pending mood from notification
      const todayMood = await getTodayMood();
      if (todayMood?.fromNotification) {
        // Show a gentle reminder
        console.log('💭 Mood was logged from notification');
      }
    };

    initMoodChecks();
  }, []);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning 🌅');
    else if (hour < 17) setGreeting('Good afternoon ☀️');
    else setGreeting('Good evening 🌙');

    loadData();

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    // Quote rotation
    const interval = setInterval(() => {
      Animated.timing(quoteAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setQuoteIndex(i => (i + 1) % QUOTES.length);
        Animated.timing(quoteAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

const loadData = async () => {
  try {
    // Load today's mood
    const history = await AsyncStorage.getItem('moodHistory');
    if (history) {
      const moods = JSON.parse(history);
      const today = new Date().toDateString();

      const todayEntry = moods.find(
        (m: any) => new Date(m.timestamp).toDateString() === today
      );

      if (todayEntry) {
        setTodayMood(todayEntry);
      }
    }

    // Load login streak
    const saved = await AsyncStorage.getItem('loginStreak');

    if (saved) {
      const data = JSON.parse(saved);

      const lastDate = new Date(data.lastDate).toDateString();
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      if (lastDate === today) {
        // Already counted today
        setStreak(data.count);
      } else if (lastDate === yesterday) {
        // Continue streak
        const newCount = data.count + 1;
        setStreak(newCount);

        await AsyncStorage.setItem(
          'loginStreak',
          JSON.stringify({
            count: newCount,
            lastDate: new Date().toISOString(),
          })
        );
      } else {
        // Streak broken
        setStreak(1);

        await AsyncStorage.setItem(
          'loginStreak',
          JSON.stringify({
            count: 1,
            lastDate: new Date().toISOString(),
          })
        );
      }
    } else {
      // First login
      setStreak(1);

      await AsyncStorage.setItem(
        'loginStreak',
        JSON.stringify({
          count: 1,
          lastDate: new Date().toISOString(),
        })
      );
    }
  } catch (error) {
    console.error('Error loading data:', error);
  }
};


  const handleMoodSelect = (mood: any) => {
    setTodayMood(mood);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

const navigateTo = (route: string) => {
  router.push(route as any);
};

  const copyQuote = () => {
    const q = QUOTES[quoteIndex];
    Clipboard.setString(`"${q.text}" — ${q.author}`);
    Alert.alert('Copied! 💕', 'Quote copied to clipboard');
  };

  const currentQuote = QUOTES[quoteIndex];
  const dayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  // Streak milestone
  const streakColor = streak >= 100 ? '#F59E0B' : streak >= 30 ? '#A855F7' : streak >= 7 ? '#22C55E' : '#FF6B9D';

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF6B9D"
              colors={['#FF6B9D']}
            />
          }
        >
          {/* ─── HEADER ─── */}
          <Animated.View style={[styles.headerRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View>
              <Text style={[styles.greeting, { color: colors.text }]}>
                {greeting}, Alice! 💕
              </Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>
                {dayLabel}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={[styles.notificationBtn, { backgroundColor: colors.card }]}
                onPress={() => router.push('/notification')}
                activeOpacity={0.7}
              >
                <Ionicons name="notifications-outline" size={24} color={colors.text} />

                  {unreadCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>


          {/* ─── STREAK BANNER ─── */}
          <View style={[styles.streakBanner, { backgroundColor: colors.card }]}>
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
            <Text style={[styles.streakSub, { color: colors.muted }]}>
              Alice is on fire ✨
            </Text>
          </View>

          {/* ─── MOOD TRACKER ─── */}
          <MoodTracker 
            onMoodSelect={handleMoodSelect}
            initialMood={todayMood}
            size="large"
          />

          {/* ─── QUICK ACCESS TILES ─── */}
          <View style={styles.quickSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Access 🛠️</Text>
            <View style={styles.tilesGrid}>
              {QUICK_TILES.map((tile) => (
                <TouchableOpacity
                  key={tile.id}
                  style={[styles.tile, { backgroundColor: colors.card }]}
                  onPress={() => navigateTo(tile.route)}
                  activeOpacity={0.7}
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
          >
            <Animated.View style={{ opacity: quoteAnim }}>
              <Text style={[styles.quoteMark, { color: colors.muted }]}>"</Text>
              <Text style={[styles.quoteText, { color: colors.text }]}>
                {currentQuote.text}
              </Text>
              <Text style={[styles.quoteAuthor, { color: '#FF6B9D' }]}>
                — {currentQuote.author}
              </Text>
              <View style={styles.copyHint}>
                <Ionicons name="copy-outline" size={12} color={colors.muted} />
                <Text style={[styles.copyHintText, { color: colors.muted }]}>Tap to copy</Text>
              </View>
            </Animated.View>
          </TouchableOpacity>

          {/* ─── MESSAGE BANNER ─── */}
          <TouchableOpacity
            style={[styles.messageBanner, { backgroundColor: colors.card }]}
            onPress={() => navigateTo('vault')}
            activeOpacity={0.7}
          >
            <View style={[styles.messageIconWrap, { backgroundColor: '#8B5CF620' }]}>
              <MaterialCommunityIcons name="email-heart-outline" size={28} color="#8B5CF6" />
            </View>
            <View style={styles.messageContent}>
              <Text style={[styles.messageTitle, { color: colors.text }]}>You have a message</Text>
              <Text style={[styles.messageSub, { color: colors.muted }]}>
                Check "From Him" — something's waiting 😊
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
          </TouchableOpacity>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  // ─── Header ───
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
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  // ─── Streak ───
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
  milestoneBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  milestoneText: { fontSize: 10, fontWeight: '800' },

  // ─── Quick Access ───
  quickSection: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
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
  tileIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },

  // ─── Quote ───
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
  quoteMark: {
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 28,
    alignSelf: 'flex-start',
    marginBottom: -4,
  },
  quoteText: {
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 24,
  },
  quoteAuthor: {
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '700',
    fontSize: 13,
  },
  copyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
  },
  copyHintText: { fontSize: 11, fontWeight: '500' },

  // ─── Message Banner ───
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
  messageIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageContent: { flex: 1 },
  messageTitle: { fontSize: 15, fontWeight: '700' },
  messageSub: { fontSize: 13, marginTop: 2 },

  bottomPadding: { height: 20 },
});
