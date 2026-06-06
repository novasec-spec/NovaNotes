// screens/VibeScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Dimensions, Alert, TextInput, Modal, Animated,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import MoodTracker from '../../components/MoodTracker';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
const { width: W } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const PINK    = '#FF6B9D';
const ROSE    = '#FFE4ED';
const BG      = '#FFF5F7';
const WHITE   = '#FFFFFF';
const DARK    = '#2D1B25';
const MID     = '#9A7090';
const SOFT    = '#C4A0B8';
const CARD_BG = '#FFFFFF';

// ── Quotes — YOUR ORIGINAL array ─────────────────────────────────────────────
const quotes = [
  { text: "You make my world brighter just by being in it",         author: "Your Love"  },
  { text: "Every love story is beautiful, but ours is my favorite", author: "Unknown"    },
  { text: "In a sea of people, my eyes will always search only for you", author: "Unknown" },
  { text: "You are my today and all of my tomorrows",               author: "Unknown"    },
  { text: "Loving you never gets old",                              author: "Unknown"    },
];

// ── Rotating daily affirmations ───────────────────────────────────────────────
const AFFIRMATIONS = [
  "You are loved, you are cherished, and you make this world more beautiful.",
  "Your feelings matter. It's okay to feel everything deeply.",
  "Today you are enough. Tomorrow you will be enough too.",
  "The love you give always finds its way back to you.",
  "Your presence is a gift — to yourself and everyone around you.",
  "Be gentle with yourself today. You're doing better than you know.",
  "Every day you choose love, you are choosing the best version of yourself.",
];

// ── Inquisitive mood questions ────────────────────────────────────────────────
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

// ── Mood config — Ionicons only, no emojis ────────────────────────────────────
const MOODS = [
  { key: 'Happy',       icon: 'sunny',           color: '#F59E0B', bg: '#FFFBEB', label: 'Happy'       },
  { key: 'Loved',       icon: 'heart',           color: '#EF4444', bg: '#FFF0F0', label: 'Loved'       },
  { key: 'Relaxed',     icon: 'leaf',            color: '#22C55E', bg: '#F0FDF4', label: 'Relaxed'     },
  { key: 'Thoughtful',  icon: 'bulb',            color: '#8B5CF6', bg: '#F5F3FF', label: 'Thoughtful'  },
  { key: 'Sad',         icon: 'rainy',           color: '#6B7280', bg: '#F3F4F6', label: 'Sad'         },
  { key: 'Frustrated',  icon: 'thunderstorm',    color: '#F97316', bg: '#FFF4ED', label: 'Frustrated'  },
  { key: 'Anxious',     icon: 'pulse',           color: '#EC4899', bg: '#FDF2F8', label: 'Anxious'     },
  { key: 'Grateful',    icon: 'sparkles',        color: '#14B8A6', bg: '#F0FDFA', label: 'Grateful'    },
] as const;

type MoodKey = typeof MOODS[number]['key'];

function getMood(key?: string) {
  return MOODS.find(m => m.key === key) ?? MOODS[0];
}

// ── Day-of-week labels ────────────────────────────────────────────────────────
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Journal entry type ────────────────────────────────────────────────────────
interface JournalEntry {
  id:        string;
  date:      string;        // ISO date string
  note:      string;
  dayRating: 'great' | 'good' | 'okay' | 'rough' | 'bad';
  question?: string;        // the inquisitive question that was shown
  answer?:   string;        // her answer to it
}

interface MoodEntry {
  mood:      string;
  timestamp: string;
  note?:     string;
}

// ── Day rating config ─────────────────────────────────────────────────────────
const DAY_RATINGS = [
  { key: 'great', icon: 'star',         color: '#F59E0B', label: 'Great'  },
  { key: 'good',  icon: 'happy',        color: '#22C55E', label: 'Good'   },
  { key: 'okay',  icon: 'remove-circle',color: '#6B7280', label: 'Okay'   },
  { key: 'rough', icon: 'cloudy',       color: '#F97316', label: 'Rough'  },
  { key: 'bad',   icon: 'thunderstorm', color: '#EF4444', label: 'Bad'    },
] as const;

type DayRating = typeof DAY_RATINGS[number]['key'];

function getRating(key?: string) {
  return DAY_RATINGS.find(r => r.key === key) ?? DAY_RATINGS[2];
}

