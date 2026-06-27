// screens/VibeScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Dimensions, Alert, TextInput, Modal, Animated,
  KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import MoodTracker from '../../components/MoodTracker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';

const { width: W } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const PINK    = '#FF6B9D';
const ROSE    = '#FFE4ED';
const BG      = '#FFF5F7';
const WHITE   = '#FFFFFF';
const DARK    = '#2D1B25';
const MID     = '#9A7090';
const SOFT    = '#C4A0B8';
const MINT    = '#22C55E';
const PURPLE  = '#8B5CF6';
const AMBER   = '#F59E0B';

// ── Mood config ───────────────────────────────────────────────────────────────
const MOODS = [
  { key: 'Happy',      icon: 'sunny',        color: '#F59E0B', bg: '#FFFBEB', label: 'Happy'      },
  { key: 'Loved',      icon: 'heart',        color: '#EF4444', bg: '#FFF0F0', label: 'Loved'      },
  { key: 'Relaxed',    icon: 'leaf',         color: '#22C55E', bg: '#F0FDF4', label: 'Relaxed'    },
  { key: 'Thoughtful', icon: 'bulb',         color: '#8B5CF6', bg: '#F5F3FF', label: 'Thoughtful' },
  { key: 'Sad',        icon: 'rainy',        color: '#6B7280', bg: '#F3F4F6', label: 'Sad'        },
  { key: 'Frustrated', icon: 'thunderstorm', color: '#F97316', bg: '#FFF4ED', label: 'Frustrated' },
  { key: 'Anxious',    icon: 'pulse',        color: '#EC4899', bg: '#FDF2F8', label: 'Anxious'    },
  { key: 'Grateful',   icon: 'sparkles',     color: '#14B8A6', bg: '#F0FDFA', label: 'Grateful'   },
] as const;

type MoodKey = typeof MOODS[number]['key'];

function getMood(key?: string) {
  return MOODS.find(m => m.key === key) ?? MOODS[0];
}

// ── Day-of-week labels ────────────────────────────────────────────────────────
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Journal / Mood types ──────────────────────────────────────────────────────
interface JournalEntry {
  id:        string;
  date:      string;
  note:      string;
  dayRating: 'great' | 'good' | 'okay' | 'rough' | 'bad';
  question?: string;
  answer?:   string;
}

interface MoodEntry {
  mood:      string;
  timestamp: string;
  note?:     string;
}

// ── Day rating config ─────────────────────────────────────────────────────────
const DAY_RATINGS = [
  { key: 'great', icon: 'star',          color: '#F59E0B', label: 'Great'  },
  { key: 'good',  icon: 'happy',         color: '#22C55E', label: 'Good'   },
  { key: 'okay',  icon: 'remove-circle', color: '#6B7280', label: 'Okay'   },
  { key: 'rough', icon: 'cloudy',        color: '#F97316', label: 'Rough'  },
  { key: 'bad',   icon: 'thunderstorm',  color: '#EF4444', label: 'Bad'    },
] as const;

type DayRating = typeof DAY_RATINGS[number]['key'];

function getRating(key?: string) {
  return DAY_RATINGS.find(r => r.key === key) ?? DAY_RATINGS[2];
}

// ── Quotes ────────────────────────────────────────────────────────────────────
const SWEET_QUOTES = [
  { text: "You are enough. You have always been enough.", author: "Your Person 💕" },
  { text: "Your smile is my favorite thing to see", author: "Keep Smiling 😊" },
  { text: "You are stronger than you know and braver than you feel", author: "Warrior 💪" },
  { text: "You make the world a better place just by being in it", author: "Truth 🌍" },
  { text: "Your kindness is your superpower", author: "Hero 🦸" },
  { text: "Today is going to be a good day because you're in it", author: "Morning Boost ☀️" },
  { text: "You are not your mistakes. You are growing every day", author: "Progress 📈" },
  { text: "The world needs exactly you. Not a version of someone else", author: "Authentic 💯" },
  { text: "You are worthy of rest, peace, and joy", author: "Take a Breath 🧘" },
  { text: "Your presence is a gift to everyone around you", author: "Precious 🎁" },
  { text: "You are a masterpiece in progress", author: "Work of Art 🎨" },
  { text: "Your effort matters more than perfection", author: "Trying is Winning 🏆" },
  { text: "Keep shining. The world needs your light", author: "Shine Bright ✨" },
  { text: "You turn ordinary moments into magic", author: "Enchanting 🪄" },
  { text: "Your potential is limitless", author: "Unstoppable 🌈" },
];

const FUNNY_QUOTES = [
  { text: "You're like coffee — essential, warm, and some people don't deserve you.", author: "Factual ☕" },
  { text: "You're not lazy. You're on energy-saving mode. Very eco-friendly.", author: "Efficiency Expert 🌿" },
  { text: "Napping is basically time travel to when you feel better. Very scientific.", author: "Dr. Pillow 🔬" },
  { text: "You walked past a mirror today and it said 'okay wow'.", author: "Eyewitness 🪞" },
  { text: "Your vibe is giving main character — even when you're just getting snacks.", author: "The Narrator 📖" },
  { text: "Somewhere, someone is using you as their 'goals'. No pressure tho.", author: "Anonymous Fan 🫶" },
  { text: "Bad day? You've survived 100% of your bad days so far. Excellent track record.", author: "Statistics 📊" },
  { text: "You're the reason the WiFi password is worth sharing.", author: "Tech Support 📶" },
  { text: "You could be a Monday and still be someone's favourite thing about the week.", author: "Calendar Logic 📅" },
  { text: "Manifesting good things for you. I also manifested snacks. Priorities.", author: "The Universe 🌌" },
  { text: "Not to be dramatic but you might literally be the coolest person I know.", author: "Objective Opinion 🤓" },
  { text: "Plot twist: the main character was you the whole time. Always has been.", author: "Spoiler Alert 🎬" },
];

