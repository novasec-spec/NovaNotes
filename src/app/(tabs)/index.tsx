// screens/HomeScreen.tsx - UPGRADED UI VERSION
// ─────────────────────────────────────────────
// ✅ All original logic & functions preserved
// ✅ Backup button moved to top-right corner icon
// ✅ New features added: daily quote rotation,
//    quick-action tiles, streak counter, love note banner
// ─────────────────────────────────────────────

import React, { useState, AppState, useEffect, useRef } from 'react';
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
import {  useTheme } from '../../contexts/ThemeContext';
const { width: W } = Dimensions.get('window');

 const QUOTES = [
  { text: "Every day with you is my favourite day", author: "Your Person 💕" },
  { text: "You are my sunshine on a cloudy day", author: "Always & Forever 🌸" },
  { text: "In a room full of art, I'd still stare at you", author: "Your Person 🥹" },
  { text: "You make ordinary moments extraordinary", author: "With all my heart ✨" },
  { text: "My favourite place is next to you", author: "Your Person 🌙" },
  { text: "Loving you is the easiest thing I've ever done", author: "Forever Yours 💖" },
  { text: "You had me at hello", author: "Jerry Maguire 🎬" },
  { text: "I look at you and see the rest of my life", author: "Your Future 💑" },
  { text: "You're the missing piece I didn't know I needed", author: "Complete 🧩" },
  { text: "Home is wherever I'm with you", author: "Our Home 🏠" },
  { text: "You're the first thought on my mind every morning", author: "Good Morning 🌅" },
  { text: "I fell in love with you because you loved me when I couldn't love myself", author: "Grateful 💕" },
  { text: "You're my favorite notification", author: "Ding! 📱" },
  { text: "I still get butterflies every time I see you", author: "Every Single Time 🦋" },
  { text: "You're the reason I believe in soulmates", author: "Destined ✨" },
  { text: "I love you more than all the stars in the sky", author: "Infinity 🌟" },
  { text: "You're my today and all of my tomorrows", author: "Always 💫" },
  { text: "The best thing to hold onto in life is each other", author: "Audrey Hepburn 💕" },
  { text: "You make my world brighter just by being in it", author: "My Sunshine ☀️" },
  { text: "I love you without knowing how, or when, or from where", author: "Pablo Neruda 📖" },
  { text: "You're the peanut butter to my jelly", author: "Perfect Match 🥜" },
  { text: "Every love story is beautiful, but ours is my favorite", author: "Our Story 📖" },
  { text: "You're the best thing that's ever been mine", author: "Taylor Swift 🎵" },
  { text: "I never knew what forever felt like until I met you", author: "Eternity 💕" },
  { text: "You're the reason I wake up with a smile", author: "Morning Joy 😊" },
  { text: "I'd choose you in every lifetime", author: "Soulmates ♾️" },
  { text: "You're my greatest adventure", author: "Let's Go! 🗺️" },
  { text: "I love you more than coffee, and that's saying a lot", author: "☕ Your Person" },
  { text: "You're the plot twist I never saw coming", author: "Best Surprise 🎬" },
  { text: "Falling in love with you was the easiest thing I've ever done", author: "Gravity 💕" },
  { text: "You're the best part of my every day", author: "Daily Dose 💊" },
  { text: "I love you to the moon and back", author: "Sam McBratney 🌙" },
  { text: "You're my happy place", author: "Safe & Sound 🏝️" },
  { text: "I liked you before I even knew what to call it", author: "Just Knew 💕" },
  { text: "You're the reason I look forward to tomorrow", author: "Future Looks Bright ✨" },
  { text: "I love you more than words can ever say", author: "Speechless 💫" },
  { text: "You're my favorite hello and hardest goodbye", author: "Come Back Soon 💕" },
  { text: "Being with you feels like magic", author: "✨ Always" },
  { text: "You're the first person I want to tell when something happens", author: "My Person 📞" },
  { text: "I love you not only for what you are, but for what I am when I am with you", author: "Roy Croft 💕" },
  { text: "You're the best decision I never had to think about", author: "Easy Choice ✅" },
  { text: "My heart beats faster every time I see your name pop up", author: "Text Message 💌" },
  { text: "You're the calm in my chaos", author: "Peace ☮️" },
  { text: "I knew I loved you before I met you", author: "Savage Garden 🎵" },
  { text: "You're the answer to every prayer I never spoke", author: "Heard Anyway 🙏" },
  { text: "I love you more than pizza, and that's serious", author: "🍕 Your Person" },
  { text: "You're the only person I want to annoy for the rest of my life", author: "Sorry Not Sorry 😘" },
  { text: "Every love song makes sense now", author: "Finally Get It 🎶" },
  { text: "You're my favorite reason to lose sleep", author: "Worth It 💕" },
  { text: "I smile like an idiot every time I think of you", author: "Can't Help It 😊" },
  { text: "You're the best part of my life story", author: "Chapter One 📚" },
  { text: "I fall in love with you a little more every single day", author: "Daily Dose 💕" },
  { text: "You're my favorite place to go when I need to escape", author: "My Refuge 🏡" },
  { text: "I love you more than all the sand on the beach", author: "Endless 🏖️" },
  { text: "You're the reason I believe in magic", author: "Believer ✨" },
  { text: "My world is better because you're in it", author: "Grateful 🌍" },
  { text: "You're the 'good morning' and 'good night' I look forward to", author: "Every Day 📱" },
  { text: "I love you more than all the stars in the galaxy", author: "Universal 🌌" },
  { text: "You're the best thing that's ever happened to me", author: "Truth 💕" },
  { text: "I didn't fall in love with you, I walked into it with my eyes wide open", author: "Chose You 🚶" },
  { text: "You're my favorite distraction", author: "Don't Mind If I Do 😊" },
  { text: "I love you more than chocolate", author: "🍫 Big Deal" },
  { text: "You're the only person who can make me laugh when I want to cry", author: "My Sunshine ☀️" },
  { text: "I found the one my soul loves", author: "Song of Solomon 📖" },
  { text: "You're the WiFi to my phone", author: "Connected 📶" },
  { text: "I love you more than all the fish in the sea", author: "Plenty of 🐟" },
  { text: "You're my favorite hello", author: "Every Time 💕" },
  { text: "I love you without measure", author: "Endless 📏" },
  { text: "You're the reason I'm still smiling", author: "Thank You 😊" },
  { text: "My heart knew you before my mind did", author: "Instinct 💕" },
  { text: "You're the best thing I never knew I needed", author: "Sweet Surprise 🎁" },
  { text: "I love you more than words can hold", author: "Overflowing 💫" },
  { text: "You're my favorite notification", author: "Always Read 📱" },
  { text: "I love you more than all the leaves on all the trees", author: "Forestation 🌳" },
  { text: "You're the melody that plays in my head all day", author: "On Repeat 🎵" },
  { text: "I love you more than yesterday but less than tomorrow", author: "Growing 📈" },
  { text: "You're the best part of waking up", author: "Folgers ☕" },
  { text: "My favorite color is you", author: "🌈 True" },
  { text: "You're the only 10 I see", author: "Perfect 10 💯" },
  { text: "I love you more than all the drops in the ocean", author: "Deep 🌊" },
  { text: "You're my greatest treasure", author: "Found 💎" },
  { text: "I love you more than all the seconds in forever", author: "Eternal ⏰" },
  { text: "You're my favorite reason to come home", author: "Welcome Back 🏠" },
  { text: "I love you more than all the pages in every book", author: "Unwritten 📚" },
  { text: "You're the poetry I never knew how to write", author: "My Muse ✍️" },
  { text: "I love you more than all the notes in every song", author: "Symphony 🎼" },
  { text: "You're my favorite adventure", author: "Let's Go 🌍" },
  { text: "I love you more than all the colors in the rainbow", author: "Vivid 🌈" },
  { text: "You're the best thing that's ever happened to me", author: "Lucky Me 🍀" },
  { text: "I love you more than all the dreams I've ever dreamed", author: "Reality 💭" },
  { text: "You're my favorite mistake to have made", author: "Happy Accident 😊" },
  { text: "I love you more than all the hugs I've ever given", author: "Wrap Around 🤗" },
  { text: "You're the only person I want to binge-watch life with", author: "Marathon 📺" },
  { text: "I love you more than all the laughs I've ever laughed", author: "Smiling 😂" },
  { text: "You're my favorite person to do nothing with", author: "Quality Time ⏰" },
  { text: "I love you more than all the sunsets I've ever seen", author: "Beautiful 🌅" },
  { text: "You're the best surprise life ever gave me", author: "Unexpected 🎁" },
  { text: "I love you more than all the butterflies I've ever felt", author: "Flutter 🦋" },
  { text: "You're my favorite reason to believe in fate", author: "Meant to Be ✨" },
  { text: "I love you more than all the prayers I've ever prayed", author: "Answered 🙏" },
  { text: "You're the last person I want to see before I sleep", author: "Good Night 🌙" },
];

