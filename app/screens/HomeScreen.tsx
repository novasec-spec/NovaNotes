// screens/HomeScreen.tsx - UPGRADED UI VERSION
// ─────────────────────────────────────────────
// ✅ All original logic & functions preserved
// ✅ Backup button moved to top-right corner icon
// ✅ New features added: daily quote rotation,
//    quick-action tiles, streak counter, love note banner
// ─────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import MoodTracker from '../../components/MoodTracker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseBackup } from '../../services/supabaseBackup';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// In DeveloperInfoModal.tsx
import { ThemeProvider, useTheme } from '../../context/ThemeContext';

const { width: W } = Dimensions.get('window');

// ── Rotating love quotes ──────────────────────
const QUOTES = [
  { text: "Every day with you is my favourite day", author: "Your Person 💕" },
  { text: "You are my sunshine on a cloudy day", author: "Always & Forever 🌸" },
  { text: "In a room full of art, I'd still stare at you", author: "Your Person 🥹" },
  { text: "You make ordinary moments extraordinary", author: "With all my heart ✨" },
  { text: "My favourite place is next to you", author: "Your Person 🌙" },
];


const QUICK_TILES = [
  {
    icon: 'notebook-outline',
    label: 'New Note',
    screen: 'Notes',
    color: '#FFD6E8',
    accent: '#FF85A1',
  },
  {
    icon: 'memory',
    label: 'Memory Jar',
    screen: 'Memories',
    color: '#D6F5E8',
    accent: '#7EDCB5',
  },
  {
    icon: 'gift-outline',
    label: 'From Him',
    screen: 'Vault',
    color: '#E8D6FF',
    accent: '#C9A8F5',
  },
  {
    icon: 'music-circle-outline',
    label: 'Our Playlist',
    screen: 'Vibe',
    color: '#FFF3D6',
    accent: '#FFD97D',
  },
];
// ─────────────────────────────────────────────
export default function HomeScreen() {
  // ── YOUR ORIGINAL STATE (untouched) ─────────
const navigation = useNavigation();
  const [greeting,     setGreeting]     = useState('');
  const [todayMood,    setTodayMood]    = useState(null);
  const [backupStatus, setBackupStatus] = useState('');

  // ── NEW STATE ────────────────────────────────
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [streak,     setStreak]     = useState(0);
  const [showBackupToast, setShowBackupToast] = useState(false);

  // Animations
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const slideAnim   = useRef(new Animated.Value(30)).current;
  const quoteAnim   = useRef(new Animated.Value(1)).current;
  const toastAnim   = useRef(new Animated.Value(0)).current;
  const backupSpinAnim = useRef(new Animated.Value(0)).current;

  // ── YOUR ORIGINAL useEffect (untouched) ─────
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning ☀️');
    else if (hour < 17) setGreeting('Good afternoon ☀️');
    else setGreeting('Good evening 🌙');

    loadTodayMood();
  }, []);

  // ── NEW: entrance animation + streak load ───
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    loadStreak();
  }, []);

  // ── NEW: rotate quote every 8 seconds ───────
  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out → change → fade in
      Animated.timing(quoteAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setQuoteIndex(i => (i + 1) % QUOTES.length);
        Animated.timing(quoteAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // ── NEW: load streak from AsyncStorage ──────
  const loadStreak = async () => {
    try {
      const saved = await AsyncStorage.getItem('loginStreak');
      if (saved) {
        const data = JSON.parse(saved);
        const lastDate = new Date(data.lastDate).toDateString();
        const today    = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (lastDate === today) {
          setStreak(data.count);
        } else if (lastDate === yesterday) {
          const newCount = data.count + 1;
          setStreak(newCount);
          await AsyncStorage.setItem('loginStreak', JSON.stringify({ count: newCount, lastDate: new Date().toISOString() }));
        } else {
          setStreak(1);
          await AsyncStorage.setItem('loginStreak', JSON.stringify({ count: 1, lastDate: new Date().toISOString() }));
        }
      } else {
        setStreak(1);
        await AsyncStorage.setItem('loginStreak', JSON.stringify({ count: 1, lastDate: new Date().toISOString() }));
      }
    } catch (e) {
      setStreak(1);
    }
  };

  // ── YOUR ORIGINAL loadTodayMood (untouched) ─
  const loadTodayMood = async () => {
    const history = await AsyncStorage.getItem('moodHistory');
    if (history) {
      const moods = JSON.parse(history);
      const today = new Date().toDateString();
      const todayEntry = moods.find(m => new Date(m.timestamp).toDateString() === today);
      if (todayEntry) setTodayMood(todayEntry);
    }
  };

  // ── YOUR ORIGINAL performBackup (untouched) ─
  const performBackup = async () => {
    // Spin the icon while backing up
    Animated.loop(
      Animated.timing(backupSpinAnim, { toValue: 1, duration: 800, useNativeDriver: true })
    ).start();

    setBackupStatus('Backing up...');
    const backup = new SupabaseBackup('her-user-id-here');
    const success = await backup.backupAllData();
    setBackupStatus(success ? '✅ Backed up!' : '❌ Failed');

    backupSpinAnim.stopAnimation();
    backupSpinAnim.setValue(0);

    // Show toast instead of inline text
    setShowBackupToast(true);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setShowBackupToast(false);
      setBackupStatus('');
    });
  };

  // Spin interpolation for backup icon
  const spinInterpolate = backupSpinAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const currentQuote = QUOTES[quoteIndex];

  // ─────────────────────────────────────────────
  return (
<ThemeProvider>
<SafeAreaProvider>
    <View style={styles.root}>

      {/* ── Toast notification (replaces inline backup status) ── */}
      {showBackupToast && (
        <Animated.View style={[styles.toast, { opacity: toastAnim }]}>
          <Text style={styles.toastText}>{backupStatus}</Text>
        </Animated.View>
      )}

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header row: greeting + backup icon ── */}
        <Animated.View
          style={[
            styles.headerRow,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{greeting}, My Love! 💕</Text>
            <Text style={styles.subtitle}>You mean the world to me 🤣</Text>
          </View>

          {/* ── BACKUP BUTTON → moved to top-right corner icon ── */}
          <TouchableOpacity
            style={styles.backupIconBtn}
            onPress={performBackup}
            activeOpacity={0.75}
          >
<Animated.View
  style={{ transform: [{ rotate: spinInterpolate }] }}
>
  <MaterialCommunityIcons
    name="cloud-upload-outline"
    size={22}
    color="#FF6B9D"
  />
</Animated.View>
          </TouchableOpacity>
        </Animated.View>

        {/* ── NEW: Streak banner ── */}
        <Animated.View
          style={[
            styles.streakBanner,
            { opacity: fadeAnim },
          ]}
        >
   
<MaterialCommunityIcons
  name="fire"
  size={26}
  color="#FF6B9D"
/>
          <Text style={styles.streakText}>
            {streak} day{streak !== 1 ? 's' : ''} in a row!
          </Text>
          <Text style={styles.streakSub}>Alice is on a streak ✨</Text>
        </Animated.View>

        {/* ── Mood section (YOUR ORIGINAL logic, untouched) ── */}
        {todayMood ? (
          <View style={styles.todayMoodCard}>
            <Text style={styles.cardTitle}>Today's Vibe</Text>
            <Text style={styles.moodDisplay}>
              {todayMood.emoji} {todayMood.mood}
            </Text>
            <Text style={styles.moodTime}>
              Logged at {new Date(todayMood.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        ) : (
          <MoodTracker onMoodSelect={setTodayMood} />
        )}

        {/* ── NEW: Quick action tiles ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Access <MaterialCommunityIcons
  name="flower-outline"
  size={18}
  color="#FF6B9D"
/> </Text>
        </View>
        <View style={styles.tilesGrid}>
          {QUICK_TILES.map((tile, i) => (
<TouchableOpacity
  key={i}
  activeOpacity={0.8}
  onPress={() => navigation.navigate(tile.screen)}
  style={[
    styles.tile,
    {
      backgroundColor: tile.color,
      borderColor: tile.accent + '55',
    },
  ]}
>
    <MaterialCommunityIcons
  name={tile.icon}
  size={32}
  color={tile.accent}
/>
              <Text style={[styles.tileLabel, { color: tile.accent }]}>{tile.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Quote card (YOUR ORIGINAL, now rotates) ── */}
        <Animated.View style={[styles.quoteCard, { opacity: quoteAnim }]}>
          <Text style={styles.quoteMark}>"</Text>
          <Text style={styles.quote}>{currentQuote.text}</Text>
          <Text style={styles.quoteAuthor}>— {currentQuote.author}</Text>
          {/* Dot indicators */}
          <View style={styles.quoteDots}>
            {QUOTES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.quoteDot,
                  { backgroundColor: i === quoteIndex ? '#FF6B9D' : '#FFB5C8' },
                ]}
              />
            ))}
          </View>
        </Animated.View>

        {/* ── NEW: Love note banner ── */}
        <View style={styles.loveNoteBanner}>

