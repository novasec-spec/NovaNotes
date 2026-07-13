// src/data/bible-verses.ts
import { BibleVerse } from './types';

export const BIBLE_VERSES: BibleVerse[] = [
  // Love
  {
    id: '1',
    reference: '1 Corinthians 13:13',
    text: 'And now these three remain: faith, hope and love. But the greatest of these is love.',
    version: 'NIV',
    category: 'love',
    date: new Date().toISOString(),
  },
  {
    id: '2',
    reference: 'John 3:16',
    text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
    version: 'NIV',
    category: 'love',
    date: new Date().toISOString(),
  },
  {
    id: '3',
    reference: 'Romans 8:38-39',
    text: 'For I am convinced that neither death nor life, neither angels nor demons, neither the present nor the future, nor any powers, neither height nor depth, nor anything else in all creation, will be able to separate us from the love of God that is in Christ Jesus our Lord.',
    version: 'NIV',
    category: 'love',
    date: new Date().toISOString(),
  },
  
  // Faith
  {
    id: '4',
    reference: 'Hebrews 11:1',
    text: 'Now faith is confidence in what we hope for and assurance about what we do not see.',
    version: 'NIV',
    category: 'faith',
    date: new Date().toISOString(),
  },
  {
    id: '5',
    reference: '2 Corinthians 5:7',
    text: 'For we live by faith, not by sight.',
    version: 'NIV',
    category: 'faith',
    date: new Date().toISOString(),
  },
  {
    id: '6',
    reference: 'Matthew 17:20',
    text: 'He replied, "Because you have so little faith. Truly I tell you, if you have faith as small as a mustard seed, you can say to this mountain, \'Move from here to there,\' and it will move. Nothing will be impossible for you."',
    version: 'NIV',
    category: 'faith',
    date: new Date().toISOString(),
  },
  
  // Hope
  {
    id: '7',
    reference: 'Jeremiah 29:11',
    text: 'For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.',
    version: 'NIV',
    category: 'hope',
    date: new Date().toISOString(),
  },
  {
    id: '8',
    reference: 'Romans 15:13',
    text: 'May the God of hope fill you with all joy and peace as you trust in him, so that you may overflow with hope by the power of the Holy Spirit.',
    version: 'NIV',
    category: 'hope',
    date: new Date().toISOString(),
  },
  
  // Prayer
  {
    id: '9',
    reference: 'Philippians 4:6-7',
    text: 'Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which transcends all understanding, will guard your hearts and your minds in Christ Jesus.',
    version: 'NIV',
    category: 'prayer',
    date: new Date().toISOString(),
  },
  {
    id: '10',
    reference: 'Matthew 6:9-13',
    text: 'This, then, is how you should pray: "Our Father in heaven, hallowed be your name, your kingdom come, your will be done, on earth as it is in heaven. Give us today our daily bread. And forgive us our debts, as we also have forgiven our debtors. And lead us not into temptation, but deliver us from the evil one."',
    version: 'NIV',
    category: 'prayer',
    date: new Date().toISOString(),
  },
  
  // Wisdom
  {
    id: '11',
    reference: 'Proverbs 3:5-6',
    text: 'Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.',
    version: 'NIV',
    category: 'wisdom',
    date: new Date().toISOString(),
  },
  {
    id: '12',
    reference: 'Proverbs 31:30',
    text: 'Charm is deceptive, and beauty is fleeting; but a woman who fears the Lord is to be praised.',
    version: 'NIV',
    category: 'wisdom',
    date: new Date().toISOString(),
  },
  
  // Strength
  {
    id: '13',
    reference: 'Isaiah 40:31',
    text: 'But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint.',
    version: 'NIV',
    category: 'strength',
    date: new Date().toISOString(),
  },
  {
    id: '14',
    reference: 'Philippians 4:13',
    text: 'I can do all this through him who gives me strength.',
    version: 'NIV',
    category: 'strength',
    date: new Date().toISOString(),
  },
];