const QUICK_TILES = [
  {
    icon: 'notebook-outline',
    label: 'New Note',
    screen: 'notes',
    color: '#FFD6E8',
    accent: '#FF85A1',
  },
  {
    icon: 'memory',
    label: 'Memory Jar',
    screen: 'memories',
    color: '#D6F5E8',
    accent: '#7EDCB5',
  },
  {
    icon: 'gift-outline',
    label: 'From Him',
    screen: 'vault',
    color: '#E8D6FF',
    accent: '#C9A8F5',
  },
  {
    icon: 'music-circle-outline',
    label: 'Our Playlist',
    screen: 'vibe',
    color: '#FFF3D6',
    accent: '#FFD97D',
  },
];
// ─────────────────────────────────────────────
export default function HomeScreen() {
  // ── YOUR ORIGINAL STATE (untouched) ─────────
  const { colors, isDarkMode } = useTheme();
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

  // ── ADD ──────────────────────────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────────────────

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
<SafeAreaProvider>
<SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      {/* ── Toast notification (replaces inline backup status) ── */}
      {showBackupToast && (
        <Animated.View style={[styles.toast,  { opacity: toastAnim }]}>
          <Text style={[styles.toastText,  { color: colors.text }]}>{backupStatus}</Text>
        </Animated.View>
      )}

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
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
            style={[styles.backupIconBtn, { backgroundColor: colors.card }] }
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
            styles.streakBanner,{  backgroundColor: colors.card, borderColor: colors.border },
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
          <Text style={[styles.streakSub,  { color: colors.text }]}>Alice is on a streak ✨</Text>
        </Animated.View>

        {/* ── Mood section (YOUR ORIGINAL logic, untouched) ── */}
        {todayMood ? (
          <View style={[styles.todayMoodCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle,  { color: colors.text }]}>Today's Vibe</Text>
            <Text style={[styles.moodDisplay,  { color: colors.text }]}>
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
        <View style={[styles.tilesGrid, { borderColor: colors.border }]}>
          {QUICK_TILES.map((tile, i) => (
<TouchableOpacity
  key={i}
  activeOpacity={0.8}
  onPress={() => navigation.navigate(tile.screen)}
  style={[
    styles.tile,
    {
      backgroundColor: colors.card,
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
        <Animated.View style={[styles.quoteCard, { opacity: quoteAnim }, { backgroundColor: colors.card }]}>
          <Text style={styles.quoteMark}>"</Text>
          <Text style={styles.quote}>{currentQuote.text}</Text>
          <Text style={styles.quoteAuthor}>— {currentQuote.author}</Text>
          {/* Dot indicators */}
        </Animated.View>

        {/* ── NEW: Love note banner ── */}
        <View style={[styles.loveNoteBanner, { backgroundColor: colors.background }]}>

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
</SafeAreaView>
</SafeAreaProvider>
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
