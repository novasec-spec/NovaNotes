import * as Widgets from 'expo-widgets';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STORAGE_KEYS = {
  TODAY_MOOD: '@mood_today',
  TODAY_MOOD_EMOJI: '@mood_emoji',
  LAST_MOOD_DATE: '@mood_date',
  CURRENT_STREAK: '@current_streak',
  QUOTE_CACHE: '@quote_cache',
  QUOTE_DATE: '@quote_date',
};

// Beautiful romantic quotes collection
const QUOTES = [
  "✨ You make every day brighter just by being you",
  "💫 Your smile is my favorite thing to see",
  "🌟 Every moment with you is a treasure",
  "💝 You are the reason I believe in love",
  "🌸 You make my world beautiful every single day",
  "⭐ You're not just my love, you're my home",
  "💖 Falling in love with you every single day",
  "🌙 Good night, beautiful. Dream of us",
  "☀️ Good morning, my love. Another day to adore you",
  "🎵 You make my heart sing with joy",
  "💕 Being yours is the best thing that ever happened",
  "🌹 You are my today and all of my tomorrows",
  "💗 My heart beats only for you",
  "✨ You're the reason I believe in magic",
  "💫 Every love story is beautiful, but ours is my favorite"
];

// Get today's mood
async function getTodayMood() {
  try {
    const today = new Date().toDateString();
    const lastDate = await AsyncStorage.getItem(STORAGE_KEYS.LAST_MOOD_DATE);
    
    if (lastDate === today) {
      const mood = await AsyncStorage.getItem(STORAGE_KEYS.TODAY_MOOD);
      const emoji = await AsyncStorage.getItem(STORAGE_KEYS.TODAY_MOOD_EMOJI);
      return { mood: mood || 'Happy', emoji: emoji || '😊', isSet: true };
    }
    
    return { mood: 'Not yet set', emoji: '💭', isSet: false };
  } catch (error) {
    console.error('Error getting mood:', error);
    return { mood: 'Great', emoji: '😊', isSet: false };
  }
}

// Get daily quote - changes every day
async function getDailyQuote() {
  try {
    const today = new Date().toDateString();
    const lastQuoteDate = await AsyncStorage.getItem(STORAGE_KEYS.QUOTE_DATE);
    
    // If we have a quote for today, use it
    if (lastQuoteDate === today) {
      const cachedQuote = await AsyncStorage.getItem(STORAGE_KEYS.QUOTE_CACHE);
      if (cachedQuote) return cachedQuote;
    }
    
    // Get new quote for today
    const randomIndex = Math.floor(Math.random() * QUOTES.length);
    const newQuote = QUOTES[randomIndex];
    
    // Save for today
    await AsyncStorage.setItem(STORAGE_KEYS.QUOTE_CACHE, newQuote);
    await AsyncStorage.setItem(STORAGE_KEYS.QUOTE_DATE, today);
    
    return newQuote;
  } catch (error) {
    console.error('Error getting quote:', error);
    return "💝 You mean the world to me!";
  }
}

// Get current streak
async function getCurrentStreak() {
  try {
    const streak = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_STREAK);
    return streak ? parseInt(streak) : 0;
  } catch (error) {
    console.error('Error getting streak:', error);
    return 0;
  }
}

// Save mood and update streak
export async function saveMood(mood, emoji) {
  try {
    const today = new Date().toDateString();
    const lastDate = await AsyncStorage.getItem(STORAGE_KEYS.LAST_MOOD_DATE);
    
    // Save today's mood
    await AsyncStorage.setItem(STORAGE_KEYS.TODAY_MOOD, mood);
    await AsyncStorage.setItem(STORAGE_KEYS.TODAY_MOOD_EMOJI, emoji);
    
    // Update streak logic
    let currentStreak = 1;
    if (lastDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayString = yesterday.toDateString();
      
      if (lastDate === yesterdayString) {
        const prevStreak = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_STREAK);
        currentStreak = (prevStreak ? parseInt(prevStreak) : 0) + 1;
      }
    }
    
    await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_STREAK, currentStreak.toString());
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_MOOD_DATE, today);
    
    // Update widget after saving mood
    await updateWidget();
    
    return { success: true, streak: currentStreak };
  } catch (error) {
    console.error('Error saving mood:', error);
    return { success: false, streak: 0 };
  }
}

// Update widget with latest data
export async function updateWidget() {
  try {
    console.log("📱 Updating widget...");
    
    // Get all latest data
    const [moodData, quote, streak] = await Promise.all([
      getTodayMood(),
      getDailyQuote(),
      getCurrentStreak()
    ]);
    
    // Prepare widget data
    const widgetData = {
      mood: moodData.mood,
      moodEmoji: moodData.emoji,
      quote: quote,
      streak: streak,
      lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    console.log("📊 Sending to widget:", widgetData);
    
    // Update the widget snapshot
    await Widgets.updateSnapshot('MoodWidget', widgetData);
    
    console.log("✅ Widget updated successfully!");
    return true;
  } catch (error) {
    console.error("❌ Widget update failed:", error);
    return false;
  }
}

// Force refresh all widgets
export async function refreshWidget() {
  try {
    await Widgets.reloadAllTimelines();
    console.log("🔄 Widget refresh triggered");
    return true;
  } catch (error) {
    console.error("❌ Widget refresh failed:", error);
    return false;
  }
}

// Initialize widget on app start
export async function initializeWidget() {
  console.log("🚀 Initializing widget...");
  await updateWidget();
}
