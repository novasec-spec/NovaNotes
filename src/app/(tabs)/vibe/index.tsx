// src/app/(tabs)/vibe.tsx - COMPLETE FIX
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Dimensions, Alert, TextInput, Modal, Animated,
  KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import MoodTracker, { ALL_MOODS, MOOD_CATEGORIES } from '../../../components/MoodTracker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../contexts/ThemeContext';
import { supabase } from '../../../config/supabase';

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

// ── Mood-based Quotes ──────────────────────────────────────────────────────
const MOOD_QUOTES: Record<string, { text: string; author: string }[]> = {
  happy: [
    { text: "Happiness is not something ready made. It comes from your own actions", author: "Dalai Lama" },
    { text: "The most important thing is to enjoy your life—to be happy—it's all that matters", author: "Audrey Hepburn" },
    { text: "Your smile is the sunshine that lights up my world", author: "Your Person ☀️" },
  ],
  loved: [
    { text: "To be loved is to be seen, known, and cherished", author: "Unknown 💕" },
    { text: "Love is not about how many days, months, or years you've been together. Love is about how much you love each other every single day", author: "Unknown" },
    { text: "You are the best thing that's ever been mine", author: "Taylor Swift 🎵" },
  ],
  sad: [
    { text: "It's okay to be sad. It's okay to not be okay. Your feelings are valid", author: "Unknown 🌸" },
    { text: "The pain you feel today is the strength you'll feel tomorrow", author: "Unknown 💪" },
    { text: "Every storm runs out of rain", author: "Maya Angelou 🌈" },
  ],
  angry: [
    { text: "For every minute you remain angry, you give up sixty seconds of peace of mind", author: "Ralph Waldo Emerson" },
    { text: "Anger is an acid that can do more harm to the vessel in which it is stored than to anything on which it is poured", author: "Mark Twain" },
    { text: "Take a deep breath. You are stronger than this moment", author: "Unknown 🌿" },
  ],
  anxious: [
    { text: "Anxiety is not a weakness. It's a sign that you've been strong for too long", author: "Unknown 💕" },
    { text: "Worrying is like paying a debt you don't owe", author: "Mark Twain" },
    { text: "You are not your anxiety. You are the one who notices it", author: "Unknown 🌸" },
  ],
  grateful: [
    { text: "Gratitude turns what we have into enough, and more", author: "Aesop" },
    { text: "The more grateful I am, the more beauty I see", author: "Mary Davis" },
    { text: "Gratitude is the fairest blossom which springs from the soul", author: "Henry Ward Beecher" },
  ],
  dreamy: [
    { text: "The future belongs to those who believe in the beauty of their dreams", author: "Eleanor Roosevelt" },
    { text: "Dreams are the whispers of your soul", author: "Unknown 🌙" },
    { text: "Let your dreams take flight. The sky is not the limit", author: "Unknown ✨" },
  ],
  energetic: [
    { text: "Energy is contagious. Positive energy is a choice", author: "Unknown ⚡" },
    { text: "Your energy introduces you before you even speak", author: "Unknown" },
    { text: "Radiate positive energy, and the world will reflect it back to you", author: "Unknown 🌟" },
  ],
  tired: [
    { text: "Rest is not idleness, and to lie sometimes on the grass under trees is not a waste of time", author: "J.R.R. Tolkien" },
    { text: "Sometimes the most productive thing you can do is rest", author: "Unknown 🌿" },
    { text: "You deserve to rest. You are not a machine", author: "Unknown 💕" },
  ],
  motivated: [
    { text: "You are never too old to set another goal or to dream a new dream", author: "C.S. Lewis" },
    { text: "The secret of getting ahead is getting started", author: "Mark Twain" },
    { text: "Believe you can and you're halfway there", author: "Theodore Roosevelt" },
  ],
  lazy: [
    { text: "Rest when you need to, but don't quit", author: "Unknown 💪" },
    { text: "Sometimes taking a break is the most productive thing you can do", author: "Unknown 🌸" },
    { text: "You don't have to do it all at once. Just start", author: "Unknown ✨" },
  ],
  focused: [
    { text: "Stay focused, stay strong, and keep moving forward", author: "Unknown 💪" },
    { text: "Focus on being productive instead of busy", author: "Tim Ferriss" },
    { text: "Where focus goes, energy flows", author: "Tony Robbins" },
  ],
  restless: [
    { text: "Sometimes you need to sit with your restlessness and understand it", author: "Unknown 🌿" },
    { text: "The restless heart finds peace in surrender", author: "Unknown" },
    { text: "Breathe. You are exactly where you need to be", author: "Unknown 🌸" },
  ],
  calm: [
    { text: "Calm mind brings inner strength and self-confidence", author: "Dalai Lama" },
    { text: "Peace is not the absence of conflict, but the ability to cope with it", author: "Unknown" },
    { text: "Breathe in peace, breathe out tension", author: "Unknown 🌿" },
  ],
  stressed: [
    { text: "Stress is caused by being here but wanting to be there", author: "Eckhart Tolle" },
    { text: "You are enough. You have enough. You do enough", author: "Unknown 💕" },
    { text: "Take a break. You deserve it", author: "Unknown 🌸" },
  ],
  refreshed: [
    { text: "Rest and self-care are so important. When you take time to replenish, your spirit will thank you", author: "Unknown" },
    { text: "A quiet mind is a peaceful mind", author: "Unknown 🌿" },
    { text: "Recharge your soul, and let your heart shine", author: "Unknown ✨" },
  ],
  sick: [
    { text: "Your body is your temple. Listen to what it needs", author: "Unknown 🌸" },
    { text: "Healing is a process. Be patient with yourself", author: "Unknown 💕" },
    { text: "Rest is the best medicine. Take care of yourself", author: "Unknown 🌿" },
  ],
  strong: [
    { text: "You are stronger than you know, more capable than you imagine", author: "Unknown 💪" },
    { text: "Strength doesn't come from what you can do. It comes from overcoming the things you once thought you couldn't", author: "Rikki Rogers" },
    { text: "She stood in the storm and when the wind did not blow her way, she adjusted her sails", author: "Elizabeth Edwards" },
  ],
  nourished: [
    { text: "Nourish yourself with love, kindness, and positive energy", author: "Unknown 🌸" },
    { text: "You are what you eat, think, and believe", author: "Unknown" },
    { text: "Feed your soul with what makes you happy", author: "Unknown ✨" },
  ],
  social: [
    { text: "The best conversations happen with the best people", author: "Unknown 💕" },
    { text: "Surround yourself with people who make you feel good about yourself", author: "Unknown" },
    { text: "Friendship is the only cement that will ever hold the world together", author: "Woodrow Wilson" },
  ],
  lonely: [
    { text: "Loneliness is not the absence of people, but the absence of connection", author: "Unknown 🌸" },
    { text: "You are never alone. You are loved more than you know", author: "Unknown 💕" },
    { text: "Even in solitude, you are whole", author: "Unknown 🌙" },
  ],
  missing: [
    { text: "Missing someone is a reminder that you love deeply", author: "Unknown 💕" },
    { text: "Distance means so little when someone means so much", author: "Unknown" },
    { text: "The pain of missing you is a beautiful reminder of the love we share", author: "Unknown 💫" },
  ],
  connected: [
    { text: "We are all connected, like stars in the same sky", author: "Unknown ✨" },
    { text: "Connection is the energy that exists between people when they feel seen, heard, and valued", author: "Brené Brown" },
    { text: "In true connection, the soul finds its home", author: "Unknown 🌸" },
  ],
  playful: [
    { text: "Play is the highest form of research", author: "Albert Einstein" },
    { text: "Be silly. Be honest. Be kind", author: "Ralph Waldo Emerson" },
    { text: "Life is short. Play more, worry less", author: "Unknown 🎉" },
  ],
  romantic: [
    { text: "Love is composed of a single soul inhabiting two bodies", author: "Aristotle" },
    { text: "I have found the one whom my soul loves", author: "Song of Solomon 💕" },
    { text: "Love is the poetry of the senses", author: "Honoré de Balzac" },
  ],
  blessed: [
    { text: "Count your blessings, not your problems", author: "Unknown 🙏" },
    { text: "Blessed is the one who trusts in the Lord", author: "Jeremiah 17:7" },
    { text: "You are blessed beyond measure", author: "Unknown ✨" },
  ],
  prayerful: [
    { text: "Prayer is the key to heaven, but faith unlocks the door", author: "Unknown 🙏" },
    { text: "Don't worry about anything; instead, pray about everything", author: "Philippians 4:6" },
    { text: "Prayer connects you to the divine within you", author: "Unknown 🌸" },
  ],
  hopeful: [
    { text: "Hope is the thing with feathers that perches in the soul", author: "Emily Dickinson" },
    { text: "Where there is hope, there is life", author: "Unknown 🌅" },
    { text: "Hope sees the invisible, feels the intangible, and achieves the impossible", author: "Unknown ✨" },
  ],
  peaceful: [
    { text: "Peace begins with a smile", author: "Mother Teresa" },
    { text: "The most valuable thing you can give is your presence and peace", author: "Unknown 🌿" },
    { text: "True peace is not the absence of noise, but the presence of stillness", author: "Unknown" },
  ],
  curious: [
    { text: "Curiosity is the wick in the candle of learning", author: "William Arthur Ward" },
    { text: "The important thing is not to stop questioning", author: "Albert Einstein" },
    { text: "Curiosity keeps the mind young", author: "Unknown ✨" },
  ],
};