// ── Animated fade-in section ──────────────────────────────────────────────────
function FadeSection({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
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

// ══════════════════════════════════════════════════════════════════════════════
export default function VibeScreen() {

  // ── YOUR ORIGINAL STATE ───────────────────────────────────────────────────
  const [todayMood,    setTodayMood]    = useState<MoodEntry | null>(null);
  const [moodHistory,  setMoodHistory]  = useState<MoodEntry[]>([]);
  const [weeklyStats,  setWeeklyStats]  = useState<Record<string, number>>({});
  const [todaysQuote,  setTodaysQuote]  = useState(quotes[0]);

  // ── NEW STATE ─────────────────────────────────────────────────────────────
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [showJournal,    setShowJournal]    = useState(false);
  const [todayJournal,   setTodayJournal]   = useState<JournalEntry | null>(null);
  const [dailyQuestion,  setDailyQuestion]  = useState('');
  const [affirmation,    setAffirmation]    = useState('');

  // Journal modal state
  const [journalNote,    setJournalNote]    = useState('');
  const [journalRating,  setJournalRating]  = useState<DayRating>('okay');
  const [questionAnswer, setQuestionAnswer] = useState('');
  const [editingJournal, setEditingJournal] = useState(false);

  // ── YOUR ORIGINAL useEffect ───────────────────────────────────────────────
  useEffect(() => {
    loadMoodData();
    loadTodaysQuote();
    loadJournalData();
    pickDailyQuestion();
    pickAffirmation();
  }, []);

  // ── YOUR ORIGINAL loadMoodData ────────────────────────────────────────────
  const loadMoodData = async () => {
    const history = await AsyncStorage.getItem('moodHistory');
    if (history) {
      const parsed: MoodEntry[] = JSON.parse(history);
      setMoodHistory(parsed);

      // Check today's mood — YOUR ORIGINAL logic
      const today = new Date().toDateString();
      const todayEntry = parsed.find(m => new Date(m.timestamp).toDateString() === today);
      setTodayMood(todayEntry ?? null);

      // Calculate weekly stats — YOUR ORIGINAL logic
      const last7Days = getLast7Days();
      const stats: Record<string, number> = {};
      parsed.forEach(mood => {
        const date = new Date(mood.timestamp).toDateString();
        if (last7Days.includes(date)) {
          stats[mood.mood] = (stats[mood.mood] || 0) + 1;
        }
      });
      setWeeklyStats(stats);
    }
  };

  // ── YOUR ORIGINAL getLast7Days ────────────────────────────────────────────
  const getLast7Days = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toDateString());
    }
    return days;
  };

  // ── YOUR ORIGINAL loadTodaysQuote ─────────────────────────────────────────
  const loadTodaysQuote = () => {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    setTodaysQuote(quotes[randomIndex]);
  };

  // ── YOUR ORIGINAL getMoodEmoji — replaced with icon lookup ────────────────
  const getMoodIcon = (mood: string) => getMood(mood).icon;
  const getMoodColor = (mood: string) => getMood(mood).color;

  // ── NEW: Journal logic ────────────────────────────────────────────────────
  const loadJournalData = async () => {
    const saved = await AsyncStorage.getItem('journalEntries');
    if (saved) {
      const entries: JournalEntry[] = JSON.parse(saved);
      setJournalEntries(entries);
      const today = new Date().toDateString();
      const todayEntry = entries.find(e => new Date(e.date).toDateString() === today);
      setTodayJournal(todayEntry ?? null);
    }
  };

  const saveJournalEntries = async (entries: JournalEntry[]) => {
    await AsyncStorage.setItem('journalEntries', JSON.stringify(entries));
    setJournalEntries(entries);
    const today = new Date().toDateString();
    const todayEntry = entries.find(e => new Date(e.date).toDateString() === today);
    setTodayJournal(todayEntry ?? null);
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
      Alert.alert('Write something', 'Add a note or answer the question before saving 💕');
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
    // Deterministic by day so it stays the same all day
    const dayIndex = new Date().getDay() + new Date().getDate();
    setDailyQuestion(MOOD_QUESTIONS[dayIndex % MOOD_QUESTIONS.length]);
  };

  const pickAffirmation = () => {
    const dayIndex = new Date().getDate();
    setAffirmation(AFFIRMATIONS[dayIndex % AFFIRMATIONS.length]);
  };

  // Build last-7-days calendar row
  const last7 = getLast7Days().reverse(); // oldest first

  const getJournalForDate = (dateStr: string) =>
    journalEntries.find(e => new Date(e.date).toDateString() === dateStr);

  const getMoodForDate = (dateStr: string) =>
    moodHistory.find(m => new Date(m.timestamp).toDateString() === dateStr);

  // ─────────────────────────────────────────────────────────────────────────
  return (
<SafeAreaView style={styles.container} edges={['top']}> 
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <FadeSection delay={0}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerGreeting}>Good {getTimeOfDay()} 🌸</Text>
              <Text style={styles.headerSub}>How's your heart today?</Text>
            </View>
            <TouchableOpacity style={styles.journalFab} onPress={openJournal}>
              <Icon name={todayJournal ? 'checkmark-circle' : 'journal'} size={20} color={WHITE} />
              <Text style={styles.journalFabTxt}>{todayJournal ? 'Diary' : 'Write'}</Text>
            </TouchableOpacity>
          </View>
        </FadeSection>

        {/* ── Quote card — YOUR ORIGINAL structure ── */}
        <FadeSection delay={60}>
          <View style={styles.quoteCard}>
            <Icon name="chatbubble-ellipses" size={26} color={PINK} />
            <Text style={styles.quoteText}>"{todaysQuote.text}"</Text>
            <Text style={styles.quoteAuthor}>— {todaysQuote.author}</Text>
            <TouchableOpacity onPress={loadTodaysQuote} style={styles.refreshQuote}>
              <Icon name="refresh" size={14} color={SOFT} />
              <Text style={styles.refreshQuoteTxt}>New quote</Text>
            </TouchableOpacity>
          </View>
        </FadeSection>

        {/* ── Daily inquisitive question ── */}
        <FadeSection delay={120}>
          <View style={styles.questionCard}>
            <View style={styles.questionHeader}>
              <Icon name="help-circle" size={20} color={PINK} />
              <Text style={styles.questionLabel}>Today's question</Text>
            </View>
            <Text style={styles.questionText}>{dailyQuestion}</Text>
            {todayJournal?.answer ? (
              <View style={styles.answerPreview}>
                <Icon name="checkmark-circle" size={14} color={PINK} />
                <Text style={styles.answerPreviewTxt} numberOfLines={2}>{todayJournal.answer}</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.answerBtn} onPress={openJournal}>
                <Icon name="pencil" size={14} color={PINK} />
                <Text style={styles.answerBtnTxt}>Answer in diary</Text>
              </TouchableOpacity>
            )}
          </View>
        </FadeSection>

        {/* ── Mood tracker — YOUR ORIGINAL MoodTracker component or today card ── */}
        <FadeSection delay={180}>
          {!todayMood ? (
            <MoodTracker onMoodSelect={() => loadMoodData()} />
          ) : (
            <View style={[styles.todayCard, { backgroundColor: getMood(todayMood.mood).bg }]}>
              <Text style={styles.cardTitle}>Today's Mood</Text>
              <View style={styles.todayMoodRow}>
                <View style={[styles.todayMoodIcon, { backgroundColor: getMoodColor(todayMood.mood) + '22' }]}>
                  <Icon name={getMoodIcon(todayMood.mood) as any} size={32} color={getMoodColor(todayMood.mood)} />
                </View>
                <Text style={[styles.todayMoodLabel, { color: getMoodColor(todayMood.mood) }]}>
                  {todayMood.mood}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.updateButton}
                onPress={() => {
                  setTodayMood(null);
                  Alert.alert('Update Mood', 'How are you feeling now?');
                }}
              >
                <Icon name="refresh" size={14} color={PINK} />
                <Text style={styles.updateText}>Update Mood</Text>
              </TouchableOpacity>
            </View>
          )}
        </FadeSection>

        {/* ── Today's day journal summary ── */}
        {todayJournal && (
          <FadeSection delay={220}>
            <View style={styles.journalSummaryCard}>
              <View style={styles.journalSummaryHeader}>
                <Icon name="journal" size={16} color={PINK} />
                <Text style={styles.journalSummaryTitle}>Today's diary</Text>
                <TouchableOpacity onPress={openJournal} style={{ marginLeft: 'auto' }}>
                  <Icon name="pencil" size={16} color={SOFT} />
                </TouchableOpacity>
              </View>
              {/* Day rating */}
              <View style={styles.daySummaryRating}>
                <Icon
                  name={getRating(todayJournal.dayRating).icon as any}
                  size={18}
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

        {/* ── 7-day mood + journal calendar strip ── */}
        <FadeSection delay={260}>
          <View style={styles.calCard}>
            <Text style={styles.cardTitle}>This week</Text>
            <View style={styles.calRow}>
              {last7.map((dayStr, i) => {
                const moodEntry    = getMoodForDate(dayStr);
                const journalEntry = getJournalForDate(dayStr);
                const isToday      = dayStr === new Date().toDateString();
                const dayLabel     = DAY_LABELS[new Date(dayStr).getDay()];
                const mood         = moodEntry ? getMood(moodEntry.mood) : null;
                const rating       = journalEntry ? getRating(journalEntry.dayRating) : null;

                return (
                  <View key={dayStr} style={[styles.calDay, isToday && styles.calDayToday]}>
                    <Text style={[styles.calDayLabel, isToday && { color: PINK }]}>{dayLabel}</Text>
                    {/* Mood icon */}
                    <View style={[
                      styles.calMoodCircle,
                      mood ? { backgroundColor: mood.bg } : { backgroundColor: '#F3F4F6' },
                    ]}>
                      {mood ? (
                        <Icon name={mood.icon as any} size={16} color={mood.color} />
                      ) : (
                        <Icon name="ellipse-outline" size={14} color={SOFT} />
                      )}
                    </View>
                    {/* Journal rating dot */}
                    {rating ? (
                      <View style={[styles.calRatingDot, { backgroundColor: rating.color }]} />
                    ) : (
                      <View style={[styles.calRatingDot, { backgroundColor: '#E5E7EB' }]} />
                    )}
                  </View>
                );
              })}
            </View>
            <View style={styles.calLegend}>
              <View style={styles.calLegendItem}>
                <Icon name="ellipse" size={8} color={PINK} />
                <Text style={styles.calLegendTxt}>Mood</Text>
              </View>
              <View style={styles.calLegendItem}>
                <View style={[styles.calRatingDot, { backgroundColor: MID }]} />
                <Text style={styles.calLegendTxt}>Diary rating</Text>
              </View>
            </View>
          </View>
        </FadeSection>

        {/* ── Weekly mood stats — YOUR ORIGINAL statsCard ── */}
        <FadeSection delay={310}>
          <View style={styles.statsCard}>
            <Text style={styles.cardTitle}>Weekly mood summary</Text>
            <View style={styles.statsGrid}>
              {Object.entries(weeklyStats).map(([mood, count]) => {
                const m = getMood(mood);
                return (
                  <View key={mood} style={[styles.statItem, { backgroundColor: m.bg }]}>
                    <Icon name={m.icon as any} size={28} color={m.color} />
                    <Text style={[styles.statMood, { color: m.color }]}>{mood}</Text>
                    <Text style={styles.statCount}>{count as number}d</Text>
                  </View>
                );
              })}
              {Object.keys(weeklyStats).length === 0 && (
                <View style={styles.noDataWrap}>
                  <Icon name="heart-outline" size={28} color={SOFT} />
                  <Text style={styles.noData}>No mood data this week yet</Text>
                </View>
              )}
            </View>
          </View>
        </FadeSection>

        {/* ── Recent journal entries ── */}
        {journalEntries.length > 1 && (
          <FadeSection delay={360}>
            <View style={styles.recentCard}>
              <Text style={styles.cardTitle}>Recent diary</Text>
              {journalEntries.slice(0, 4).map(entry => {
                const rating = getRating(entry.dayRating);
                const mood   = getMoodForDate(new Date(entry.date).toDateString());
                const moodM  = mood ? getMood(mood.mood) : null;
                return (
                  <View key={entry.id} style={styles.recentEntry}>
                    <View style={[styles.recentRatingDot, { backgroundColor: rating.color + '33' }]}>
                      <Icon name={rating.icon as any} size={14} color={rating.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.recentEntryTop}>
                        <Text style={styles.recentDate}>
                          {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                        {moodM && (
                          <View style={[styles.recentMoodBadge, { backgroundColor: moodM.bg }]}>
                            <Icon name={moodM.icon as any} size={11} color={moodM.color} />
                            <Text style={[styles.recentMoodTxt, { color: moodM.color }]}>{mood!.mood}</Text>
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

        {/* ── Daily Affirmation — YOUR ORIGINAL affirmationCard ── */}
        <FadeSection delay={410}>
          <View style={styles.affirmationCard}>
            <View style={styles.affirmationHeader}>
              <Icon name="sparkles" size={18} color={PINK} />
              <Text style={styles.affirmationTitle}>Daily Affirmation</Text>
            </View>
            <Text style={styles.affirmation}>{affirmation}</Text>
          </View>
        </FadeSection>

        <View style={{ height: 32 }} />
      </ScrollView>

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
                {editingJournal ? 'Edit today\'s diary' : 'How was your day?'}
              </Text>

              {/* Day rating selector */}
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
                    <Icon name={r.icon as any} size={22} color={r.color} />
                    <Text style={[styles.ratingBtnTxt, { color: r.color }]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Inquisitive question */}
              <View style={styles.journalQuestionBox}>
                <Icon name="help-circle" size={16} color={PINK} />
                <Text style={styles.journalQuestionTxt}>{dailyQuestion}</Text>
              </View>
              <TextInput
                style={styles.journalAnswerInput}
                placeholder="Write your answer here..."
                placeholderTextColor={SOFT}
                value={questionAnswer}
                onChangeText={setQuestionAnswer}
                multiline
                maxLength={300}
              />

              {/* Free-form note */}
              <Text style={styles.journalSectionLabel}>Anything else on your mind?</Text>
              <TextInput
                style={styles.journalNoteInput}
                placeholder="Write freely — no rules here 💕"
                placeholderTextColor={SOFT}
                value={journalNote}
                onChangeText={setJournalNote}
                multiline
                maxLength={600}
              />

              {/* Buttons */}
              <View style={styles.journalBtnRow}>
                <TouchableOpacity onPress={() => setShowJournal(false)} style={styles.journalCancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveJournalEntry} style={styles.journalSaveBtn}>
                  <Icon name="checkmark" size={16} color={WHITE} />
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

// ── Time of day helper ────────────────────────────────────────────────────────
function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Header
  header:              { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  headerGreeting:      { fontSize: 22, fontWeight: '800', color: DARK, letterSpacing: -0.4 },
  headerSub:           { fontSize: 13, color: MID, marginTop: 2 },
  journalFab:          { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: PINK, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22, elevation: 3, shadowColor: PINK, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  journalFabTxt:       { color: WHITE, fontWeight: '700', fontSize: 13 },

  // Quote card — YOUR ORIGINAL structure
  quoteCard:           { margin: 20, marginBottom: 12, padding: 22, backgroundColor: CARD_BG, borderRadius: 20, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  quoteText:           { fontSize: 17, fontStyle: 'italic', textAlign: 'center', marginVertical: 12, color: DARK, lineHeight: 25 },
  quoteAuthor:         { color: PINK, fontSize: 13, fontWeight: '600' },
  refreshQuote:        { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  refreshQuoteTxt:     { color: SOFT, fontSize: 12 },

  // Question card
  questionCard:        { marginHorizontal: 20, marginBottom: 12, padding: 18, backgroundColor: '#FFF0F7', borderRadius: 18, borderLeftWidth: 3, borderLeftColor: PINK },
  questionHeader:      { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  questionLabel:       { fontSize: 12, fontWeight: '700', color: PINK, textTransform: 'uppercase', letterSpacing: 0.5 },
  questionText:        { fontSize: 15, color: DARK, fontWeight: '500', lineHeight: 22 },
  answerPreview:       { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, backgroundColor: WHITE, padding: 10, borderRadius: 12 },
  answerPreviewTxt:    { flex: 1, fontSize: 13, color: MID, fontStyle: 'italic' },
  answerBtn:           { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, alignSelf: 'flex-start' },
  answerBtnTxt:        { color: PINK, fontSize: 13, fontWeight: '600' },

  // Today mood card — YOUR ORIGINAL todayCard
  todayCard:           { margin: 20, marginBottom: 12, padding: 20, borderRadius: 20, alignItems: 'center' },
  cardTitle:           { fontSize: 16, fontWeight: '700', color: PINK, marginBottom: 10 },
  todayMoodRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 },
  todayMoodIcon:       { width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center' },
  todayMoodLabel:      { fontSize: 26, fontWeight: '800' },
  updateButton:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: WHITE, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, marginTop: 10 },
  updateText:          { color: PINK, fontWeight: '600', fontSize: 14 },

  // Journal summary
  journalSummaryCard:  { marginHorizontal: 20, marginBottom: 12, padding: 16, backgroundColor: CARD_BG, borderRadius: 18, elevation: 1 },
  journalSummaryHeader:{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  journalSummaryTitle: { fontSize: 14, fontWeight: '700', color: DARK },
  daySummaryRating:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  daySummaryRatingTxt: { fontSize: 13, fontWeight: '700' },
  journalSummaryNote:  { fontSize: 13, color: MID, lineHeight: 19 },

  // Weekly calendar strip
  calCard:             { marginHorizontal: 20, marginBottom: 12, padding: 16, backgroundColor: CARD_BG, borderRadius: 20, elevation: 1 },
  calRow:              { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  calDay:              { alignItems: 'center', flex: 1 },
  calDayToday:         { backgroundColor: '#FFF0F7', borderRadius: 12, paddingVertical: 4 },
  calDayLabel:         { fontSize: 10, color: MID, fontWeight: '600', marginBottom: 4 },
  calMoodCircle:       { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  calRatingDot:        { width: 7, height: 7, borderRadius: 4 },
  calLegend:           { flexDirection: 'row', gap: 16, marginTop: 10, justifyContent: 'center' },
  calLegendItem:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calLegendTxt:        { fontSize: 10, color: SOFT },

  // Weekly stats — YOUR ORIGINAL statsCard
  statsCard:           { margin: 20, marginTop: 8, marginBottom: 12, padding: 20, backgroundColor: CARD_BG, borderRadius: 20, elevation: 1 },
  statsGrid:           { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 10 },
  statItem:            { alignItems: 'center', minWidth: 72, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 16 },
  statMood:            { fontSize: 11, marginTop: 4, fontWeight: '600' },
  statCount:           { fontSize: 10, color: MID, marginTop: 2 },
  noDataWrap:          { alignItems: 'center', paddingVertical: 16, gap: 8 },
  noData:              { textAlign: 'center', color: SOFT, fontSize: 13 },

  // Recent journal
  recentCard:          { marginHorizontal: 20, marginBottom: 12, padding: 16, backgroundColor: CARD_BG, borderRadius: 20, elevation: 1 },
  recentEntry:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3E8EF' },
  recentRatingDot:     { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  recentEntryTop:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  recentDate:          { fontSize: 12, fontWeight: '700', color: DARK },
  recentMoodBadge:     { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  recentMoodTxt:       { fontSize: 10, fontWeight: '600' },
  recentRatingBadge:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  recentRatingTxt:     { fontSize: 10, fontWeight: '600' },
  recentNote:          { fontSize: 12, color: MID, lineHeight: 17 },

  // Affirmation — YOUR ORIGINAL affirmationCard
  affirmationCard:     { marginHorizontal: 20, marginBottom: 8, padding: 22, backgroundColor: '#FFFBEB', borderRadius: 20, alignItems: 'center' },
  affirmationHeader:   { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  affirmationTitle:    { fontSize: 16, fontWeight: '700', color: PINK },
  affirmation:         { fontSize: 15, textAlign: 'center', color: DARK, lineHeight: 23 },

  // Journal sheet modal
  journalModalBg:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  journalSheet:        { backgroundColor: WHITE, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '92%' },
  sheetHandle:         { width: 40, height: 4, backgroundColor: '#EDD8E8', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  journalSheetTitle:   { fontSize: 20, fontWeight: '800', color: DARK, textAlign: 'center', marginBottom: 16 },
  journalSectionLabel: { fontSize: 13, fontWeight: '700', color: DARK, marginBottom: 8, marginTop: 4 },
  ratingRow:           { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  ratingBtn:           { flex: 1, minWidth: 56, alignItems: 'center', paddingVertical: 10, borderRadius: 14, borderWidth: 2, gap: 3 },
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
