// src/services/dailyGreetingService.ts

import { notificationService } from './notification/NotificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppNotification } from '../types/notifications';

const LAST_GREETING_KEY = '@last_greeting_date';

// ── Greeting pools — multiple options per time-of-day so it's never the same ──
const MORNING_GREETINGS: { title: string; body: string }[] = [
  { title: '🌅 Good Morning!', body: 'Rise and shine! Have a wonderful day ahead! ☀️' },
  { title: '☕ Morning!', body: 'A fresh day, a fresh start. Make it count! ✨' },
  { title: '🌻 Good Morning!', body: 'Hope you slept well! Time to take on the day 💪' },
  { title: '🐦 Morning!', body: 'The early bird gets the best moments. Good morning! 🌞' },
  { title: '🌄 Rise and Shine!', body: 'Today is full of new possibilities. Let\'s go! 🚀' },
  { title: '☀️ Good Morning!', body: 'Stretch, smile, and start the day strong! 💫' },
];

const AFTERNOON_GREETINGS: { title: string; body: string }[] = [
  { title: '☀️ Good Afternoon!', body: 'Hope your day is going well! Keep up the great work! 💪' },
  { title: '🌤️ Afternoon!', body: 'Halfway through the day — you\'re doing great! 🙌' },
  { title: '🍃 Good Afternoon!', body: 'Take a breather if you need one. You\'ve got this! 🌿' },
  { title: '🌞 Afternoon Check-in!', body: 'How\'s the day treating you so far? Keep pushing! 🔥' },
  { title: '🥗 Good Afternoon!', body: 'Don\'t forget to eat something and stay hydrated! 💧' },
  { title: '⚡ Afternoon!', body: 'A little progress each hour adds up. Keep going! 📈' },
];

const EVENING_GREETINGS: { title: string; body: string }[] = [
  { title: '🌅 Good Evening!', body: 'Time to unwind and relax. You\'ve earned it! 🌙' },
  { title: '🌆 Evening!', body: 'The day is winding down — reflect on today\'s wins! 🏆' },
  { title: '🍵 Good Evening!', body: 'Maybe it\'s time for a warm drink and some rest 🍂' },
  { title: '🌇 Evening Vibes!', body: 'Hope today treated you kindly. Relax a little 💕' },
  { title: '✨ Good Evening!', body: 'Wrap up the day with something that makes you smile 😊' },
  { title: '🌃 Evening!', body: 'You made it through another day — that matters 🌟' },
];

const NIGHT_GREETINGS: { title: string; body: string }[] = [
  { title: '🌙 Good Night!', body: 'Rest well and recharge for tomorrow! 💤' },
  { title: '😴 Sleep Tight!', body: 'Tomorrow is a new day. Get some good rest tonight 🌌' },
  { title: '⭐ Good Night!', body: 'Let go of today and dream well tonight 🌠' },
  { title: '🛏️ Night!', body: 'Time to rest that hardworking mind of yours 💫' },
  { title: '🌌 Sweet Dreams!', body: 'You did enough today. Rest now, dream big 💭' },
  { title: '💤 Good Night!', body: 'Recharge tonight so you can shine tomorrow ✨' },
];

export class DailyGreetingService {
  private static instance: DailyGreetingService;

  private constructor() {}

  static getInstance(): DailyGreetingService {
    if (!DailyGreetingService.instance) {
      DailyGreetingService.instance = new DailyGreetingService();
    }
    return DailyGreetingService.instance;
  }

  // Check if greeting was already sent today
  async wasGreetingSentToday(): Promise<boolean> {
    try {
      const lastDate = await AsyncStorage.getItem(LAST_GREETING_KEY);
      if (!lastDate) return false;

      const lastGreetingDate = new Date(lastDate);
      const today = new Date();
      
      // Compare dates (ignoring time)
      return (
        lastGreetingDate.getFullYear() === today.getFullYear() &&
        lastGreetingDate.getMonth() === today.getMonth() &&
        lastGreetingDate.getDate() === today.getDate()
      );
    } catch (error) {
      console.error('Error checking greeting status:', error);
      return false;
    }
  }

  // Mark greeting as sent today
  async markGreetingSent(): Promise<void> {
    try {
      await AsyncStorage.setItem(LAST_GREETING_KEY, new Date().toISOString());
    } catch (error) {
      console.error('Error marking greeting sent:', error);
    }
  }

  // Pick a random greeting from a pool
  private pickRandom(pool: { title: string; body: string }[]): { title: string; body: string } {
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }

  // Get greeting message based on time of day
  getGreetingMessage(): { title: string; body: string; type: 'system' } {
    const hour = new Date().getHours();

    let pool: { title: string; body: string }[];

    if (hour >= 5 && hour < 12) {
      pool = MORNING_GREETINGS;
    } else if (hour >= 12 && hour < 17) {
      pool = AFTERNOON_GREETINGS;
    } else if (hour >= 17 && hour < 21) {
      pool = EVENING_GREETINGS;
    } else {
      pool = NIGHT_GREETINGS;
    }

    const chosen = this.pickRandom(pool);

    return {
      title: chosen.title,
      body: chosen.body,
      type: 'system',
    };
  }

  // Send daily greeting notification
  async sendDailyGreeting(userId: string): Promise<AppNotification | null> {
    // Check if already sent today
    const alreadySent = await this.wasGreetingSentToday();
    
    if (alreadySent) {
      console.log('⏳ Greeting already sent today, skipping...');
      return null;
    }

    // Get greeting message
    const greeting = this.getGreetingMessage();

    // Send notification
    const notification = await notificationService.create({
      userId,
      title: greeting.title,
      body: greeting.body,
      type: greeting.type,
      data: {
        screen: 'home',
        greeting: true,
        timestamp: new Date().toISOString(),
      },
      showLocal: true,
      priority: 'normal',
    });

    if (notification) {
      // Mark as sent
      await this.markGreetingSent();
      console.log('✅ Daily greeting sent successfully!');
    }

    return notification;
  }

  // Reset greeting (for testing)
  async resetGreeting(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LAST_GREETING_KEY);
      console.log('🔄 Greeting reset for testing');
    } catch (error) {
      console.error('Error resetting greeting:', error);
    }
  }
}

export const dailyGreetingService = DailyGreetingService.getInstance();