// ─── Mood-based Music ──────────────────────────────────────────────────────
const MOOD_MUSIC: Record<string, { title: string; artist: string; emoji: string }[]> = {
  happy: [
    { title: "Happy", artist: "Pharrell Williams", emoji: "🎵" },
    { title: "Can't Stop The Feeling!", artist: "Justin Timberlake", emoji: "🎶" },
    { title: "Good as Hell", artist: "Lizzo", emoji: "💃" },
  ],
  loved: [
    { title: "Perfect", artist: "Ed Sheeran", emoji: "💕" },
    { title: "All of Me", artist: "John Legend", emoji: "❤️" },
    { title: "Thinking Out Loud", artist: "Ed Sheeran", emoji: "🎵" },
  ],
  sad: [
    { title: "Someone Like You", artist: "Adele", emoji: "🎹" },
    { title: "Fix You", artist: "Coldplay", emoji: "🌟" },
    { title: "The Night We Met", artist: "Lord Huron", emoji: "🌙" },
  ],
  relaxed: [
    { title: "Weightless", artist: "Marconi Union", emoji: "🌿" },
    { title: "Clair de Lune", artist: "Debussy", emoji: "🎹" },
    { title: "Sunset Lover", artist: "Petit Biscuit", emoji: "🌅" },
  ],
  calm: [
    { title: "Weightless", artist: "Marconi Union", emoji: "🌿" },
    { title: "Clair de Lune", artist: "Debussy", emoji: "🎹" },
    { title: "Sunset Lover", artist: "Petit Biscuit", emoji: "🌅" },
  ],
  grateful: [
    { title: "Thank You", artist: "Dido", emoji: "🙏" },
    { title: "Blessings", artist: "Chance the Rapper", emoji: "✨" },
    { title: "Grateful", artist: "Mahalia", emoji: "💕" },
  ],
  energetic: [
    { title: "Uptown Funk", artist: "Mark Ronson", emoji: "🕺" },
    { title: "Shake It Off", artist: "Taylor Swift", emoji: "💃" },
    { title: "Dance Monkey", artist: "Tones and I", emoji: "🐒" },
  ],
  motivated: [
    { title: "Fight Song", artist: "Rachel Platten", emoji: "💪" },
    { title: "Roar", artist: "Katy Perry", emoji: "🦁" },
    { title: "Unstoppable", artist: "Sia", emoji: "🚀" },
  ],
  romantic: [
    { title: "At My Worst", artist: "Pink Sweat$", emoji: "💕" },
    { title: "I Will Always Love You", artist: "Whitney Houston", emoji: "❤️" },
    { title: "Can't Help Falling in Love", artist: "Elvis Presley", emoji: "🎵" },
  ],
  blessed: [
    { title: "Blessed", artist: "Travis Greene", emoji: "🙏" },
    { title: "Way Maker", artist: "Sinach", emoji: "✨" },
    { title: "You Are Good", artist: "Israel Houghton", emoji: "🌟" },
  ],
  prayerful: [
    { title: "Break Every Chain", artist: "Tasha Cobbs", emoji: "🙏" },
    { title: "Oceans", artist: "Hillsong", emoji: "🌊" },
    { title: "Goodness of God", artist: "CeCe Winans", emoji: "✨" },
  ],
  thoughtful: [
    { title: "The Scientist", artist: "Coldplay", emoji: "🔬" },
    { title: "Someone Like You", artist: "Adele", emoji: "🎹" },
    { title: "Fix You", artist: "Coldplay", emoji: "🌟" },
  ],
  frustrated: [
    { title: "Fight Song", artist: "Rachel Platten", emoji: "💪" },
    { title: "Roar", artist: "Katy Perry", emoji: "🦁" },
    { title: "Unstoppable", artist: "Sia", emoji: "🚀" },
  ],
  anxious: [
    { title: "Breathe", artist: "Telepopmusik", emoji: "🌬️" },
    { title: "Weightless", artist: "Marconi Union", emoji: "🌿" },
    { title: "Sunset Lover", artist: "Petit Biscuit", emoji: "🌅" },
  ],
};

