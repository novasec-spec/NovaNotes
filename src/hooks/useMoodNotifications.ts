// src/hooks/useMoodNotifications.ts

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

const MOOD_FOLLOWUP_KEY = '@last_mood_followup';
const MOOD_CHECKIN_KEY = '@last_mood_checkin';

export function useMoodNotifications() {
  const { user } = useAuth();
  const { sendNotification } = useNotification();
  const [lastMood, setLastMood] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // ─── GET TODAY'S MOOD ──────────────────────────────

  const getTodayMood = useCallback(async () => {
    try {
      const history = await AsyncStorage.getItem('moodHistory');
      if (!history) return null;
      
      const moods = JSON.parse(history);
      const today = new Date().toDateString();
      
      const todayEntry = moods.find(
        (m: any) => new Date(m.timestamp).toDateString() === today
      );
      
      return todayEntry || null;
    } catch (error) {
      console.error('Error getting today mood:', error);
      return null;
    }
  }, []);

  // ─── CHECK IF FOLLOWUP WAS SENT TODAY ──────────────

  const wasFollowupSentToday = useCallback(async (): Promise<boolean> => {
    try {
      const data = await AsyncStorage.getItem(MOOD_FOLLOWUP_KEY);
      if (!data) return false;
      
      const lastDate = new Date(data);
      const today = new Date();
      
      return (
        lastDate.getFullYear() === today.getFullYear() &&
        lastDate.getMonth() === today.getMonth() &&
        lastDate.getDate() === today.getDate()
      );
    } catch {
      return false;
    }
  }, []);

  // ─── MARK FOLLOWUP SENT ─────────────────────────────

  const markFollowupSent = useCallback(async () => {
    try {
      await AsyncStorage.setItem(MOOD_FOLLOWUP_KEY, new Date().toISOString());
    } catch (error) {
      console.error('Error marking followup sent:', error);
    }
  }, []);

  // ─── SEND MOOD FOLLOW-UP NOTIFICATION ──────────────

  const sendMoodFollowup = useCallback(async () => {
    if (!user?.id) {
      console.error('❌ No user for mood followup');
      return null;
    }

    // Check if already sent today
    const alreadySent = await wasFollowupSentToday();
    if (alreadySent) {
      console.log('⏳ Followup already sent today');
      return null;
    }

    // Get today's mood
    const todayMood = await getTodayMood();
    if (!todayMood) {
      console.log('❌ No mood logged today');
      return null;
    }

    // Check if mood needs followup (sad, anxious, stressed, angry, tired)
    const needsFollowup = ['sad', 'anxious', 'stressed', 'angry', 'tired', 'lonely', 'sick'];
    if (!needsFollowup.includes(todayMood.id)) {
      console.log('✅ Mood is positive, no followup needed');
      return null;
    }

    // Check if enough time has passed (at least 3 hours)
    const moodTime = new Date(todayMood.timestamp);
    const hoursSince = (Date.now() - moodTime.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 3) {
      console.log(`⏳ Too soon for followup (${hoursSince.toFixed(1)} hours)`);
      return null;
    }

    // Get followup message based on mood
    const followupMessages: Record<string, { title: string; body: string }> = {
      sad: {
        title: '💕 Checking in on you',
        body: `Earlier you felt ${todayMood.label}. How are you feeling now? I'm here for you.`,
      },
      anxious: {
        title: '🧘 You\'re not alone',
        body: `I noticed you felt ${todayMood.label} earlier. How are you doing now? Take a deep breath.`,
      },
      stressed: {
        title: '💆 You\'ve got this',
        body: `You were feeling ${todayMood.label} earlier. How are things now? Remember to breathe.`,
      },
      angry: {
        title: '🌿 Take a moment',
        body: `You felt ${todayMood.label} earlier. How are you feeling now? I'm here to listen.`,
      },
      tired: {
        title: '😴 Rest when you need',
        body: `You were tired earlier. Have you been able to rest? How are you feeling now?`,
      },
      lonely: {
        title: '💕 You\'re never alone',
        body: `You felt ${todayMood.label} earlier. I'm thinking of you. How are you now?`,
      },
      sick: {
        title: '🌡️ Feeling better?',
        body: `You weren't feeling well earlier. How are you doing now? Take care of yourself.`,
      },
    };

    const message = followupMessages[todayMood.id] || {
      title: '💭 How are you feeling?',
      body: `Earlier you felt ${todayMood.label}. I'd love to know how you're doing now.`,
    };

    // Send notification
    const notification = await sendNotification({
      userId: user.id,
      title: message.title,
      body: message.body,
      type: 'system',
      data: {
        screen: 'mood-checkin',
        checkin_type: 'followup',
        previous_mood: todayMood,
        isMoodCheckin: true,
        fromNotification: true,
      },
      showLocal: true,
      priority: 'high',
      categoryId: 'reminder',
    });

    if (notification) {
      await markFollowupSent();
      console.log('✅ Mood followup sent!');
    }

    return notification;
  }, [user?.id, sendNotification, getTodayMood, wasFollowupSentToday, markFollowupSent]);

  // ─── SEND MORNING MOOD CHECK-IN ─────────────────────

  const sendMorningCheckin = useCallback(async () => {
    if (!user?.id) return null;

    // Check if already sent today
    const alreadySent = await AsyncStorage.getItem(MOOD_CHECKIN_KEY);
    if (alreadySent) {
      const lastDate = new Date(alreadySent);
      const today = new Date();
      if (
        lastDate.getFullYear() === today.getFullYear() &&
        lastDate.getMonth() === today.getMonth() &&
        lastDate.getDate() === today.getDate()
      ) {
        console.log('⏳ Morning check-in already sent');
        return null;
      }
    }

    // Only send between 7-10 AM
    const hour = new Date().getHours();
    if (hour < 7 || hour > 10) {
      console.log('⏳ Not morning hours');
      return null;
    }

    const notification = await sendNotification({
      userId: user.id,
      title: '🌅 Good Morning Beautiful!',
      body: 'How are you feeling today? Start your day with intention. 💕',
      type: 'system',
      data: {
        screen: 'mood-checkin',
        checkin_type: 'morning',
        isMoodCheckin: true,
      },
      showLocal: true,
      priority: 'normal',
      categoryId: 'reminder',
    });

    if (notification) {
      await AsyncStorage.setItem(MOOD_CHECKIN_KEY, new Date().toISOString());
      console.log('✅ Morning check-in sent!');
    }

    return notification;
  }, [user?.id, sendNotification]);

  // ─── SEND EVENING REFLECTION ────────────────────────

  const sendEveningReflection = useCallback(async () => {
    if (!user?.id) return null;

    // Only send between 8-10 PM
    const hour = new Date().getHours();
    if (hour < 20 || hour > 22) {
      console.log('⏳ Not evening hours');
      return null;
    }

    // Check if mood was logged today
    const todayMood = await getTodayMood();
    if (!todayMood) {
      console.log('❌ No mood logged today');
      return null;
    }

    const notification = await sendNotification({
      userId: user.id,
      title: '🌙 Reflect on your day',
      body: `Today you felt ${todayMood.label}. How was your day overall? 💭`,
      type: 'system',
      data: {
        screen: 'mood-checkin',
        checkin_type: 'evening',
        today_mood: todayMood,
        isMoodCheckin: true,
      },
      showLocal: true,
      priority: 'low',
      categoryId: 'reminder',
    });

    if (notification) {
      console.log('✅ Evening reflection sent!');
    }

    return notification;
  }, [user?.id, sendNotification, getTodayMood]);

  // ─── PROCESS SCHEDULED CHECKS ──────────────────────

  const processScheduledChecks = useCallback(async () => {
    if (!user?.id) return;

    console.log('🔄 Processing scheduled mood checks...');
    
    const hour = new Date().getHours();
    
    // Morning check-in (7-10 AM)
    if (hour >= 7 && hour <= 10) {
      await sendMorningCheckin();
    }
    
    // Afternoon followup (1-4 PM)
    if (hour >= 13 && hour <= 16) {
      await sendMoodFollowup();
    }
    
    // Evening reflection (8-10 PM)
    if (hour >= 20 && hour <= 22) {
      await sendEveningReflection();
    }
  }, [user?.id, sendMorningCheckin, sendMoodFollowup, sendEveningReflection]);

  // ─── HANDLE MOOD SAVE FROM NOTIFICATION ─────────────

  const handleMoodFromNotification = useCallback(async (
    mood: any,
    comment?: string,
    context: 'followup' | 'morning' | 'evening' | 'random' = 'followup'
  ) => {
    if (!user?.id) return;

    try {
      const entry = {
        ...mood,
        timestamp: new Date().toISOString(),
        comment: comment || '',
        fromNotification: true,
        notificationType: context,
      };

      // Save to AsyncStorage
      const existing = await AsyncStorage.getItem('moodHistory');
      const history: any[] = existing ? JSON.parse(existing) : [];
      const today = new Date().toDateString();
      const cleaned = history.filter(m => new Date(m.timestamp).toDateString() !== today);
      cleaned.unshift(entry);
      if (cleaned.length > 90) cleaned.splice(90);
      await AsyncStorage.setItem('moodHistory', JSON.stringify(cleaned));

      // If this was a followup, mark it as responded
      if (context === 'followup') {
        await AsyncStorage.setItem(`${MOOD_FOLLOWUP_KEY}_response`, new Date().toISOString());
      }

      console.log('✅ Mood saved from notification:', mood.label);

      return entry;
    } catch (error) {
      console.error('Error saving mood from notification:', error);
      return null;
    }
  }, [user?.id]);

  return {
    loading,
    lastMood,
    getTodayMood,
    sendMorningCheckin,
    sendMoodFollowup,
    sendEveningReflection,
    processScheduledChecks,
    handleMoodFromNotification,
    markFollowupSent,
    wasFollowupSentToday,
  };
}
