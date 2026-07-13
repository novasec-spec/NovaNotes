// src/widgets/quotes.ts
export interface Quote {
  text: string;
  author: string;
  category?: 'love' | 'motivation' | 'faith' | 'wisdom' | 'gratitude';
}

export const QUOTES: Quote[] = [
  // Love
  { text: 'Every day with you is my favourite day', author: 'Your Person 💕', category: 'love' },
  { text: 'You are my sunshine on a cloudy day', author: 'Always & Forever 🌸', category: 'love' },
  { text: 'I love you more than words can ever say', author: 'Speechless 💫', category: 'love' },
  { text: 'Home is wherever I am with you', author: 'Our Home 🏠', category: 'love' },
  { text: 'You make ordinary moments extraordinary', author: 'With all my heart ✨', category: 'love' },
  
  // Motivation
  { text: 'Small steps every day add up to big change', author: 'Unknown 💪', category: 'motivation' },
  { text: 'You are stronger than you know and braver than you feel', author: 'Warrior 🦁', category: 'motivation' },
  { text: 'Progress, not perfection', author: 'Unknown 🌱', category: 'motivation' },
  { text: 'Your potential is limitless', author: 'Unstoppable 🚀', category: 'motivation' },
  { text: 'Every day you choose love, you choose the best version of yourself', author: 'Grateful 💕', category: 'motivation' },
  
  // Faith
  { text: 'Trust in the Lord with all your heart', author: 'Proverbs 3:5 🙏', category: 'faith' },
  { text: 'Be strong and courageous. Do not be afraid', author: 'Joshua 1:9 💪', category: 'faith' },
  { text: 'Pray without ceasing', author: '1 Thessalonians 5:17 ✨', category: 'faith' },
  { text: 'For I know the plans I have for you', author: 'Jeremiah 29:11 🌟', category: 'faith' },
  { text: 'The Lord is my shepherd, I shall not want', author: 'Psalm 23:1 🕊️', category: 'faith' },
  
  // Wisdom
  { text: 'The quieter you become, the more you can hear', author: 'Rumi 🧘', category: 'wisdom' },
  { text: 'What you seek is seeking you', author: 'Rumi 🌙', category: 'wisdom' },
  { text: 'Be gentle with yourself, you are doing the best you can', author: 'Unknown 🌸', category: 'wisdom' },
  { text: 'Your calm is a gift to yourself first', author: 'NovaNotes 🌿', category: 'wisdom' },
  { text: 'Notice five things you are grateful for today', author: 'NovaNotes 🙏', category: 'wisdom' },
  
  // Gratitude
  { text: 'Gratitude turns what we have into enough', author: 'Aesop 🌸', category: 'gratitude' },
  { text: 'The more grateful I am, the more beauty I see', author: 'Mary Davis ✨', category: 'gratitude' },
  { text: 'Count your blessings, not your problems', author: 'Unknown 💕', category: 'gratitude' },
  { text: 'Gratitude is the fairest blossom which springs from the soul', author: 'Henry Ward Beecher 🌺', category: 'gratitude' },
];

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function getDailyQuote(date: Date = new Date()): Quote {
  const index = dayOfYear(date) % QUOTES.length;
  return QUOTES[index];
}

export function getQuoteByCategory(category: string): Quote | null {
  const filtered = QUOTES.filter(q => q.category === category);
  if (filtered.length === 0) return null;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

export function getRandomQuote(): Quote {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}