// ─── Default Music ─────────────────────────────────────────────────────────
const DEFAULT_MUSIC = [
  { title: "Perfect", artist: "Ed Sheeran", emoji: "💕" },
  { title: "Someone Like You", artist: "Adele", emoji: "🎹" },
  { title: "Happy", artist: "Pharrell Williams", emoji: "🎵" },
];

// ─── Sweet & Funny Quotes ──────────────────────────────────────────────────
const SWEET_QUOTES = [
  { text: "You are enough. You have always been enough.", author: "Your Person 💕" },
  { text: "Your smile is my favorite thing to see", author: "Keep Smiling 😊" },
  { text: "You are stronger than you know and braver than you feel", author: "Warrior 💪" },
  { text: "You make the world a better place just by being in it", author: "Truth 🌍" },
  { text: "Your kindness is your superpower", author: "Hero 🦸" },
  { text: "Today is going to be a good day because you're in it", author: "Morning Boost ☀️" },
];

const FUNNY_QUOTES = [
  { text: "You're like coffee — essential, warm, and some people don't deserve you.", author: "Factual ☕" },
  { text: "You're not lazy. You're on energy-saving mode. Very eco-friendly.", author: "Efficiency Expert 🌿" },
  { text: "Napping is basically time travel to when you feel better. Very scientific.", author: "Dr. Pillow 🔬" },
  { text: "You walked past a mirror today and it said 'okay wow'.", author: "Eyewitness 🪞" },
];

