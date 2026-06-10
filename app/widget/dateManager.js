import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateDaysSince, calculateDaysUntil } from './dateUtils';

// Quotes collection
const quotes = [
  "The only way to do great work is to love what you do.",
  "Believe you can and you're halfway there.",
  "Start where you are. Use what you have. Do what you can.",
  "Don't watch the clock; do what it does. Keep going.",
  "The future depends on what you do today.",
  "Your mood today creates your tomorrow.",
  "Small progress is still progress.",
  "Be stronger than your excuses.",
];

// Storage keys
const STORAGE_KEYS = {
  TODAY_MOOD: '@mood_today',
  TODAY_MOOD_EMOJI: '@mood_emoji',
  LAST_MOOD_DATE: '@mood_date',
  SPECIAL_DATE: '@special_date',
  SPECIAL_DATE_NAME: '@special_date_name',
  SPECIAL_DATE_TYPE: '@special_date_type', // 'since' or 'until'
  QUOTE_CACHE: '@quote_cache',
  QUOTE_DATE: '@quote_date',
};

// Mood options
export const MOODS = {
  GREAT: { name: 'Great', emoji: '😊', color: '#4CAF50' },
  GOOD: { name: 'Good', emoji: '🙂', color: '#8BC34A' },
  OKAY: { name: 'Okay', emoji: '😐', color: '#FFC107' },
  BAD: { name: 'Bad', emoji: '😕', color: '#FF9800' },
  AWFUL: { name: 'Awful', emoji: '😢', color: '#F44336' },
};

export const saveMood = async (mood, emoji) => {
  try {
    const today = new Date().toDateString();
    await AsyncStorage.setItem(STORAGE_KEYS.TODAY_MOOD, mood);
    await AsyncStorage.setItem(STORAGE_KEYS.TODAY_MOOD_EMOJI, emoji);
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_MOOD_DATE, today);
    return true;
  } catch (error) {
    console.error('Error saving mood:', error);
    return false;
  }
};

export const getTodayMood = async () => {
  try {
    const lastDate = await AsyncStorage.getItem(STORAGE_KEYS.LAST_MOOD_DATE);
    const today = new Date().toDateString();
    
    // Return today's mood if exists
    if (lastDate === today) {
      const mood = await AsyncStorage.getItem(STORAGE_KEYS.TODAY_MOOD);
      const emoji = await AsyncStorage.getItem(STORAGE_KEYS.TODAY_MOOD_EMOJI);
      return { mood, emoji, isToday: true };
    }
    
    return { mood: 'Not set yet', emoji: '❓', isToday: false };
  } catch (error) {
    console.error('Error getting mood:', error);
    return { mood: 'Error', emoji: '⚠️', isToday: false };
  }
};

export const getDailyQuote = async () => {
  try {
    const lastQuoteDate = await AsyncStorage.getItem(STORAGE_KEYS.QUOTE_DATE);
    const today = new Date().toDateString();
    
    // Return cached quote if from today
    if (lastQuoteDate === today) {
      const cachedQuote = await AsyncStorage.getItem(STORAGE_KEYS.QUOTE_CACHE);
      if (cachedQuote) return cachedQuote;
    }
    
    // Generate new random quote
    const randomIndex = Math.floor(Math.random() * quotes.length);
    const newQuote = quotes[randomIndex];
    
    // Cache the quote
    await AsyncStorage.setItem(STORAGE_KEYS.QUOTE_CACHE, newQuote);
    await AsyncStorage.setItem(STORAGE_KEYS.QUOTE_DATE, today);
    
    return newQuote;
  } catch (error) {
    console.error('Error getting quote:', error);
    return "Stay positive and keep going!";
  }
};

export const setupSpecialDate = async (date, name, type = 'since') => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SPECIAL_DATE, date);
    await AsyncStorage.setItem(STORAGE_KEYS.SPECIAL_DATE_NAME, name);
    await AsyncStorage.setItem(STORAGE_KEYS.SPECIAL_DATE_TYPE, type);
    return true;
  } catch (error) {
    console.error('Error setting special date:', error);
    return false;
  }
};

export const getSpecialDateInfo = async () => {
  try {
    const dateStr = await AsyncStorage.getItem(STORAGE_KEYS.SPECIAL_DATE);
    const name = await AsyncStorage.getItem(STORAGE_KEYS.SPECIAL_DATE_NAME);
    const type = await AsyncStorage.getItem(STORAGE_KEYS.SPECIAL_DATE_TYPE) || 'since';
    
    if (!dateStr || !name) {
      // Default example: 100 days since app launch
      return {
        name: 'App Journey',
        days: 0,
        type: 'since',
        display: '✨ Just started!'
      };
    }
    
    let days;
    if (type === 'since') {
      days = calculateDaysSince(dateStr);
    } else {
      days = calculateDaysUntil(dateStr);
    }
    
    const prefix = type === 'since' ? 'Days since' : 'Days until';
    const display = `${prefix} ${name}: ${Math.abs(days)} days`;
    
    return { name, days, type, display };
  } catch (error) {
    console.error('Error getting special date:', error);
    return { name: 'Error', days: 0, type: 'since', display: '❌ Error loading' };
  }
};

// Get all widget data at once
export const getAllWidgetData = async () => {
  const [moodData, quote, specialData] = await Promise.all([
    getTodayMood(),
    getDailyQuote(),
    getSpecialDateInfo()
  ]);
  
  return {
    mood: moodData.mood,
    moodEmoji: moodData.emoji,
    quote: quote,
    specialDateDisplay: specialData.display,
    specialDateDays: specialData.days,
    specialDateName: specialData.name,
    timestamp: new Date().toLocaleTimeString()
  };
};
