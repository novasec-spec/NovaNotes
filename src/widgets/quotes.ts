// src/widgets/quotes.ts
//
// A small local quote bank. Picking "today's quote" is done deterministically
// from the date (day-of-year mod list length) so the widget, the app, and any
// background refresh all agree on the same quote for the same day — no
// network call, no extra AsyncStorage write needed just to pick one.

export interface Quote {
  text: string;
  author: string;
}

export const QUOTES: Quote[] = [
  { text: 'Small steps every day add up to big change.', author: 'Unknown' },
  { text: 'You are allowed to be both a masterpiece and a work in progress.', author: 'Sophia Bush' },
  { text: 'Do it with your whole heart or not at all.', author: 'Unknown' },
  { text: 'What you seek is seeking you.', author: 'Rumi' },
  { text: 'Notice five things you are grateful for today.', author: 'Novanotes' },
  { text: 'Progress, not perfection.', author: 'Unknown' },
  { text: 'The quieter you become, the more you can hear.', author: 'Rumi' },
  { text: 'Your calm is a gift to yourself first.', author: 'Novanotes' },
  { text: 'Write it down before it slips away.', author: 'Novanotes' },
  { text: 'Be gentle with yourself, you are doing the best you can.', author: 'Unknown' },
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