// ─── Day-of-week labels ────────────────────────────────────────────────────
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Journal / Mood types ──────────────────────────────────────────────────
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

// ─── Day rating config ─────────────────────────────────────────────────────
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

// ─── Mood-aware encouragements ────────────────────────────────────────────
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

// ─── Daily Challenges ──────────────────────────────────────────────────────
const DAILY_CHALLENGES = [
  { icon: 'water', color: '#3B82F6', text: 'Drink 8 glasses of water today', category: 'Health' },
  { icon: 'walk', color: MINT, text: 'Take a 10-minute walk outside', category: 'Movement' },
  { icon: 'phone-portrait-outline', color: '#F97316', text: 'Phone-free for 30 mins before bed', category: 'Wind down' },
  { icon: 'chatbubble-outline', color: PINK, text: 'Text someone you haven\'t talked to in a while', category: 'Connection' },
  { icon: 'book-outline', color: PURPLE, text: 'Read 10 pages of anything you like', category: 'Mind' },
  { icon: 'sunny-outline', color: AMBER, text: 'Step outside for at least 5 minutes', category: 'Mood' },
];

// ─── Mood Questions ────────────────────────────────────────────────────────
const MOOD_QUESTIONS = [
  "What's one tiny thing that made you smile today?",
  "On a scale of sleepy to full of life — where are you landing?",
  "Is there anything sitting heavy on your chest right now?",
  "What emotion is living rent-free in your head today?",
  "If today had a colour, what would it be and why?",
  "What's the best part of your day so far?",
];

// ─── Affirmations ──────────────────────────────────────────────────────────
const AFFIRMATIONS = [
  "You are loved, you are cherished, and you make this world more beautiful.",
  "Your feelings matter. It's okay to feel everything deeply.",
  "Today you are enough. Tomorrow you will be enough too.",
  "The love you give always finds its way back to you.",
  "Your presence is a gift — to yourself and everyone around you.",
  "Be gentle with yourself today. You're doing better than you know.",
];

// ─── Helpers ───────────────────────────────────────────────────────────────
function getMoodColor(moodId: string) {
  if (!moodId) return '#FF6B9D';
  const mood = ALL_MOODS.find(m => m.id === moodId.toLowerCase());
  return mood?.color || '#FF6B9D';
}

function getMoodEmoji(moodId: string) {
  if (!moodId) return 'emoticon-outline';
  const mood = ALL_MOODS.find(m => m.id === moodId.toLowerCase());
  return mood?.icon || 'emoticon-outline';
}

function getMoodById(moodId: string) {
  if (!moodId) return ALL_MOODS[0];
  return ALL_MOODS.find(m => m.id === moodId.toLowerCase()) || ALL_MOODS[0];
}

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

// ─── Fade Section ──────────────────────────────────────────────────────────
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

