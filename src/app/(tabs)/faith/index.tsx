// src/app/(tabs)/faith/index.tsx - FIXED IMPORTS
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useNavigation } from 'expo-router';
import { BIBLE_VERSES } from './bible-verse';
import { BibleVerse, PrayerRequest, SermonNote, PraiseReport } from './types';
import FaithNotificationService from './services/notificationService'; // ✅ FIXED IMPORT

const STORAGE_KEYS = {
  PRAYERS: 'faith_prayers',
  SERMONS: 'faith_sermons',
  PRAISES: 'faith_praises',
};

export default function FaithScreen() {
  const { colors, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [todaysVerse, setTodaysVerse] = useState<BibleVerse | null>(null);
  const [prayerCount, setPrayerCount] = useState(0);
  const [answeredPrayers, setAnsweredPrayers] = useState(0);
  const [sermonCount, setSermonCount] = useState(0);
  const [praiseCount, setPraiseCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'home' | 'bible' | 'prayer' | 'sermon' | 'praise'>('home');

  // ✅ FIXED: Get the service instance
//  const notificationService = FaithNotificationService;



  // ✅ Get notification service instance
  const notificationService = React.useMemo(() => {
    try {
      return FaithNotificationService.getInstance();
    } catch (error) {
      console.error('Error getting notification service:', error);
      return null;
    }
  }, []);

useEffect(() => {
    const initNotificationService = async () => {
      try {
        if (notificationService) {
          await notificationService.initialize();
          setIsNotificationReady(true);
          console.log('✅ Notification service initialized');
        }
      } catch (error) {
        console.error('Error initializing notification service:', error);
      }
    };
    initNotificationService();
  }, []);
  
useEffect(() => {
    loadData();
    setTodaysVerse(getTodaysVerse());
    loadUnreadCount();

    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
      loadUnreadCount();
    });

    return unsubscribe;
  }, []);

  const loadData = async () => {
    try {
      // Load prayers
      const prayers = await AsyncStorage.getItem(STORAGE_KEYS.PRAYERS);
      if (prayers) {
        const parsed: PrayerRequest[] = JSON.parse(prayers);
        setPrayerCount(parsed.length);
        setAnsweredPrayers(parsed.filter(p => p.answered).length);
      }

      // Load sermons
      const sermons = await AsyncStorage.getItem(STORAGE_KEYS.SERMONS);
      if (sermons) {
        const parsed: SermonNote[] = JSON.parse(sermons);
        setSermonCount(parsed.length);
      }

      // Load praises
      const praises = await AsyncStorage.getItem(STORAGE_KEYS.PRAISES);
      if (praises) {
        const parsed: PraiseReport[] = JSON.parse(praises);
        setPraiseCount(parsed.length);
      }
    } catch (error) {
      console.error('Error loading faith data:', error);
    }
  };

  // ✅ FIXED: Use the instance to call getUnreadCount
  const loadUnreadCount = async () => {
    try {
      if (notificationService && isNotificationReady) {
        const count = await notificationService.getUnreadCount();
        setUnreadCount(count);
      } else {
        console.log('ℹ️ Notification service not ready yet');
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error loading unread count:', error);
      setUnreadCount(0);
    }
  };


  const getTodaysVerse = (): BibleVerse => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const index = dayOfYear % BIBLE_VERSES.length;
    return BIBLE_VERSES[index];
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    await loadUnreadCount();
    setTodaysVerse(getTodaysVerse());
    setRefreshing(false);
  };

  const shareVerse = async () => {
    if (!todaysVerse) return;
    try {
      await Share.share({
        message: `📖 ${todaysVerse.reference}\n"${todaysVerse.text}"\n\n✨ Share from Nova Faith 💕`,
      });
    } catch (error) {
      console.error('Error sharing verse:', error);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      love: '#FF6B9D',
      faith: '#8B5CF6',
      hope: '#3B82F6',
      prayer: '#22C55E',
      wisdom: '#F59E0B',
      strength: '#EF4444',
    };
    return colors[category] || '#888';
  };

  const renderHome = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />
      }
    >
      {/* Today's Verse */}
      {todaysVerse && (
        <View style={[styles.verseCard, { backgroundColor: colors.card }]}>
          <View style={styles.verseHeader}>
            <MaterialCommunityIcons name="book-outline" size={24} color="#8B5CF6" />
            <Text style={[styles.verseLabel, { color: colors.muted }]}>Verse of the Day</Text>
          </View>
          <Text style={[styles.verseText, { color: colors.text }]}>"{todaysVerse.text}"</Text>
          <View style={styles.verseFooter}>
            <Text style={[styles.verseReference, { color: '#8B5CF6' }]}>
              {todaysVerse.reference} — {todaysVerse.version}
            </Text>
            <TouchableOpacity onPress={shareVerse} style={styles.shareBtn}>
              <Icon name="share-outline" size={18} color="#8B5CF6" />
            </TouchableOpacity>
          </View>
          <View style={[styles.verseCategory, { backgroundColor: getCategoryColor(todaysVerse.category) + '20' }]}>
            <Text style={[styles.verseCategoryText, { color: getCategoryColor(todaysVerse.category) }]}>
              {todaysVerse.category.charAt(0).toUpperCase() + todaysVerse.category.slice(1)}
            </Text>
          </View>
        </View>
      )}

      {/* Quick Stats */}
      <View style={styles.statsGrid}>
        <TouchableOpacity
          style={[styles.statCard, { backgroundColor: colors.card }]}
          onPress={() => router.push('/faith/prayer')}
        >
          <View style={[styles.statIcon, { backgroundColor: '#8B5CF620' }]}>
            <MaterialCommunityIcons name="hands-pray" size={24} color="#8B5CF6" />
          </View>
          <Text style={[styles.statNumber, { color: colors.text }]}>{prayerCount}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Prayers</Text>
          {answeredPrayers > 0 && (
            <View style={[styles.statBadge, { backgroundColor: '#22C55E20' }]}>
              <Text style={[styles.statBadgeText, { color: '#22C55E' }]}>
                {answeredPrayers} answered
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.statCard, { backgroundColor: colors.card }]}
          onPress={() => router.push('/faith/sermon')}
        >
          <View style={[styles.statIcon, { backgroundColor: '#F59E0B20' }]}>
            <MaterialCommunityIcons name="church" size={24} color="#F59E0B" />
          </View>
          <Text style={[styles.statNumber, { color: colors.text }]}>{sermonCount}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Sermons</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.statCard, { backgroundColor: colors.card }]}
          onPress={() => router.push('/faith/bible')}
        >
          <View style={[styles.statIcon, { backgroundColor: '#22C55E20' }]}>
            <MaterialCommunityIcons name="book-outline" size={24} color="#22C55E" />
          </View>
          <Text style={[styles.statNumber, { color: colors.text }]}>{praiseCount}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Praises</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={[styles.actionsCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.actionsTitle, { color: colors.text }]}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={[styles.actionItem, { backgroundColor: colors.background }]}
            onPress={() => router.push('/faith/prayer')}
          >
            <MaterialCommunityIcons name="pencil" size={22} color="#8B5CF6" />
            <Text style={[styles.actionLabel, { color: colors.text }]}>New Prayer</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionItem, { backgroundColor: colors.background }]}
            onPress={() => router.push('/faith/sermon')}
          >
            <MaterialCommunityIcons name="note-plus" size={22} color="#F59E0B" />
            <Text style={[styles.actionLabel, { color: colors.text }]}>Sermon Notes</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionItem, { backgroundColor: colors.background }]}
            onPress={() => router.push('/faith/praise')}
          >
            <MaterialCommunityIcons name="star-plus" size={22} color="#22C55E" />
            <Text style={[styles.actionLabel, { color: colors.text }]}>Share Praise</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionItem, { backgroundColor: colors.background }]}
            onPress={shareVerse}
          >
            <MaterialCommunityIcons name="share" size={22} color="#FF6B9D" />
            <Text style={[styles.actionLabel, { color: colors.text }]}>Share Verse</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Prayer Reminder */}
      <View style={[styles.reminderCard, { backgroundColor: colors.card }]}>
        <View style={styles.reminderHeader}>
          <MaterialCommunityIcons name="bell" size={20} color="#8B5CF6" />
          <Text style={[styles.reminderTitle, { color: colors.text }]}>Prayer Reminder</Text>
        </View>
        <Text style={[styles.reminderText, { color: colors.muted }]}>
          "Pray without ceasing" — 1 Thessalonians 5:17
        </Text>
        <TouchableOpacity
          style={[styles.reminderBtn, { backgroundColor: '#8B5CF6' }]}
          onPress={() => {
            Alert.alert('🙏 Prayer Reminder Set!', 'You\'ll be reminded to pray at 6:00 AM daily.');
          }}
        >
          <Text style={styles.reminderBtnText}>Set Daily Reminder</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconContainer}>
            <MaterialCommunityIcons name="cross" size={22} color="#8B5CF6" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Faith</Text>
            <Text style={[styles.headerSub, { color: colors.muted }]}>
              Walk in the Spirit 🌿
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {/* Notification Bell with Badge */}
          <TouchableOpacity
            style={[styles.bellBtn, { backgroundColor: colors.border }]}
            onPress={() => router.push('/faith/notifications')}
          >
            <Icon name="notifications-outline" size={22} color={colors.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.settingsBtn, { backgroundColor: colors.border }]}
            onPress={() => router.push('/faith/settings')}
          >
            <Icon name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Navigation */}

      {/* Content */}
      {renderHome()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B5CF620',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 12, opacity: 0.7 },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
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
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Tab Bar ───
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  tabItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#8B5CF6',
  },
  tabText: { fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#8B5CF6' },

  // ─── Verse Card ───
  verseCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  verseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  verseLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  verseText: { fontSize: 18, fontStyle: 'italic', lineHeight: 28, marginBottom: 12 },
  verseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  verseReference: { fontSize: 14, fontWeight: '600' },
  shareBtn: { padding: 8 },
  verseCategory: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
  },
  verseCategoryText: { fontSize: 11, fontWeight: '600' },

  // ─── Stats ───
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statNumber: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  statBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  statBadgeText: { fontSize: 9, fontWeight: '600' },

  // ─── Actions ───
  actionsCard: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  actionsTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flex: 1,
    minWidth: '45%',
  },
  actionLabel: { fontSize: 13, fontWeight: '500' },

  // ─── Reminder ───
  reminderCard: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
     paddingBottom: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  reminderTitle: { fontSize: 15, fontWeight: '700' },
  reminderText: { fontSize: 13, fontStyle: 'italic', marginBottom: 12, opacity: 0.7 },
  reminderBtn: {
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  reminderBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