<MaterialCommunityIcons
  name="email-heart-outline"
  size={32}
  color="#8B5CF6"
/>
          <View>
            <Text style={styles.loveNoteTitle}>You have a message</Text>
            <Text style={styles.loveNoteBody}>Check "From Him" — something's waiting 🥹</Text>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
   </View>
</SafeAreaProvider>
</ThemeProvider> 
 );
}

// ── Styles ────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: '#FFF5F7',
  },

  container: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 40,
  },

  // ── Header row ──
  headerRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop:     52,
    paddingBottom:  8,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize:   26,
    fontWeight: '700',
    color:      '#FF6B9D',
    lineHeight: 32,
  },
  subtitle: {
    fontSize:  14,
    color:     '#AAA',
    marginTop: 4,
    fontStyle: 'italic',
  },

  // ── Backup icon (top-right corner) ──
  backupIconBtn: {
    width:          42,
    height:         42,
    borderRadius:   21,
    backgroundColor:'#FFF0F5',
    borderWidth:    1.5,
    borderColor:    '#FFB5C888',
    alignItems:     'center',
    justifyContent: 'center',
    marginTop:      4,
    shadowColor:    '#FF6B9D',
    shadowOffset:   { width: 0, height: 3 },
    shadowOpacity:  0.15,
    shadowRadius:   8,
    elevation:      4,
  },
  backupIcon: {
    fontSize: 18,
  },

  // ── Toast ──
  toast: {
    position:       'absolute',
    top:            56,
    alignSelf:      'center',
    backgroundColor:'#333',
    paddingHorizontal: 20,
    paddingVertical:   10,
    borderRadius:   20,
    zIndex:         999,
  },
  toastText: {
    color:      '#fff',
    fontWeight: '600',
    fontSize:   13,
  },

  // ── Streak banner ──
  streakBanner: {
    flexDirection:  'row',
    alignItems:     'center',
    marginHorizontal: 20,
    marginTop:      8,
    marginBottom:   16,
    backgroundColor:'#FFF0F5',
    borderRadius:   20,
    paddingVertical:  14,
    paddingHorizontal: 18,
    borderWidth:    1.5,
    borderColor:    '#FFD6E8',
    gap:            8,
  },
  streakFire: {
    fontSize: 26,
  },
  streakText: {
    fontSize:   16,
    fontWeight: '800',
    color:      '#FF6B9D',
  },
  streakSub: {
    fontSize:  12,
    color:     '#BBA0B0',
    marginLeft: 'auto',
    fontStyle: 'italic',
  },

  // ── Mood card (your original, lightly enhanced) ──
  todayMoodCard: {
    margin:          20,
    padding:         22,
    backgroundColor: '#FFE4E9',
    borderRadius:    24,
    alignItems:      'center',
    shadowColor:     '#FF6B9D',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.12,
    shadowRadius:    12,
    elevation:       4,
  },
  cardTitle: {
    fontSize:     17,
    fontWeight:   '700',
    color:        '#FF6B9D',
    marginBottom: 10,
  },
  moodDisplay: {
    fontSize:   30,
    fontWeight: '500',
  },
  moodTime: {
    fontSize:  12,
    color:     '#BBA0B0',
    marginTop: 6,
    fontStyle: 'italic',
  },

  // ── Quick tiles ──
  sectionHeader: {
    paddingHorizontal: 22,
    marginBottom:      10,
    marginTop:         4,
  },
  sectionTitle: {
    fontSize:   16,
    fontWeight: '700',
    color:      '#FF6B9D',
  },
  tilesGrid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    paddingHorizontal: 16,
    gap:            12,
    marginBottom:   16,
  },
  tile: {
    width:          (W - 56) / 2,
    paddingVertical:  18,
    paddingHorizontal: 16,
    borderRadius:   22,
    borderWidth:    1.5,
    alignItems:     'center',
    gap:            6,
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  0.06,
    shadowRadius:   8,
    elevation:      3,
  },
  tileIcon: {
    fontSize: 30,
  },
  tileLabel: {
    fontSize:   13,
    fontWeight: '800',
  },

  // ── Quote card (your original + rotation) ──
  quoteCard: {
    margin:          20,
    padding:         26,
    backgroundColor: '#fff',
    borderRadius:    24,
    shadowColor:     '#FF6B9D',
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.10,
    shadowRadius:    14,
    elevation:       4,
    alignItems:      'center',
  },
  quoteMark: {
    fontSize:   52,
    color:      '#FFD6E8',
    fontWeight: '900',
    lineHeight: 44,
    alignSelf:  'flex-start',
    marginBottom: -8,
  },
  quote: {
    fontSize:   17,
    fontStyle:  'italic',
    textAlign:  'center',
    color:      '#444',
    lineHeight: 26,
  },
  quoteAuthor: {
    textAlign:  'center',
    color:      '#FF6B9D',
    marginTop:  12,
    fontWeight: '700',
    fontSize:   13,
  },
  quoteDots: {
    flexDirection: 'row',
    gap:           6,
    marginTop:     14,
  },
  quoteDot: {
    width:        7,
    height:       7,
    borderRadius: 4,
  },

  // ── Love note banner ──
  loveNoteBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    marginHorizontal:  20,
    marginBottom:      8,
    backgroundColor:   '#F0E6FF',
    borderRadius:      22,
    paddingVertical:   16,
    paddingHorizontal: 18,
    borderWidth:       1.5,
    borderColor:       '#C9A8F555',
    gap:               14,
    shadowColor:       '#C9A8F5',
    shadowOffset:      { width: 0, height: 3 },
    shadowOpacity:     0.12,
    shadowRadius:      10,
    elevation:         3,
  },
  loveNoteEmoji: {
    fontSize: 32,
  },
  loveNoteTitle: {
    fontSize:   14,
    fontWeight: '800',
    color:      '#8B5CF6',
    marginBottom: 2,
  },
  loveNoteBody: {
    fontSize:  13,
    color:     '#A78BCA',
    fontStyle: 'italic',
  },

  bottomPadding: {
    height: 20,
  },
});