// ─── Pulsing Music Button ──────────────────────────────────────────────────
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
        <View style={styles.vinylOuter}>
          <View style={styles.vinylInner}>
            <Ionicons name="musical-notes" size={22} color={WHITE} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
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
  const [showAllQuotes,    setShowAllQuotes]    = useState(false);

  // Journal modal
  const [journalNote,      setJournalNote]      = useState('');
  const [journalRating,    setJournalRating]    = useState<DayRating>('okay');
  const [questionAnswer,   setQuestionAnswer]   = useState('');
  const [editingJournal,   setEditingJournal]   = useState(false);

  const checkAnim = useRef(new Animated.Value(0)).current;
  const backupTimer = useRef<NodeJS.Timeout | null>(null);
  const userId = 'alice'; // Replace with actual user ID

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadData();
    startIdleBackup();
    return () => {
      if (backupTimer.current) clearInterval(backupTimer.current);
    };
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

  // ── Load Data ─────────────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      const history = await AsyncStorage.getItem('moodHistory');
      const journal = await AsyncStorage.getItem('journalEntries');
      const streakSaved = await AsyncStorage.getItem('moodStreak');

      // Load moods
      if (history) {
        const parsed: MoodEntry[] = JSON.parse(history);
        setMoodHistory(parsed);
        const today = new Date().toDateString();
        const todayEntry = parsed.find(m => m.mood && new Date(m.timestamp).toDateString() === today);
        setTodayMood(todayEntry ?? null);
        
        const last7 = getLast7Days();
        const stats: Record<string, number> = {};
        parsed.forEach(m => {
          if (m.mood && last7.includes(new Date(m.timestamp).toDateString())) {
            stats[m.mood] = (stats[m.mood] || 0) + 1;
          }
        });
        setWeeklyStats(stats);
      }

      // Load journal
      if (journal) {
        const entries: JournalEntry[] = JSON.parse(journal);
        setJournalEntries(entries);
        const today = new Date().toDateString();
        setTodayJournal(entries.find(e => new Date(e.date).toDateString() === today) ?? null);
      }

      // Load streak
      if (streakSaved) {
        setStreak(parseInt(streakSaved, 10));
      }

      // Load challenge
      const today = new Date().toDateString();
      const savedChallenge = await AsyncStorage.getItem('dailyChallenge');
      const doneSaved = await AsyncStorage.getItem('challengeDone');
      
      if (savedChallenge) {
        const { date, index } = JSON.parse(savedChallenge);
        if (date === today) {
          setChallenge(DAILY_CHALLENGES[index]);
          setChallengeDone(doneSaved === today);
        } else {
          const idx = new Date().getDate() % DAILY_CHALLENGES.length;
          await AsyncStorage.setItem('dailyChallenge', JSON.stringify({ date: today, index: idx }));
          setChallenge(DAILY_CHALLENGES[idx]);
          setChallengeDone(false);
        }
      } else {
        const idx = new Date().getDate() % DAILY_CHALLENGES.length;
        await AsyncStorage.setItem('dailyChallenge', JSON.stringify({ date: today, index: idx }));
        setChallenge(DAILY_CHALLENGES[idx]);
        setChallengeDone(false);
      }

      // Daily question
      const idx = (new Date().getDay() + new Date().getDate()) % MOOD_QUESTIONS.length;
      setDailyQuestion(MOOD_QUESTIONS[idx]);

      // Affirmation
      setAffirmation(AFFIRMATIONS[new Date().getDate() % AFFIRMATIONS.length]);

      // Quote
      pickQuote('sweet');

    } catch (error) {
      console.error('Load data error:', error);
    }
  };

  // ─── IDLE BACKUP ──────────────────────────────────────────────────────────
  const startIdleBackup = () => {
    if (backupTimer.current) clearInterval(backupTimer.current);
    backupTimer.current = setInterval(() => {
      performAutoBackup();
    }, 30000); // Every 30 seconds when idle
  };

  const performAutoBackup = async () => {
    try {
      const moodHistory = await AsyncStorage.getItem('moodHistory');
      const journalEntries = await AsyncStorage.getItem('journalEntries');
      const streak = await AsyncStorage.getItem('moodStreak');
      const lastBackup = await AsyncStorage.getItem('lastVibeBackup');
      
      // Only backup if data has changed (or first time)
      const currentData = JSON.stringify({
        mood: moodHistory,
        journal: journalEntries,
        streak: streak
      });
      
      if (lastBackup === currentData) return; // No changes
      
      await supabase.from('user_vibe_data').upsert({
        user_id: userId,
        mood_history: moodHistory ? JSON.parse(moodHistory) : [],
        journal_entries: journalEntries ? JSON.parse(journalEntries) : [],
        streak: parseInt(streak || '0'),
        last_backup: new Date().toISOString()
      });
      
      await AsyncStorage.setItem('lastVibeBackup', currentData);
      console.log('✅ Auto-backup completed');
    } catch (error) {
      console.error('Auto-backup error:', error);
    }
  };

  // ─── Save Journal ────────────────────────────────────────────────────────
  const saveJournalEntries = async (entries: JournalEntry[]) => {
    await AsyncStorage.setItem('journalEntries', JSON.stringify(entries));
    setJournalEntries(entries);
    const today = new Date().toDateString();
    setTodayJournal(entries.find(e => new Date(e.date).toDateString() === today) ?? null);
    // Trigger auto-backup
    setTimeout(() => performAutoBackup(), 1000);
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

  // ─── Quote ────────────────────────────────────────────────────────────────
  const pickQuote = (mode: 'sweet' | 'funny') => {
    const pool = mode === 'funny' ? FUNNY_QUOTES : SWEET_QUOTES;
    setTodaysQuote(pool[Math.floor(Math.random() * pool.length)]);
    setQuoteMode(mode);
  };

  // ─── Challenge ────────────────────────────────────────────────────────────
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
    performAutoBackup();
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const getJournalForDate = (dateStr: string) =>
    journalEntries.find(e => new Date(e.date).toDateString() === dateStr);
  const getMoodForDate = (dateStr: string) =>
    moodHistory.find(m => m.mood && new Date(m.timestamp).toDateString() === dateStr);
  const last7 = getLast7Days().reverse();

  const getMoodQuotes = () => {
    if (!todayMood?.mood) return [];
    const moodId = todayMood.mood.toLowerCase();
    return MOOD_QUOTES[moodId] || MOOD_QUOTES.happy || [];
  };

  const getMoodMusic = () => {
    if (!todayMood?.mood) return DEFAULT_MUSIC;
    const moodId = todayMood.mood.toLowerCase();
    return MOOD_MUSIC[moodId] || DEFAULT_MUSIC;
  };

  const moodQuotes = getMoodQuotes();
  const moodMusic = getMoodMusic();

  const moodEncouragements = todayMood?.mood
    ? MOOD_ENCOURAGEMENTS[todayMood.mood] ?? []
    : [];
  const todayEncouragement = moodEncouragements.length > 0
    ? moodEncouragements[new Date().getHours() % moodEncouragements.length]
    : '';

  const getMoodTrendMessage = () => {
    const total = Object.values(weeklyStats).reduce((a, b) => a + b, 0);
    if (total === 0) return { text: 'No mood data yet this week — start tracking!', icon: 'analytics-outline', color: SOFT };

    const topMood = Object.entries(weeklyStats).sort((a, b) => b[1] - a[1])[0];
    const [moodKey, count] = topMood;
    const pct = Math.round((count / total) * 100);
    const m = getMoodById(moodKey);

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
      icon: m?.icon || 'emoticon-outline',
      color: m?.color || SOFT,
    };
  };

  const trendMsg = getMoodTrendMessage();
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
              {streak > 0 && (
                <View style={styles.streakBadge}>
                  <Ionicons name="flame" size={14} color="#F97316" />
                  <Text style={styles.streakTxt}>{streak}</Text>
                </View>
              )}
              <TouchableOpacity 
                style={[styles.dashboardBtn, { backgroundColor: colors.card ?? WHITE }]}
                onPress={() => router.push('/vibe/vibe-dashboard')}
              >
                <Ionicons name="stats-chart" size={18} color={PINK} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.journalFab} onPress={openJournal}>
                <Ionicons name={todayJournal ? 'checkmark-circle' : 'journal'} size={18} color={WHITE} />
                <Text style={styles.journalFabTxt}>{todayJournal ? 'Diary ✓' : 'Write'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </FadeSection>

        {/* ── Music button ── */}
        <FadeSection delay={30}>
          <View style={styles.musicRow}>
            <View style={styles.musicMeta}>
              <Text style={styles.musicLabel}>Mood Music</Text>
              <Text style={styles.musicSub}>Pick a playlist for your vibe</Text>
            </View>
            <MusicButton onPress={() => router.push('/vibe/moodmusic')} />
          </View>
        </FadeSection>

        {/* ── Quote card ── */}
        <FadeSection delay={60}>
          <View style={[styles.quoteCard, { backgroundColor: colors.card ?? WHITE }]}>
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

        {/* ─── MOOD TRACKER ─── */}
        <FadeSection delay={180}>
          {todayMood?.mood ? (
            <View style={[styles.todayCard, { backgroundColor: colors.card ?? WHITE }]}>
              <Text style={styles.cardTitle}>Today's mood</Text>
              <View style={styles.todayMoodRow}>
                <View style={[styles.todayMoodIcon, { backgroundColor: getMoodColor(todayMood.mood) + '22' }]}>
                  <Ionicons name={getMoodEmoji(todayMood.mood) as any} size={34} color={getMoodColor(todayMood.mood)} />
                </View>
                <View>
                  <Text style={[styles.todayMoodLabel, { color: getMoodColor(todayMood.mood) }]}>
                    {todayMood.mood}
                  </Text>
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
          ) : (
            <MoodTracker onMoodSelect={() => loadData()} />
          )}
        </FadeSection>

        {/* ─── MOOD-BASED QUOTES ─── */}
        {todayMood?.mood && moodQuotes.length > 0 && (
          <FadeSection delay={200}>
            <View style={[styles.quotesSection, { backgroundColor: colors.card ?? WHITE }]}>
              <View style={styles.quotesHeader}>
                <Ionicons name="quote" size={18} color={PINK} />
                <Text style={[styles.quotesTitle, { color: colors.text ?? DARK }]}>
                  Quotes for your {todayMood.mood} mood
                </Text>
              </View>
              {(showAllQuotes ? moodQuotes : moodQuotes.slice(0, 2)).map((quote, index) => (
                <View key={index} style={[styles.quoteItem, { borderLeftColor: getMoodColor(todayMood.mood) }]}>
                  <Text style={[styles.quoteItemText, { color: colors.text ?? DARK }]}>
                    "{quote.text}"
                  </Text>
                  <Text style={[styles.quoteItemAuthor, { color: colors.muted ?? MID }]}>
                    — {quote.author}
                  </Text>
                </View>
              ))}
              {moodQuotes.length > 2 && (
                <TouchableOpacity 
                  onPress={() => setShowAllQuotes(!showAllQuotes)}
                  style={styles.showMoreBtn}
                >
                  <Text style={[styles.showMoreText, { color: PINK }]}>
                    {showAllQuotes ? 'Show less' : `Show all ${moodQuotes.length} quotes`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </FadeSection>
        )}

        {/* ─── MOOD-BASED MUSIC ─── */}
        {todayMood?.mood && (
          <FadeSection delay={240}>
            <View style={[styles.musicSection, { backgroundColor: colors.card ?? WHITE }]}>
              <View style={styles.musicSectionHeader}>
                <Ionicons name="musical-notes" size={18} color={PINK} />
                <Text style={[styles.musicSectionTitle, { color: colors.text ?? DARK }]}>
                  Songs for your vibe
                </Text>
              </View>
              {moodMusic.map((song, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={[styles.songItem, { borderBottomColor: colors.border ?? '#EDD8E8' }]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.songEmoji}>{song.emoji}</Text>
                  <View style={styles.songInfo}>
                    <Text style={[styles.songTitle, { color: colors.text ?? DARK }]}>{song.title}</Text>
                    <Text style={[styles.songArtist, { color: colors.muted ?? MID }]}>{song.artist}</Text>
                  </View>
                  <Ionicons name="play-circle-outline" size={28} color={PINK} />
                </TouchableOpacity>
              ))}
            </View>
          </FadeSection>
        )}

        {/* ─── Daily challenge card ── */}
        <FadeSection delay={260}>
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

        {/* ─── Today's diary summary ── */}
        {todayJournal && (
          <FadeSection delay={300}>
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

        {/* ─── 7-day calendar strip ── */}
        <FadeSection delay={340}>
          <View style={[styles.calCard, { backgroundColor: colors.card ?? WHITE }]}>
            <Text style={styles.cardTitle}>This week</Text>
            <View style={styles.calRow}>
              {last7.map((dayStr) => {
                const moodEntry    = getMoodForDate(dayStr);
                const journalEntry = getJournalForDate(dayStr);
                const isToday      = dayStr === new Date().toDateString();
                const dayLabel     = DAY_LABELS[new Date(dayStr).getDay()];
                const mood         = moodEntry?.mood ? getMoodById(moodEntry.mood) : null;
                const rating       = journalEntry ? getRating(journalEntry.dayRating) : null;

                return (
                  <View key={dayStr} style={[styles.calDay, isToday && styles.calDayToday]}>
                    <Text style={[styles.calDayLabel, isToday && { color: PINK }]}>{dayLabel}</Text>
                    <View style={[styles.calMoodCircle, { backgroundColor: mood ? mood.color + '22' : '#F3F4F6' }]}>
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

        {/* ─── Mood trend summary ── */}
        <FadeSection delay={380}>
          <TouchableOpacity
            style={[styles.trendCard, { backgroundColor: trendMsg.color + '14', borderColor: trendMsg.color + '44' }]}
            onPress={() => setShowMoodSummary(true)}
            activeOpacity={0.85}
          >
            <View style={[styles.trendIconWrap, { backgroundColor: trendMsg.color + '22' }]}>
              <Ionicons name={trendMsg.icon as any} size={22} color={trendMsg.color} />
            </View>
            <Text style={[styles.trendText, { color: colors.text ?? DARK }]}>
              {trendMsg.text}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={trendMsg.color} />
          </TouchableOpacity>
        </FadeSection>

        {/* ─── Weekly mood breakdown ── */}
        <FadeSection delay={420}>
          <View style={[styles.statsCard, { backgroundColor: colors.card ?? WHITE }]}>
            <Text style={styles.cardTitle}>Weekly mood breakdown</Text>
            <View style={styles.statsGrid}>
              {Object.entries(weeklyStats).map(([mood, count]) => {
                const m = getMoodById(mood);
                return (
                  <View key={mood} style={[styles.statItem, { backgroundColor: m.color + '18' }]}>
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

        {/* ─── Recent diary ── */}
        {journalEntries.length > 1 && (
          <FadeSection delay={460}>
            <View style={[styles.recentCard, { backgroundColor: colors.card ?? WHITE }]}>
              <Text style={styles.cardTitle}>Recent diary</Text>
              {journalEntries.slice(0, 4).map(entry => {
                const rating  = getRating(entry.dayRating);
                const moodE   = getMoodForDate(new Date(entry.date).toDateString());
                const moodM   = moodE?.mood ? getMoodById(moodE.mood) : null;
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
                          <View style={[styles.recentMoodBadge, { backgroundColor: moodM.color + '22' }]}>
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

        {/* ─── Daily Affirmation ── */}
        <FadeSection delay={500}>
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

      {/* ─── Mood trend detail modal ── */}
      <Modal visible={showMoodSummary} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowMoodSummary(false)}>
          <View style={styles.summarySheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.summaryTitle}>Your Week in Moods</Text>

            {Object.keys(weeklyStats).length === 0 ? (
              <Text style={styles.noData}>No mood data this week — start tracking today!</Text>
            ) : (
              <>
                {Object.entries(weeklyStats)
                  .sort((a, b) => b[1] - a[1])
                  .map(([moodKey, count]) => {
                    const m = getMoodById(moodKey);
                    const pct = (count / 7) * 100;
                    return (
                      <View key={moodKey} style={styles.summaryRow}>
                        <View style={[styles.summaryDot, { backgroundColor: m.color + '22' }]}>
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

      {/* ─── Journal / Diary modal ── */}
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

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, paddingBottom: 100 },

  // Header
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  headerGreeting:{ fontSize: 22, fontWeight: '800', color: DARK, letterSpacing: -0.4 },
  headerSub:     { fontSize: 13, color: MID, marginTop: 2 },
  headerRight:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  journalFab:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: PINK, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22, elevation: 3, shadowColor: PINK, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  journalFabTxt: { color: WHITE, fontWeight: '700', fontSize: 12 },
  dashboardBtn:  { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: PINK + '44' },
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

  // Mood Quotes Section
  quotesSection:     { marginHorizontal: 20, marginBottom: 12, padding: 16, borderRadius: 18, elevation: 1 },
  quotesHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  quotesTitle:       { fontSize: 15, fontWeight: '700' },
  quoteItem:         { paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6, borderLeftWidth: 3, borderRadius: 4 },
  quoteItemText:     { fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  quoteItemAuthor:   { fontSize: 12, marginTop: 4 },
  showMoreBtn:       { alignItems: 'center', paddingTop: 8 },
  showMoreText:      { fontSize: 13, fontWeight: '600' },

  // Mood Music Section
  musicSection:      { marginHorizontal: 20, marginBottom: 12, padding: 16, borderRadius: 18, elevation: 1 },
  musicSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  musicSectionTitle: { fontSize: 15, fontWeight: '700' },
  songItem:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, gap: 12 },
  songEmoji:         { fontSize: 20 },
  songInfo:          { flex: 1 },
  songTitle:         { fontSize: 14, fontWeight: '600' },
  songArtist:        { fontSize: 12, marginTop: 2 },

  // Challenge
  challengeCard:      { marginHorizontal: 20, marginBottom: 12, padding: 16, backgroundColor: WHITE, borderRadius: 20, elevation: 1 },
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