const AFFIRMATIONS = [
  "You are loved, you are cherished, and you make this world more beautiful.",
  "Your feelings matter. It's okay to feel everything deeply.",
  "Today you are enough. Tomorrow you will be enough too.",
  "The love you give always finds its way back to you.",
  "Your presence is a gift — to yourself and everyone around you.",
  "Be gentle with yourself today. You're doing better than you know.",
  "Every day you choose love, you are choosing the best version of yourself.",
];

const MOOD_QUESTIONS = [
  "What's one tiny thing that made you smile today?",
  "On a scale of sleepy to full of life — where are you landing?",
  "Is there anything sitting heavy on your chest right now?",
  "What emotion is living rent-free in your head today?",
  "If today had a colour, what would it be and why?",
  "What's the best part of your day so far?",
  "Did anything catch you off guard today — good or bad?",
  "What do you wish someone would ask you right now?",
  "How's your heart doing, honestly?",
  "What would make today feel 10% better?",
  "Is there someone you're thinking about a lot today?",
  "What are you most grateful for in this exact moment?",
];

// ── Mood-aware encouragements ─────────────────────────────────────────────────
const MOOD_ENCOURAGEMENTS: Record<string, string[]> = {
  Happy: [
    "You're radiating today and people can feel it. Keep going.",
    "This energy is contagious. Bottle it up for a rainy day.",
    "Happy looks incredible on you, just so you know.",
  ],
  Loved: [
    "You deserve every bit of that feeling. Soak it in.",
    "Being loved is nice. Being you is nicer. Both happening? Win.",
    "Hold onto this. You earned it.",
  ],
  Relaxed: [
    "Rest is productive. You are doing amazing by doing nothing.",
    "Chill mode activated. Respect.",
    "Slow days are still good days. You're exactly where you should be.",
  ],
  Thoughtful: [
    "Big brain energy. Whatever you're figuring out — you'll get there.",
    "Deep thinkers see what others miss. Keep going.",
    "It's okay to sit with your thoughts. No rush.",
  ],
  Sad: [
    "Sad days are valid. You don't have to perform happiness today.",
    "It's okay to not be okay. That's literally what 'okay' is for later.",
    "Be soft with yourself right now. You deserve that.",
  ],
  Frustrated: [
    "Frustration means you care. That's actually not a bad thing.",
    "You are allowed to be annoyed. Just don't live there.",
    "Deep breaths. Dramatic exhale. You've got this.",
  ],
  Anxious: [
    "Your nervous system is doing a lot right now. Let's slow it down.",
    "One thing at a time. You don't have to solve everything today.",
    "You've survived every anxious day before this one. Today too.",
  ],
  Grateful: [
    "Gratitude is a superpower and you're using it wisely.",
    "Noticing the good things is genuinely a skill. You have it.",
    "This energy you're giving? It comes back to you tenfold.",
  ],
};

// ── Mini challenges ───────────────────────────────────────────────────────────
const DAILY_CHALLENGES = [
  { icon: 'water', color: '#3B82F6', text: 'Drink 8 glasses of water today', category: 'Health' },
  { icon: 'walk', color: MINT, text: 'Take a 10-minute walk outside', category: 'Movement' },
  { icon: 'phone-portrait-outline', color: '#F97316', text: 'Phone-free for 30 mins before bed', category: 'Wind down' },
  { icon: 'chatbubble-outline', color: PINK, text: 'Text someone you haven\'t talked to in a while', category: 'Connection' },
  { icon: 'book-outline', color: PURPLE, text: 'Read 10 pages of anything you like', category: 'Mind' },
  { icon: 'sunny-outline', color: AMBER, text: 'Step outside for at least 5 minutes', category: 'Mood' },
  { icon: 'musical-notes-outline', color: '#EC4899', text: 'Listen to a song that makes you feel something', category: 'Vibe' },
  { icon: 'ribbon-outline', color: '#14B8A6', text: 'Say one kind thing to yourself out loud', category: 'Self' },
  { icon: 'cafe-outline', color: '#92400E', text: 'Make or order your favourite drink. No guilt.', category: 'Treat' },
  { icon: 'bed-outline', color: '#6B7280', text: 'Be in bed by 11. Your brain will thank you.', category: 'Rest' },
  { icon: 'color-palette-outline', color: '#A855F7', text: 'Draw, doodle, or colour something — anything', category: 'Create' },
  { icon: 'fitness-outline', color: '#22C55E', text: 'Do 5 minutes of stretching', category: 'Body' },
  { icon: 'earth-outline', color: '#3B82F6', text: 'Learn one random interesting fact today', category: 'Curious' },
  { icon: 'pizza-outline', color: '#F59E0B', text: 'Eat something that genuinely makes you happy', category: 'Joy' },
];

// ── Mood trend summaries ──────────────────────────────────────────────────────
function getMoodTrendMessage(stats: Record<string, number>): { text: string; icon: string; color: string } {
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  if (total === 0) return { text: 'No mood data yet this week — start tracking!', icon: 'analytics-outline', color: SOFT };

  const topMood = Object.entries(stats).sort((a, b) => b[1] - a[1])[0];
  const [moodKey, count] = topMood;
  const m = getMood(moodKey);
  const pct = Math.round((count / total) * 100);

  const messages: Record<string, string> = {
    Happy:      `You've been Happy ${pct}% of the time this week. Genuinely love that for you.`,
    Loved:      `Feeling Loved ${pct}% of days. Someone's doing a good job. (It might be you.)`,
    Relaxed:    `${pct}% of your week has been Relaxed. An icon of chill. Respect.`,
    Thoughtful: `You've been Thoughtful ${pct}% of this week. Big brain week incoming.`,
    Sad:        `Sad showed up ${pct}% of the time. That's okay. You're still here. That matters.`,
    Frustrated: `Frustrated for ${pct}% of the week. Sounds rough — what's going on?`,
    Anxious:    `Anxious vibes ${pct}% of this week. Be extra gentle with yourself right now.`,
    Grateful:   `Grateful ${pct}% of the week. That perspective is a genuine superpower.`,
  };

  return {
    text: messages[moodKey] ?? `Your most common vibe this week was ${moodKey}.`,
    icon: m.icon,
    color: m.color,
  };
}

