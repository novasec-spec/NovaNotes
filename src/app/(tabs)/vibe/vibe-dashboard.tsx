// src/app/(tabs)/vibe-dashboard.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '../../../config/supabase';

interface MoodEntry {
  mood: string;
  timestamp: string;
}

interface JournalEntry {
  id: string;
  date: string;
  note: string;
  dayRating: string;
}

export default function VibeDashboard() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [moodData, setMoodData] = useState<{
    total: number;
    thisWeek: number;
    mostCommon: string;
    distribution: Record<string, number>;
  }>({ total: 0, thisWeek: 0, mostCommon: 'None', distribution: {} });

  const [journalData, setJournalData] = useState<{
    total: number;
    thisWeek: number;
    mostUsedRating: string;
  }>({ total: 0, thisWeek: 0, mostUsedRating: 'None' });

  const [streak, setStreak] = useState(0);
  const [challengesDone, setChallengesDone] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load from Supabase first (cloud backup)
      const { data: cloudData, error } = await supabase
        .from('user_vibe_data')
        .select('*')
        .eq('user_id', 'alice')
        .order('last_backup', { ascending: false })
        .limit(1);

      if (!error && cloudData && cloudData.length > 0) {
        const data = cloudData[0];
        processMoodData(data.mood_history || []);
        processJournalData(data.journal_entries || []);
        setStreak(data.streak || 0);
      }

      // Also load from local for latest
      const localMood = await AsyncStorage.getItem('moodHistory');
      const localJournal = await AsyncStorage.getItem('journalEntries');
      const localStreak = await AsyncStorage.getItem('moodStreak');

      if (localMood) {
        processMoodData(JSON.parse(localMood));
      }
      if (localJournal) {
        processJournalData(JSON.parse(localJournal));
      }
      if (localStreak) {
        setStreak(parseInt(localStreak, 10));
      }

      setLoading(false);
    } catch (error) {
      console.error('Load dashboard error:', error);
      setLoading(false);
    }
  };

  const processMoodData = (entries: MoodEntry[]) => {
    if (!entries || entries.length === 0) return;

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const thisWeek = entries.filter((e) => new Date(e.timestamp) > weekAgo);
    const distribution: Record<string, number> = {};
    entries.forEach((e) => {
      distribution[e.mood] = (distribution[e.mood] || 0) + 1;
    });

    let mostCommon = 'None';
    let maxCount = 0;
    Object.entries(distribution).forEach(([mood, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = mood;
      }
    });

    setMoodData({
      total: entries.length,
      thisWeek: thisWeek.length,
      mostCommon,
      distribution,
    });
  };

  const processJournalData = (entries: JournalEntry[]) => {
    if (!entries || entries.length === 0) return;

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const thisWeek = entries.filter((e) => new Date(e.date) > weekAgo);
    const ratingCount: Record<string, number> = {};
    entries.forEach((e) => {
      ratingCount[e.dayRating] = (ratingCount[e.dayRating] || 0) + 1;
    });

    let mostUsed = 'None';
    let maxCount = 0;
    Object.entries(ratingCount).forEach(([rating, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostUsed = rating;
      }
    });

    setJournalData({
      total: entries.length,
      thisWeek: thisWeek.length,
      mostUsedRating: mostUsed,
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getMoodEmoji = (mood: string) => {
    const emojis: Record<string, string> = {
      happy: '😊',
      loved: '🥰',
      relaxed: '😌',
      thoughtful: '🤔',
      sad: '😢',
      frustrated: '😤',
      anxious: '😰',
      grateful: '🙏',
      dreamy: '🌙',
      energetic: '⚡',
      tired: '😴',
      motivated: '💪',
      lazy: '🛋️',
      focused: '🎯',
      restless: '🌊',
      calm: '🧘',
      stressed: '😫',
      refreshed: '🌿',
      sick: '🤒',
      strong: '🦁',
      nourished: '🍎',
      social: '👥',
      lonely: '🥺',
      missing: '💔',
      connected: '🤝',
      playful: '🎉',
      romantic: '💕',
      blessed: '✨',
      prayerful: '🙏',
      hopeful: '🌈',
      peaceful: '🕊️',
      curious: '🔍',
    };
    return emojis[mood.toLowerCase()] || '😊';
  };

  const getColor = (mood: string) => {
    const colors: Record<string, string> = {
      happy: '#F59E0B',
      loved: '#FF6B9D',
      relaxed: '#22C55E',
      thoughtful: '#A855F7',
      sad: '#60A5FA',
      frustrated: '#F97316',
      anxious: '#8B5CF6',
      grateful: '#14B8A6',
      dreamy: '#A78BFA',
      energetic: '#F97316',
      tired: '#94A3B8',
      motivated: '#3B82F6',
      lazy: '#D97706',
      focused: '#0EA5E9',
      restless: '#EC4899',
      calm: '#10B981',
      stressed: '#F43F5E',
      refreshed: '#06B6D4',
      sick: '#FB923C',
      strong: '#7C3AED',
      nourished: '#84CC16',
      social: '#F472B6',
      lonely: '#64748B',
      missing: '#E879F9',
      connected: '#2DD4BF',
      playful: '#FBBF24',
      romantic: '#F43F5E',
      blessed: '#A855F7',
      prayerful: '#8B5CF6',
      hopeful: '#FCD34D',
      peaceful: '#34D399',
      curious: '#38BDF8',
    };
    return colors[mood.toLowerCase()] || '#FF6B9D';
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading your vibes...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B9D" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>📊 Vibe Dashboard</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Streak Card */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="flame" size={24} color="#F97316" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Streak</Text>
          </View>
          <Text style={[styles.bigNumber, { color: '#F97316' }]}>{streak}</Text>
          <Text style={[styles.cardSub, { color: colors.muted }]}>days in a row</Text>
        </View>

        {/* Mood Stats */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="happy-outline" size={24} color="#FF6B9D" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Mood Tracker</Text>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.text }]}>{moodData.total}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Total logs</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.text }]}>{moodData.thisWeek}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>This week</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: getColor(moodData.mostCommon) }]}>
                {getMoodEmoji(moodData.mostCommon)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Most common</Text>
            </View>
          </View>

          {/* Mood Distribution */}
          {Object.keys(moodData.distribution).length > 0 && (
            <View style={styles.distributionContainer}>
              <Text style={[styles.distributionTitle, { color: colors.muted }]}>Distribution</Text>
              {Object.entries(moodData.distribution)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([mood, count]) => (
                  <View key={mood} style={styles.distributionRow}>
                    <Text style={[styles.distributionMood, { color: getColor(mood) }]}>
                      {getMoodEmoji(mood)} {mood}
                    </Text>
                    <View style={styles.distributionBarBg}>
                      <View
                        style={[
                          styles.distributionBar,
                          {
                            width: `${(count / moodData.total) * 100}%`,
                            backgroundColor: getColor(mood),
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.distributionCount, { color: colors.muted }]}>{count}</Text>
                  </View>
                ))}
            </View>
          )}
        </View>

        {/* Journal Stats */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="journal-outline" size={24} color="#A855F7" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Journal</Text>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.text }]}>{journalData.total}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Total entries</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.text }]}>{journalData.thisWeek}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>This week</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.text }]}>{journalData.mostUsedRating}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Most used rating</Text>
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="checkmark-circle-outline" size={24} color="#22C55E" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Challenges</Text>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#22C55E' }]}>
                {Math.floor(challengesDone / 7) || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Weeks</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#22C55E' }]}>{challengesDone || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Completed</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.footerNote, { color: colors.muted }]}>
          Data backed up to cloud every 30 seconds 📦
        </Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, fontWeight: '500' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: '800' },

  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSub: { fontSize: 13, textAlign: 'center', marginTop: 2 },

  bigNumber: { fontSize: 48, fontWeight: '900', textAlign: 'center' },

  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E5E7EB',
  },

  distributionContainer: { marginTop: 12 },
  distributionTitle: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  distributionMood: { fontSize: 13, fontWeight: '500', width: 80 },
  distributionBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  distributionBar: { height: 6, borderRadius: 3 },
  distributionCount: { fontSize: 12, width: 24, textAlign: 'right' },

  footerNote: { fontSize: 12, textAlign: 'center', marginTop: 8, paddingHorizontal: 16 },
});