// ── Animated fade-in section ──────────────────────────────────────────────────
function FadeSection({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ── Pulsing music button ──────────────────────────────────────────────────────
function MusicButton({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.08, duration: 800, useNativeDriver: false }),
          Animated.timing(glow,  { toValue: 1,    duration: 800, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1,    duration: 800, useNativeDriver: false }),
          Animated.timing(glow,  { toValue: 0,    duration: 800, useNativeDriver: false }),
        ]),
      ])
    ).start();
  }, []);

  const shadowRadius = glow.interpolate({ inputRange: [0, 1], outputRange: [6, 18] });
  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] });

  return (
    <Animated.View style={[
      styles.musicBtn,
      { transform: [{ scale }], shadowRadius, shadowOpacity }
    ]}>
      <Pressable onPress={onPress} style={styles.musicBtnInner} android_ripple={{ color: 'rgba(255,255,255,0.2)', radius: 30 }}>
        {/* Vinyl ring */}
        <View style={styles.vinylOuter}>
          <View style={styles.vinylInner}>
            <Ionicons name="musical-notes" size={22} color={WHITE} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function VibeScreen() {
  const { colors, isDarkMode } = useTheme();

  // ── State ─────────────────────────────────────────────────────────────────
  const [todayMood,        setTodayMood]        = useState<MoodEntry | null>(null);
  const [moodHistory,      setMoodHistory]      = useState<MoodEntry[]>([]);
  const [weeklyStats,      setWeeklyStats]      = useState<Record<string, number>>({});
  const [todaysQuote,      setTodaysQuote]      = useState(SWEET_QUOTES[0]);
  const [quoteMode,        setQuoteMode]        = useState<'sweet' | 'funny'>('sweet');
  const [journalEntries,   setJournalEntries]   = useState<JournalEntry[]>([]);
  const [showJournal,      setShowJournal]      = useState(false);
  const [todayJournal,     setTodayJournal]     = useState<JournalEntry | null>(null);
  const [dailyQuestion,    setDailyQuestion]    = useState('');
  const [affirmation,      setAffirmation]      = useState('');
  const [challengeDone,    setChallengeDone]    = useState(false);
  const [challenge,        setChallenge]        = useState(DAILY_CHALLENGES[0]);
  const [streak,           setStreak]           = useState(0);
  const [showMoodSummary,  setShowMoodSummary]  = useState(false);

  // Journal modal
  const [journalNote,      setJournalNote]      = useState('');
  const [journalRating,    setJournalRating]    = useState<DayRating>('okay');
  const [questionAnswer,   setQuestionAnswer]   = useState('');
  const [editingJournal,   setEditingJournal]   = useState(false);

  const checkAnim = useRef(new Animated.Value(0)).current;

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadMoodData();
    loadJournalData();
    loadChallenge();
    loadStreak();
    pickDailyQuestion();
    pickAffirmation();
    pickQuote('sweet');
  }, []);

  const getLast7Days = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toDateString());
    }
    return days;
  };

  const loadMoodData = async () => {
    const history = await AsyncStorage.getItem('moodHistory');
    if (history) {
      const parsed: MoodEntry[] = JSON.parse(history);
      setMoodHistory(parsed);
      const today = new Date().toDateString();
      setTodayMood(parsed.find(m => new Date(m.timestamp).toDateString() === today) ?? null);
      const last7 = getLast7Days();
      const stats: Record<string, number> = {};
      parsed.forEach(m => {
        if (last7.includes(new Date(m.timestamp).toDateString())) {
          stats[m.mood] = (stats[m.mood] || 0) + 1;
        }
      });
      setWeeklyStats(stats);
    }
  };

  const loadJournalData = async () => {
    const saved = await AsyncStorage.getItem('journalEntries');
    if (saved) {
      const entries: JournalEntry[] = JSON.parse(saved);
      setJournalEntries(entries);
      const today = new Date().toDateString();
      setTodayJournal(entries.find(e => new Date(e.date).toDateString() === today) ?? null);
    }
  };

  const loadChallenge = async () => {
    const today    = new Date().toDateString();
    const saved    = await AsyncStorage.getItem('dailyChallenge');
    const doneSaved = await AsyncStorage.getItem('challengeDone');
    if (saved) {
      const { date, index } = JSON.parse(saved);
      if (date === today) {
        setChallenge(DAILY_CHALLENGES[index]);
        setChallengeDone(doneSaved === today);
        return;
      }
    }
    const idx = new Date().getDate() % DAILY_CHALLENGES.length;
    await AsyncStorage.setItem('dailyChallenge', JSON.stringify({ date: today, index: idx }));
    setChallenge(DAILY_CHALLENGES[idx]);
    setChallengeDone(false);
  };

  const loadStreak = async () => {
    const saved = await AsyncStorage.getItem('moodStreak');
    if (saved) setStreak(parseInt(saved, 10));
  };

  const saveJournalEntries = async (entries: JournalEntry[]) => {
    await AsyncStorage.setItem('journalEntries', JSON.stringify(entries));
    setJournalEntries(entries);
    const today = new Date().toDateString();
    setTodayJournal(entries.find(e => new Date(e.date).toDateString() === today) ?? null);
  };

  const openJournal = () => {
    if (todayJournal) {
      setJournalNote(todayJournal.note);
      setJournalRating(todayJournal.dayRating);
      setQuestionAnswer(todayJournal.answer ?? '');
      setEditingJournal(true);
    } else {
      setJournalNote('');
      setJournalRating('okay');
      setQuestionAnswer('');
      setEditingJournal(false);
    }
    setShowJournal(true);
  };

  const saveJournalEntry = () => {
    if (!journalNote.trim() && !questionAnswer.trim()) {
      Alert.alert('Write something', 'Add a note or answer the question first ✍️');
      return;
    }
    const entry: JournalEntry = {
      id:        todayJournal?.id ?? Date.now().toString(),
      date:      todayJournal?.date ?? new Date().toISOString(),
      note:      journalNote.trim(),
      dayRating: journalRating,
      question:  dailyQuestion,
      answer:    questionAnswer.trim(),
    };
    const filtered = journalEntries.filter(e =>
      new Date(e.date).toDateString() !== new Date().toDateString()
    );
    saveJournalEntries([entry, ...filtered]);
    setShowJournal(false);
  };

  const pickDailyQuestion = () => {
    const idx = (new Date().getDay() + new Date().getDate()) % MOOD_QUESTIONS.length;
    setDailyQuestion(MOOD_QUESTIONS[idx]);
  };

  const pickAffirmation = () => {
    setAffirmation(AFFIRMATIONS[new Date().getDate() % AFFIRMATIONS.length]);
  };

  const pickQuote = (mode: 'sweet' | 'funny') => {
    const pool = mode === 'funny' ? FUNNY_QUOTES : SWEET_QUOTES;
    setTodaysQuote(pool[Math.floor(Math.random() * pool.length)]);
    setQuoteMode(mode);
  };

  const toggleChallenge = async () => {
    if (challengeDone) return;
    Animated.sequence([
      Animated.timing(checkAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(checkAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
    ]).start();
    setChallengeDone(true);
    await AsyncStorage.setItem('challengeDone', new Date().toDateString());
    const newStreak = streak + 1;
    setStreak(newStreak);
    await AsyncStorage.setItem('moodStreak', newStreak.toString());
    Alert.alert('Done! 🎉', 'Challenge complete. Look at you go.');
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getJournalForDate = (dateStr: string) =>
    journalEntries.find(e => new Date(e.date).toDateString() === dateStr);
  const getMoodForDate = (dateStr: string) =>
    moodHistory.find(m => new Date(m.timestamp).toDateString() === dateStr);
  const last7 = getLast7Days().reverse();

  const moodEncouragements = todayMood
    ? MOOD_ENCOURAGEMENTS[todayMood.mood] ?? []
    : [];
  const todayEncouragement = moodEncouragements[new Date().getHours() % moodEncouragements.length] ?? '';

  const trendMsg = getMoodTrendMessage(weeklyStats);

  const checkScale = checkAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background ?? BG }]} edges={['top']}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background ?? BG }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ── */}
        <FadeSection delay={0}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.headerGreeting, { color: colors.text ?? DARK }]}>
                {getGreeting()}
              </Text>
              <Text style={styles.headerSub}>How's your heart today?</Text>
            </View>
            <View style={styles.headerRight}>
              {/* Streak badge */}
              {streak > 0 && (
                <View style={styles.streakBadge}>
                  <Ionicons name="flame" size={14} color="#F97316" />
                  <Text style={styles.streakTxt}>{streak}</Text>
                </View>
              )}
              <TouchableOpacity style={styles.journalFab} onPress={openJournal}>
                <Ionicons name={todayJournal ? 'checkmark-circle' : 'journal'} size={18} color={WHITE} />
                <Text style={styles.journalFabTxt}>{todayJournal ? 'Diary ✓' : 'Write'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </FadeSection>

        {/* ── Music button — redesigned ── */}
        <FadeSection delay={30}>
          <View style={styles.musicRow}>
            <View style={styles.musicMeta}>
              <Text style={styles.musicLabel}>Mood Music</Text>
              <Text style={styles.musicSub}>Pick a playlist for your vibe</Text>
            </View>
            <MusicButton onPress={() => router.push('/moodmusic')} />
          </View>
        </FadeSection>

        {/* ── Quote card with sweet / funny toggle ── */}
        <FadeSection delay={60}>
          <View style={[styles.quoteCard, { backgroundColor: colors.card ?? WHITE }]}>
            {/* Toggle */}
            <View style={styles.quoteModeRow}>
              <TouchableOpacity
                style={[styles.quoteModeBtn, quoteMode === 'sweet' && styles.quoteModeBtnActive]}
                onPress={() => pickQuote('sweet')}
              >
                <Ionicons name="heart" size={12} color={quoteMode === 'sweet' ? WHITE : SOFT} />
                <Text style={[styles.quoteModeTxt, quoteMode === 'sweet' && { color: WHITE }]}>Sweet</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quoteModeBtn, quoteMode === 'funny' && styles.quoteModeBtnActiveAlt]}
                onPress={() => pickQuote('funny')}
              >
                <Ionicons name="happy" size={12} color={quoteMode === 'funny' ? WHITE : SOFT} />
                <Text style={[styles.quoteModeTxt, quoteMode === 'funny' && { color: WHITE }]}>Funny</Text>
              </TouchableOpacity>
            </View>
            <Ionicons name={quoteMode === 'funny' ? 'happy-outline' : 'chatbubble-ellipses'} size={24} color={PINK} style={{ marginBottom: 6 }} />
            <Text style={[styles.quoteText, { color: colors.text ?? DARK }]}>"{todaysQuote.text}"</Text>
            <Text style={styles.quoteAuthor}>— {todaysQuote.author}</Text>
            <TouchableOpacity onPress={() => pickQuote(quoteMode)} style={styles.refreshQuote}>
              <Ionicons name="shuffle" size={13} color={SOFT} />
              <Text style={styles.refreshQuoteTxt}>Another one</Text>
            </TouchableOpacity>
          </View>
        </FadeSection>

        {/* ── Daily question ── */}
        <FadeSection delay={120}>
          <View style={[styles.questionCard, { backgroundColor: colors.card ?? WHITE }]}>
            <View style={styles.questionHeader}>
              <Ionicons name="help-circle" size={20} color={PINK} />
              <Text style={styles.questionLabel}>Today's question</Text>
            </View>
            <Text style={[styles.questionText, { color: colors.text ?? DARK }]}>{dailyQuestion}</Text>
            {todayJournal?.answer ? (
              <View style={styles.answerPreview}>
                <Ionicons name="checkmark-circle" size={14} color={PINK} />
                <Text style={styles.answerPreviewTxt} numberOfLines={2}>{todayJournal.answer}</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.answerBtn} onPress={openJournal}>
                <Ionicons name="pencil" size={13} color={PINK} />
                <Text style={styles.answerBtnTxt}>Answer in diary</Text>
              </TouchableOpacity>
            )}
          </View>
        </FadeSection>

        {/* ── Mood tracker ── */}
        <FadeSection delay={180}>
          {!todayMood ? (
            <MoodTracker onMoodSelect={() => loadMoodData()} />
          ) : (
            <View style={[styles.todayCard, { backgroundColor: colors.card ?? WHITE }]}>
              <Text style={styles.cardTitle}>Today's mood</Text>
              <View style={styles.todayMoodRow}>
                <View style={[styles.todayMoodIcon, { backgroundColor: getMood(todayMood.mood).color + '22' }]}>
                  <Ionicons name={getMood(todayMood.mood).icon as any} size={34} color={getMood(todayMood.mood).color} />
                </View>
                <View>
                  <Text style={[styles.todayMoodLabel, { color: getMood(todayMood.mood).color }]}>
                    {todayMood.mood}
                  </Text>
                  {/* Mood-based encouragement */}
                  {!!todayEncouragement && (
                    <Text style={styles.moodEncouragement}>{todayEncouragement}</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={styles.updateButton}
                onPress={() => { setTodayMood(null); }}
              >
                <Ionicons name="refresh" size={13} color={PINK} />
                <Text style={styles.updateText}>Update mood</Text>
              </TouchableOpacity>
            </View>
          )}
        </FadeSection>

        {/* ── Daily challenge card ── */}
        <FadeSection delay={220}>
          <View style={[styles.challengeCard, { backgroundColor: colors.card ?? WHITE }]}>
            <View style={styles.challengeHeader}>
              <View style={[styles.challengeIconWrap, { backgroundColor: challenge.color + '18' }]}>
                <Ionicons name={challenge.icon as any} size={22} color={challenge.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.challengeCategory}>{challenge.category} challenge</Text>
                <Text style={[styles.challengeText, { color: colors.text ?? DARK }]}>
                  {challenge.text}
                </Text>
              </View>
            </View>
            <Animated.View style={{ transform: [{ scale: checkScale }] }}>
              <TouchableOpacity
                style={[
                  styles.challengeBtn,
                  { backgroundColor: challengeDone ? MINT : challenge.color },
                ]}
                onPress={toggleChallenge}
                disabled={challengeDone}
              >
                <Ionicons
                  name={challengeDone ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={16}
                  color={WHITE}
                />
                <Text style={styles.challengeBtnTxt}>
                  {challengeDone ? 'Done! ✓' : 'Mark complete'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </FadeSection>

        {/* ── Today's diary summary ── */}
        {todayJournal && (
          <FadeSection delay={260}>
            <View style={[styles.journalSummaryCard, { backgroundColor: colors.card ?? WHITE }]}>
              <View style={styles.journalSummaryHeader}>
                <Ionicons name="journal" size={16} color={PINK} />
                <Text style={styles.questionLabel}>Today's diary</Text>
                <TouchableOpacity onPress={openJournal} style={{ marginLeft: 'auto' }}>
                  <Ionicons name="pencil" size={16} color={SOFT} />
                </TouchableOpacity>
              </View>
              <View style={styles.daySummaryRating}>
                <Ionicons
                  name={getRating(todayJournal.dayRating).icon as any}
                  size={16}
                  color={getRating(todayJournal.dayRating).color}
                />
                <Text style={[styles.daySummaryRatingTxt, { color: getRating(todayJournal.dayRating).color }]}>
                  {getRating(todayJournal.dayRating).label} day
                </Text>
              </View>
              {!!todayJournal.note && (
                <Text style={styles.journalSummaryNote} numberOfLines={3}>{todayJournal.note}</Text>
              )}
            </View>
          </FadeSection>
        )}

        {/* ── 7-day calendar strip ── */}
        <FadeSection delay={300}>
          <View style={[styles.calCard, { backgroundColor: colors.card ?? WHITE }]}>
            <Text style={styles.cardTitle}>This week</Text>
            <View style={styles.calRow}>
              {last7.map((dayStr) => {
                const moodEntry    = getMoodForDate(dayStr);
                const journalEntry = getJournalForDate(dayStr);
                const isToday      = dayStr === new Date().toDateString();
                const dayLabel     = DAY_LABELS[new Date(dayStr).getDay()];
                const mood         = moodEntry ? getMood(moodEntry.mood) : null;
                const rating       = journalEntry ? getRating(journalEntry.dayRating) : null;

                return (
                  <View key={dayStr} style={[styles.calDay, isToday && styles.calDayToday]}>
                    <Text style={[styles.calDayLabel, isToday && { color: PINK }]}>{dayLabel}</Text>
                    <View style={[styles.calMoodCircle, { backgroundColor: mood ? mood.bg : '#F3F4F6' }]}>
                      {mood
                        ? <Ionicons name={mood.icon as any} size={15} color={mood.color} />
                        : <Ionicons name="ellipse-outline" size={13} color={SOFT} />
                      }
                    </View>
                    {rating
                      ? <View style={[styles.calRatingDot, { backgroundColor: rating.color }]} />
                      : <View style={[styles.calRatingDot, { backgroundColor: '#E5E7EB' }]} />
                    }
                  </View>
                );
              })}
            </View>
            <View style={styles.calLegend}>
              <View style={styles.calLegendItem}>
                <Ionicons name="ellipse" size={7} color={PINK} />
                <Text style={styles.calLegendTxt}>Mood</Text>
              </View>
              <View style={styles.calLegendItem}>
                <View style={[styles.calRatingDot, { backgroundColor: MID }]} />
                <Text style={styles.calLegendTxt}>Diary rating</Text>
              </View>
            </View>
          </View>
        </FadeSection>

        {/* ── Mood trend summary (smart) ── */}
        <FadeSection delay={340}>
          <TouchableOpacity
            style={[styles.trendCard, { backgroundColor: trendMsg.color + '14', borderColor: trendMsg.color + '44' }]}
            onPress={() => setShowMoodSummary(true)}
            activeOpacity={0.85}
          >
            <View style={[styles.trendIconWrap, { backgroundColor: trendMsg.color + '22' }]}>
              <Ionicons name={trendMsg.icon as any} size={22} color={trendMsg.color} />
            </View>
            <Text style={[styles.trendText, { color: trendMsg.color === SOFT ? MID : DARK }]}>
              {trendMsg.text}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={trendMsg.color} />
          </TouchableOpacity>
        </FadeSection>

        {/* ── Weekly mood breakdown ── */}
        <FadeSection delay={370}>
          <View style={[styles.statsCard, { backgroundColor: colors.card ?? WHITE }]}>
            <Text style={styles.cardTitle}>Weekly mood breakdown</Text>
            <View style={styles.statsGrid}>
              {Object.entries(weeklyStats).map(([mood, count]) => {
                const m = getMood(mood);
                return (
                  <View key={mood} style={[styles.statItem, { backgroundColor: m.bg }]}>
                    <Ionicons name={m.icon as any} size={26} color={m.color} />
                    <Text style={[styles.statMood, { color: m.color }]}>{mood}</Text>
                    <Text style={styles.statCount}>{count as number}d</Text>
                  </View>
                );
              })}
              {Object.keys(weeklyStats).length === 0 && (
                <View style={styles.noDataWrap}>
                  <Ionicons name="bar-chart-outline" size={28} color={SOFT} />
                  <Text style={styles.noData}>Log a mood to start your summary</Text>
                </View>
              )}
            </View>
          </View>
        </FadeSection>

        {/* ── Recent diary ── */}
        {journalEntries.length > 1 && (
          <FadeSection delay={400}>
            <View style={[styles.recentCard, { backgroundColor: colors.card ?? WHITE }]}>
              <Text style={styles.cardTitle}>Recent diary</Text>
              {journalEntries.slice(0, 4).map(entry => {
                const rating  = getRating(entry.dayRating);
                const moodE   = getMoodForDate(new Date(entry.date).toDateString());
                const moodM   = moodE ? getMood(moodE.mood) : null;
                return (
                  <View key={entry.id} style={styles.recentEntry}>
                    <View style={[styles.recentRatingDot, { backgroundColor: rating.color + '33' }]}>
                      <Ionicons name={rating.icon as any} size={14} color={rating.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.recentEntryTop}>
                        <Text style={styles.recentDate}>
                          {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                        {moodM && (
                          <View style={[styles.recentMoodBadge, { backgroundColor: moodM.bg }]}>
                            <Ionicons name={moodM.icon as any} size={10} color={moodM.color} />
                            <Text style={[styles.recentMoodTxt, { color: moodM.color }]}>{moodE!.mood}</Text>
                          </View>
                        )}
                        <View style={[styles.recentRatingBadge, { backgroundColor: rating.color + '18' }]}>
                          <Text style={[styles.recentRatingTxt, { color: rating.color }]}>{rating.label}</Text>
                        </View>
                      </View>
                      {!!entry.note && (
                        <Text style={styles.recentNote} numberOfLines={2}>{entry.note}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </FadeSection>
        )}

        {/* ── Daily Affirmation ── */}
        <FadeSection delay={440}>
          <View style={[styles.affirmationCard, { backgroundColor: colors.card ?? '#FFFBEB' }]}>
            <View style={styles.affirmationHeader}>
              <Ionicons name="sparkles" size={18} color={PINK} />
              <Text style={styles.affirmationTitle}>Daily affirmation</Text>
            </View>
            <Text style={styles.affirmation}>{affirmation}</Text>
          </View>
        </FadeSection>

        <View style={{ height: 36 }} />
      </ScrollView>

      {/* ── Mood trend detail modal ── */}
      <Modal visible={showMoodSummary} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowMoodSummary(false)}>
          <View style={styles.summarySheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.summaryTitle}>Your Week in Moods</Text>

            {Object.keys(weeklyStats).length === 0 ? (
              <Text style={styles.noData}>No mood data this week — start tracking today!</Text>
            ) : (
              <>
                {/* Mood bars */}
                {Object.entries(weeklyStats)
                  .sort((a, b) => b[1] - a[1])
                  .map(([moodKey, count]) => {
                    const m = getMood(moodKey);
                    const pct = (count / 7) * 100;
                    return (
                      <View key={moodKey} style={styles.summaryRow}>
                        <View style={[styles.summaryDot, { backgroundColor: m.bg }]}>
                          <Ionicons name={m.icon as any} size={14} color={m.color} />
                        </View>
                        <Text style={[styles.summaryMoodTxt, { color: m.color }]}>{moodKey}</Text>
                        <View style={styles.summaryBarBg}>
                          <View style={[styles.summaryBarFill, { width: `${pct}%`, backgroundColor: m.color }]} />
                        </View>
                        <Text style={[styles.summaryCount, { color: m.color }]}>{count}d</Text>
                      </View>
                    );
                  })}

                {/* Encouragements */}
                <View style={styles.summaryEncRow}>
                  <Ionicons name="heart" size={14} color={PINK} />
                  <Text style={styles.summaryEncTxt}>{trendMsg.text}</Text>
                </View>
              </>
            )}

            <TouchableOpacity style={styles.summaryClose} onPress={() => setShowMoodSummary(false)}>
              <Text style={styles.summaryCloseTxt}>Got it</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Journal / Diary modal ── */}
      <Modal visible={showJournal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.journalModalBg}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.journalSheet}>
            <View style={styles.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.journalSheetTitle}>
                {editingJournal ? "Edit today's diary" : "How was your day?"}
              </Text>

              {/* Day rating */}
              <Text style={styles.journalSectionLabel}>Rate your day</Text>
              <View style={styles.ratingRow}>
                {DAY_RATINGS.map(r => (
                  <TouchableOpacity
                    key={r.key}
                    onPress={() => setJournalRating(r.key)}
                    style={[
                      styles.ratingBtn,
                      { backgroundColor: r.color + '18', borderColor: journalRating === r.key ? r.color : 'transparent' },
                    ]}
                  >
                    <Ionicons name={r.icon as any} size={22} color={r.color} />
                    <Text style={[styles.ratingBtnTxt, { color: r.color }]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Inquisitive question */}
              <View style={styles.journalQuestionBox}>
                <Ionicons name="help-circle" size={16} color={PINK} />
                <Text style={styles.journalQuestionTxt}>{dailyQuestion}</Text>
              </View>
              <TextInput
                style={styles.journalAnswerInput}
                placeholder="Your answer..."
                placeholderTextColor={SOFT}
                value={questionAnswer}
                onChangeText={setQuestionAnswer}
                multiline
                maxLength={300}
              />

              {/* Free note */}
              <Text style={styles.journalSectionLabel}>Anything else?</Text>
              <TextInput
                style={styles.journalNoteInput}
                placeholder="Write freely — no rules here"
                placeholderTextColor={SOFT}
                value={journalNote}
                onChangeText={setJournalNote}
                multiline
                maxLength={600}
              />

              <View style={styles.journalBtnRow}>
                <TouchableOpacity onPress={() => setShowJournal(false)} style={styles.journalCancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveJournalEntry} style={styles.journalSaveBtn}>
                  <Ionicons name="checkmark" size={16} color={WHITE} />
                  <Text style={styles.journalSaveTxt}>Save diary</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function getGreeting() {
  const greetings: Record<string, string[]> = {
    morning:   ['Good morning ☀️', 'Rise and shine ✨', 'Morning, you 🌸'],
    afternoon: ['Hey, you 👋', 'Good afternoon 🌤️', 'Hope your day\'s going well 💛'],
    evening:   ['Good evening 🌙', 'Hey, how\'d it go? 🌟', 'End of day check-in ✨'],
  };
  const tod = getTimeOfDay();
  const opts = greetings[tod];
  return opts[new Date().getDate() % opts.length];
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Header
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  headerGreeting:{ fontSize: 22, fontWeight: '800', color: DARK, letterSpacing: -0.4 },
  headerSub:     { fontSize: 13, color: MID, marginTop: 2 },
  headerRight:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  journalFab:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: PINK, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22, elevation: 3, shadowColor: PINK, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  journalFabTxt: { color: WHITE, fontWeight: '700', fontSize: 12 },
  streakBadge:   { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFF4ED', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1.5, borderColor: '#F97316' },
  streakTxt:     { fontSize: 12, fontWeight: '800', color: '#F97316' },

  // Music row
  musicRow:    { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 4, backgroundColor: DARK, borderRadius: 20, padding: 16, gap: 12 },
  musicMeta:   { flex: 1 },
  musicLabel:  { fontSize: 16, fontWeight: '800', color: WHITE },
  musicSub:    { fontSize: 12, color: SOFT, marginTop: 2 },
  musicBtn:    { width: 60, height: 60, borderRadius: 30, backgroundColor: PINK, justifyContent: 'center', alignItems: 'center', shadowColor: PINK, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  musicBtnInner: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  vinylOuter:  { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  vinylInner:  { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

  // Quote card
  quoteCard:        { margin: 20, marginBottom: 12, padding: 20, backgroundColor: WHITE, borderRadius: 20, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  quoteModeRow:     { flexDirection: 'row', gap: 8, marginBottom: 14, alignSelf: 'stretch', justifyContent: 'center' },
  quoteModeBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5, borderColor: '#EDD8E8' },
  quoteModeBtnActive:    { backgroundColor: PINK, borderColor: PINK },
  quoteModeBtnActiveAlt: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  quoteModeTxt:     { fontSize: 12, fontWeight: '600', color: SOFT },
  quoteText:        { fontSize: 16, fontStyle: 'italic', textAlign: 'center', marginVertical: 10, color: DARK, lineHeight: 24 },
  quoteAuthor:      { color: PINK, fontSize: 13, fontWeight: '600' },
  refreshQuote:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  refreshQuoteTxt:  { color: SOFT, fontSize: 12 },

  // Question card
  questionCard:      { marginHorizontal: 20, marginBottom: 12, padding: 18, backgroundColor: '#FFF0F7', borderRadius: 18, borderLeftWidth: 3, borderLeftColor: PINK },
  questionHeader:    { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  questionLabel:     { fontSize: 12, fontWeight: '700', color: PINK, textTransform: 'uppercase', letterSpacing: 0.5 },
  questionText:      { fontSize: 15, color: DARK, fontWeight: '500', lineHeight: 22 },
  answerPreview:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, backgroundColor: WHITE, padding: 10, borderRadius: 12 },
  answerPreviewTxt:  { flex: 1, fontSize: 13, color: MID, fontStyle: 'italic' },
  answerBtn:         { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, alignSelf: 'flex-start' },
  answerBtnTxt:      { color: PINK, fontSize: 13, fontWeight: '600' },

  // Today mood
  todayCard:         { margin: 20, marginBottom: 12, padding: 20, borderRadius: 20, backgroundColor: WHITE, elevation: 1 },
  cardTitle:         { fontSize: 15, fontWeight: '700', color: PINK, marginBottom: 10 },
  todayMoodRow:      { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 6 },
  todayMoodIcon:     { width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center' },
  todayMoodLabel:    { fontSize: 22, fontWeight: '800' },
  moodEncouragement: { fontSize: 12, color: MID, marginTop: 4, maxWidth: W * 0.55, lineHeight: 17 },
  updateButton:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ROSE, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 10, alignSelf: 'flex-start' },
  updateText:        { color: PINK, fontWeight: '600', fontSize: 13 },

  // Challenge
  challengeCard:      { marginHorizontal: 20, marginBottom: 12, padding: 16, backgroundColor: WHITE, borderRadius: 20, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  challengeHeader:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  challengeIconWrap:  { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  challengeCategory:  { fontSize: 10, fontWeight: '700', color: SOFT, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  challengeText:      { fontSize: 14, color: DARK, fontWeight: '500', lineHeight: 20 },
  challengeBtn:       { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 20, alignSelf: 'flex-start' },
  challengeBtnTxt:    { color: WHITE, fontWeight: '700', fontSize: 13 },

  // Trend card
  trendCard:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginBottom: 12, padding: 14, borderRadius: 18, borderWidth: 1.5 },
  trendIconWrap:  { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  trendText:      { flex: 1, fontSize: 13, color: DARK, lineHeight: 19, fontWeight: '500' },

  // Journal summary
  journalSummaryCard:   { marginHorizontal: 20, marginBottom: 12, padding: 16, backgroundColor: WHITE, borderRadius: 18, elevation: 1 },
  journalSummaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  daySummaryRating:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  daySummaryRatingTxt:  { fontSize: 13, fontWeight: '700' },
  journalSummaryNote:   { fontSize: 13, color: MID, lineHeight: 19 },

  // Calendar strip
  calCard:        { marginHorizontal: 20, marginBottom: 12, padding: 16, backgroundColor: WHITE, borderRadius: 20, elevation: 1 },
  calRow:         { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  calDay:         { alignItems: 'center', flex: 1 },
  calDayToday:    { backgroundColor: '#FFF0F7', borderRadius: 12, paddingVertical: 4 },
  calDayLabel:    { fontSize: 10, color: MID, fontWeight: '600', marginBottom: 4 },
  calMoodCircle:  { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  calRatingDot:   { width: 7, height: 7, borderRadius: 4 },
  calLegend:      { flexDirection: 'row', gap: 16, marginTop: 10, justifyContent: 'center' },
  calLegendItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calLegendTxt:   { fontSize: 10, color: SOFT },

  // Weekly stats
  statsCard:  { marginHorizontal: 20, marginBottom: 12, padding: 20, backgroundColor: WHITE, borderRadius: 20, elevation: 1 },
  statsGrid:  { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 10 },
  statItem:   { alignItems: 'center', minWidth: 72, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 16 },
  statMood:   { fontSize: 11, marginTop: 4, fontWeight: '600' },
  statCount:  { fontSize: 10, color: MID, marginTop: 2 },
  noDataWrap: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  noData:     { textAlign: 'center', color: SOFT, fontSize: 13 },

  // Recent diary
  recentCard:        { marginHorizontal: 20, marginBottom: 12, padding: 16, backgroundColor: WHITE, borderRadius: 20, elevation: 1 },
  recentEntry:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3E8EF' },
  recentRatingDot:   { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  recentEntryTop:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4, flexWrap: 'wrap' },
  recentDate:        { fontSize: 12, fontWeight: '700', color: DARK },
  recentMoodBadge:   { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  recentMoodTxt:     { fontSize: 10, fontWeight: '600' },
  recentRatingBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  recentRatingTxt:   { fontSize: 10, fontWeight: '600' },
  recentNote:        { fontSize: 12, color: MID, lineHeight: 17 },

  // Affirmation
  affirmationCard:   { marginHorizontal: 20, marginBottom: 8, padding: 22, backgroundColor: '#FFFBEB', borderRadius: 20, alignItems: 'center' },
  affirmationHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  affirmationTitle:  { fontSize: 15, fontWeight: '700', color: PINK },
  affirmation:       { fontSize: 14, textAlign: 'center', color: DARK, lineHeight: 22 },

  // Mood summary modal
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  summarySheet:      { backgroundColor: WHITE, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 36 },
  summaryTitle:      { fontSize: 20, fontWeight: '800', color: DARK, marginBottom: 18, textAlign: 'center' },
  summaryRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  summaryDot:        { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  summaryMoodTxt:    { fontSize: 13, fontWeight: '700', width: 80 },
  summaryBarBg:      { flex: 1, height: 8, backgroundColor: '#F3E8EF', borderRadius: 4, overflow: 'hidden' },
  summaryBarFill:    { height: 8, borderRadius: 4 },
  summaryCount:      { fontSize: 12, fontWeight: '700', width: 22, textAlign: 'right' },
  summaryEncRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: ROSE, borderRadius: 14, padding: 12, marginTop: 16 },
  summaryEncTxt:     { flex: 1, fontSize: 13, color: DARK, lineHeight: 19, fontWeight: '500' },
  summaryClose:      { marginTop: 20, alignSelf: 'center', backgroundColor: PINK, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 22 },
  summaryCloseTxt:   { color: WHITE, fontWeight: '700', fontSize: 15 },

  // Journal sheet modal
  journalModalBg:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  journalSheet:        { backgroundColor: WHITE, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '92%' },
  sheetHandle:         { width: 40, height: 4, backgroundColor: '#EDD8E8', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  journalSheetTitle:   { fontSize: 20, fontWeight: '800', color: DARK, textAlign: 'center', marginBottom: 16 },
  journalSectionLabel: { fontSize: 13, fontWeight: '700', color: DARK, marginBottom: 8, marginTop: 4 },
  ratingRow:           { flexDirection: 'row', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  ratingBtn:           { flex: 1, minWidth: 52, alignItems: 'center', paddingVertical: 10, borderRadius: 14, borderWidth: 2, gap: 3 },
  ratingBtnTxt:        { fontSize: 10, fontWeight: '700' },
  journalQuestionBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: '#FFF0F7', borderRadius: 14, padding: 12, marginBottom: 8 },
  journalQuestionTxt:  { flex: 1, fontSize: 14, color: DARK, fontStyle: 'italic', lineHeight: 20 },
  journalAnswerInput:  { borderWidth: 1.5, borderColor: '#EDD8E8', borderRadius: 14, padding: 13, height: 80, textAlignVertical: 'top', fontSize: 14, color: DARK, marginBottom: 14 },
  journalNoteInput:    { borderWidth: 1.5, borderColor: '#EDD8E8', borderRadius: 14, padding: 13, height: 110, textAlignVertical: 'top', fontSize: 14, color: DARK, marginBottom: 18 },
  journalBtnRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 },
  journalCancelBtn:    { paddingVertical: 10 },
  cancelText:          { color: MID, fontSize: 15 },
  journalSaveBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: PINK, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 22, elevation: 3 },
  journalSaveTxt:      { color: WHITE, fontWeight: '700', fontSize: 15 },
});
