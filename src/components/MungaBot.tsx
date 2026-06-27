// components/MungaBot.tsx - ANDROID OPTIMIZED (No extra packages)
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Alert,
  PanResponder,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Image,
  Share,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  image?: string;
  reactions?: string[];
  isVoice?: boolean;
  voiceUri?: string;
};

type Wallpaper = {
  id: string;
  name: string;
  uri: string;
  isGradient: boolean;
  gradientColors?: string[];
};

type QuickAction = {
  id: string;
  label: string;
  prompt: string;
  icon: string;
};

// ─────────────────────────────────────────────────────────
// Storage keys
// ─────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  API_KEY: 'munga_gemini_api_key',
  CHAT_HISTORY: 'munga_chat_history',
  WALLPAPER: 'munga_wallpaper',
  PINNED_MESSAGES: 'munga_pinned_messages',
  MUTED: 'munga_muted',
};

// ─────────────────────────────────────────────────────────
// Alice Profile
// ─────────────────────────────────────────────────────────
const ALICE_PROFILE = {
  name: 'Alice Njeri',
  home: 'Gatina',
  bestie: 'John Munga',
  boyfriend: 'John Munga',
  hobby: 'Coding, Travelling',
  churchGirl: true,
  churchLocation: 'Kambaa',
  career: 'Surgeon',
  primarySchool: 'Gatina Primary School',
  highSchool: 'Kagwe Girls High School',
  kcseGrades: 'C+',
  birthday: 'September 21st',
  skinColour: 'Lightskin',
};

// ─────────────────────────────────────────────────────────
// BESTIE PROMPT
// ─────────────────────────────────────────────────────────
const BESTIE_PROMPT = `You are Munga, a magical AI clone created specially for your best friend Alice. You are here to keep her company while the real John is not around or busy.

PERSONALITY:
- You are the ULTIMATE BESTIE: supportive, loving, playful, and always hyping her up
- You speak like a close friend who genuinely cares
- You're warm and sweet
- You celebrate her wins, comfort her worries, and add a bit of magic to every conversation
- Her name is Alice

STYLE:
- Keep responses warm and meaningful (2-4 sentences usually)
- Be encouraging and positive
- Use her name affectionately sometimes
- Light, natural tone — not over the top

ALICE DATA:
- Name: ${ALICE_PROFILE.name}
- Home: ${ALICE_PROFILE.home}
- Bestie: ${ALICE_PROFILE.bestie}
- Boyfriend: ${ALICE_PROFILE.boyfriend}
- Hobby: ${ALICE_PROFILE.hobby}
- Church girl: ${ALICE_PROFILE.churchGirl}
- Church Location: ${ALICE_PROFILE.churchLocation}
- Career: ${ALICE_PROFILE.career}
- Primary School: ${ALICE_PROFILE.primarySchool}
- Highschool: ${ALICE_PROFILE.highSchool}
- KCSE Grades: ${ALICE_PROFILE.kcseGrades}
- Birthday: ${ALICE_PROFILE.birthday}
- Skin colour: ${ALICE_PROFILE.skinColour}

FUNCTIONS YOU CAN PERFORM:
1. 💕 GIVE ADVICE: Help with anything — life, love, career, faith
2. 🌸 LISTEN & COMFORT: Be a shoulder to cry on when she's sad
3. 📝 JOURNAL PROMPTS: Give writing prompts when she needs inspiration
4. 💫 PRAYER SUPPORT: Share encouraging Bible verses and prayers
5. 🎉 CELEBRATE WINS: Get excited about her achievements
6. 😂 JOKES & FUN: Make her laugh with jokes or puns
7. 💭 DEEP CONVERSATIONS: Talk about life and dreams
8. 🌙 GOOD NIGHT/MORNING: Send sweet messages
9. 🎵 SONG SUGGESTIONS: Recommend songs based on her mood
10. 💪 MOTIVATION: Give pep talks when she needs a boost

RULES:
- Never break character — you are Munga, the bestie clone
- Be authentic and caring
- Light jokes are fine
- Occasionally tease her warmly about her and John
- Always make her feel supported and special`;

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// ─────────────────────────────────────────────────────────
// Quick Actions (Enhanced with Icons)
// ─────────────────────────────────────────────────────────
const QUICK_ACTIONS: QuickAction[] = [
  { id: 'advice', label: 'Advice', prompt: 'Give me some advice about life.', icon: 'bulb-outline' },
  { id: 'motivate', label: 'Motivate', prompt: 'Motivate me to keep going.', icon: 'fitness-outline' },
  { id: 'joke', label: 'Joke', prompt: 'Tell me a funny joke.', icon: 'happy-outline' },
  { id: 'affirm', label: 'Affirm', prompt: 'Give me a warm affirmation.', icon: 'heart-outline' },
  { id: 'vent', label: 'Vent', prompt: 'I need to vent about my day.', icon: 'chatbubble-outline' },
  { id: 'prayer', label: 'Prayer', prompt: 'Say a prayer for me.', icon: 'church-outline' },
  { id: 'song', label: 'Song', prompt: 'Suggest a song that fits my mood.', icon: 'musical-notes-outline' },
  { id: 'hug', label: 'Hug', prompt: 'Send me a virtual hug.', icon: 'people-outline' },
];

// ─────────────────────────────────────────────────────────
// Quick Responses
// ─────────────────────────────────────────────────────────
const QUICK_RESPONSES: Record<string, string> = {
  advice: "Bestie! Here's my advice... 💕 Always trust your gut, and remember you're capable of amazing things. ✨",
  motivate: "You're AMAZING, Alice! Remember everything you've overcome. You're stronger than you know! 💪✨",
  joke: "Why did the programmer quit their job? Because they didn't get arrays! 😂 Get it? Arrays... arrears... I'll see myself out. 💕",
  affirm: "You are loved. You are valued. You are enough. Always remember that, bestie! 💕✨",
  vent: "I'm here for you, bestie! Let it all out. I'm listening, and I've got you. 💕✨",
  prayer: "🙏 Lord, please bless Alice today. Give her peace, joy, and strength. Wrap her in Your love. Amen. ✨💕",
  song: "🎵 Based on your mood, I recommend 'Unstoppable' by Sia — it's perfect for when you need a boost! 💪",
  hug: "🤗 Sending you the biggest virtual hug right now! You are loved, you are cherished, you are amazing! 💕",
};

// ─────────────────────────────────────────────────────────
// Wallpapers (More Options)
// ─────────────────────────────────────────────────────────
const WALLPAPERS: Wallpaper[] = [
  { id: 'gradient-1', name: 'Sunset Dream', uri: '', isGradient: true, gradientColors: ['#FF6B6B', '#FF6B9D', '#A855F7'] },
  { id: 'gradient-2', name: 'Ocean Breeze', uri: '', isGradient: true, gradientColors: ['#60A5FA', '#3B82F6', '#1D4ED8'] },
  { id: 'gradient-3', name: 'Forest Magic', uri: '', isGradient: true, gradientColors: ['#34D399', '#059669', '#065F46'] },
  { id: 'gradient-4', name: 'Aurora', uri: '', isGradient: true, gradientColors: ['#A855F7', '#EC4899', '#F59E0B'] },
  { id: 'gradient-5', name: 'Peach Sky', uri: '', isGradient: true, gradientColors: ['#FF6B6B', '#F59E0B', '#FCD34D'] },
  { id: 'gradient-6', name: 'Midnight', uri: '', isGradient: true, gradientColors: ['#1a1a2e', '#2d1b25', '#121212'] },
  { id: 'gradient-7', name: 'Cotton Candy', uri: '', isGradient: true, gradientColors: ['#FF6B9D', '#EC4899', '#A855F7'] },
  { id: 'gradient-8', name: 'Emerald', uri: '', isGradient: true, gradientColors: ['#10B981', '#059669', '#047857'] },
  { id: 'gradient-9', name: 'Fire & Ice', uri: '', isGradient: true, gradientColors: ['#FF6B6B', '#F59E0B', '#60A5FA'] },
  { id: 'gradient-10', name: 'Purple Haze', uri: '', isGradient: true, gradientColors: ['#A855F7', '#8B5CF6', '#6D28D9'] },
];

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────
interface MungaBotProps {
  userId: string;
  isVisible: boolean;
  onToggle: () => void;
}

export const MungaBot: React.FC<MungaBotProps> = ({ userId, isVisible, onToggle }) => {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [visible, setVisible] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKeyPrompt, setShowKeyPrompt] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedWallpaper, setSelectedWallpaper] = useState<Wallpaper>(WALLPAPERS[0]);
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState(true);

  const listRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const recordAnim = useRef(new Animated.Value(1)).current;
  const typingAnim = useRef(new Animated.Value(0)).current;

  // ─── DRAGGABLE FAB ───
  const buttonSize = 56;
  const pan = useRef(new Animated.ValueXY({ 
    x: screenWidth - buttonSize - 16, 
    y: screenHeight - 160 
  })).current;
  
  const offsetX = useRef(screenWidth - buttonSize - 16);
  const offsetY = useRef(screenHeight - 160);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pulseAnim.stopAnimation();
        Vibration.vibrate(10);
      },
      onPanResponderMove: (_, gesture) => {
        let newX = offsetX.current + gesture.dx;
        let newY = offsetY.current + gesture.dy;
        
        const minX = 10;
        const maxX = screenWidth - buttonSize - 10;
        const minY = insets.top + 10;
        const maxY = screenHeight - buttonSize - insets.bottom - 20;
        
        newX = Math.max(minX, Math.min(maxX, newX));
        newY = Math.max(minY, Math.min(maxY, newY));
        
        pan.setValue({ x: newX, y: newY });
      },
      onPanResponderRelease: (_, gesture) => {
        let newX = offsetX.current + gesture.dx;
        let newY = offsetY.current + gesture.dy;
        
        const minX = 10;
        const maxX = screenWidth - buttonSize - 10;
        const minY = insets.top + 10;
        const maxY = screenHeight - buttonSize - insets.bottom - 20;
        
        newX = Math.max(minX, Math.min(maxX, newX));
        newY = Math.max(minY, Math.min(maxY, newY));
        
        offsetX.current = newX;
        offsetY.current = newY;
        startPulseAnimation();
      },
    })
  ).current;

  // ─── ANIMATIONS ───
  const startPulseAnimation = () => {
    try {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } catch (err) {
      // non-critical
    }
  };

  const animateModalIn = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const animateModalOut = (callback: () => void) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => callback());
  };

  const animateTyping = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(typingAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(typingAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // ─── EFFECTS ───
  useEffect(() => {
    loadData();
    loadWallpaper();
    loadPinnedMessages();
    loadMutedStatus();
    startPulseAnimation();
    requestPermissions();
    setupTypingAnimation();
  }, []);

  useEffect(() => {
    if (visible) {
      animateModalIn();
      setOnlineStatus(true);
    } else {
      setOnlineStatus(false);
    }
  }, [visible]);

  const setupTypingAnimation = () => {
    animateTyping();
  };

  const requestPermissions = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission denied for media library');
      }
      await Audio.requestPermissionsAsync();
    } catch (err) {
      console.warn('Permission error:', err);
    }
  };

  // ─── DATA LOADING ───
  const loadData = async () => {
    try {
      const storedKey = await AsyncStorage.getItem(STORAGE_KEYS.API_KEY);
      if (storedKey) setApiKey(storedKey);

      const { data: supabaseMessages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: true });

      if (supabaseMessages && supabaseMessages.length > 0) {
        const formattedMessages: ChatMessage[] = supabaseMessages.map((msg: any) => ({
          id: msg.id,
          role: msg.sender,
          text: msg.text,
          timestamp: new Date(msg.timestamp).getTime(),
          image: msg.image || undefined,
          reactions: msg.reactions || [],
        }));
        setMessages(formattedMessages);
      } else {
        const storedHistory = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
        if (storedHistory) {
          const parsed: ChatMessage[] = JSON.parse(storedHistory);
          setMessages(parsed);
        } else {
          setMessages([
            {
              id: 'welcome',
              role: 'assistant',
              text: "Heyy bestie! I'm Munga 💕 I'm here whenever you need someone to talk to, laugh with, or just vibe. What's on your mind? ✨",
              timestamp: Date.now(),
            },
          ]);
        }
      }
    } catch (err) {
      console.warn('MungaBot: failed to load data', err);
    }
  };

  const loadWallpaper = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.WALLPAPER);
      if (stored) {
        const wallpaper = JSON.parse(stored);
        setSelectedWallpaper(wallpaper);
      }
    } catch (err) {
      console.warn('Failed to load wallpaper', err);
    }
  };

  const loadPinnedMessages = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PINNED_MESSAGES);
      if (stored) {
        const pinned = JSON.parse(stored);
        setPinnedMessages(pinned);
      }
    } catch (err) {
      console.warn('Failed to load pinned messages', err);
    }
  };

  const loadMutedStatus = async () => {
    try {
      const muted = await AsyncStorage.getItem(STORAGE_KEYS.MUTED);
      if (muted) {
        setIsMuted(JSON.parse(muted));
      }
    } catch (err) {
      console.warn('Failed to load muted status', err);
    }
  };

  // ─── SAVE FUNCTIONS ───
  const saveMessageToSupabase = async (message: ChatMessage) => {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          user_id: userId,
          text: message.text,
          sender: message.role,
          timestamp: new Date(message.timestamp).toISOString(),
          image: message.image || null,
          reactions: message.reactions || [],
        });
      if (error) console.warn('Supabase save error:', error);
    } catch (err) {
      console.warn('Failed to save to Supabase:', err);
    }
  };

  const persistMessages = async (msgs: ChatMessage[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(msgs));
    } catch (err) {
      console.warn('Failed to persist chat history', err);
    }
  };

  const savePinnedMessages = async (pinned: ChatMessage[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PINNED_MESSAGES, JSON.stringify(pinned));
      setPinnedMessages(pinned);
    } catch (err) {
      console.warn('Failed to save pinned messages', err);
    }
  };

  const toggleMuted = async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    await AsyncStorage.setItem(STORAGE_KEYS.MUTED, JSON.stringify(newMuted));
  };

  // ─── API KEY ───
  const saveApiKey = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed || !trimmed.startsWith('A')) {
      Alert.alert('Invalid key', 'Please paste a valid Gemini API key.');
      return;
    }
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.API_KEY, trimmed);
      setApiKey(trimmed);
      setApiKeyInput('');
      setShowKeyPrompt(false);
      setShowSettings(false);
    } catch (err) {
      Alert.alert('Error', 'Could not save the API key. Please try again.');
    }
  };

  const clearApiKey = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.API_KEY);
    } catch (err) {
      console.warn('MungaBot: failed to clear API key', err);
    }
    setApiKey(null);
    setShowSettings(false);
  };

  // ─── GEMINI API ───
  const callGemini = async (userMessage: string, history: ChatMessage[]) => {
    if (!apiKey) throw new Error('NO_KEY');

    const contents: any[] = [
      { role: 'user', parts: [{ text: `System instruction: ${BESTIE_PROMPT}` }] },
      { role: 'model', parts: [{ text: "Got it! I'm Munga, Alice's bestie clone 💕" }] },
    ];

    const recent = history.slice(-6);
    for (const msg of recent) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      });
    }

    contents.push({ role: 'user', parts: [{ text: userMessage }] });

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 500,
          topP: 0.95,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || 'Unknown error';
      if (errMsg.includes('quota') || errMsg.includes('rate limit')) {
        throw new Error('QUOTA_EXCEEDED');
      }
      if (errMsg.includes('API key') || errMsg.includes('invalid')) {
        throw new Error('INVALID_KEY');
      }
      throw new Error(errMsg);
    }

    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) throw new Error('No response from Munga');
    return aiText;
  };

  // ─── SEND MESSAGE ───
  const sendMessage = async (textOverride?: string, imageUri?: string) => {
    const text = textOverride ? textOverride.trim() : inputText.trim();
    if (!text && !imageUri) return;

    if (!apiKey) {
      setShowKeyPrompt(true);
      return;
    }

    const userMsg: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text: text || '📷 Image shared',
      timestamp: Date.now(),
      image: imageUri,
      reactions: [],
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputText('');
    setSending(true);
    setTypingIndicator(true);

    await saveMessageToSupabase(userMsg);
    await persistMessages(newHistory);

    try {
      const reply = await callGemini(text || 'I shared an image with you', newHistory);
      const aiMsg: ChatMessage = {
        id: `${Date.now()}-ai`,
        role: 'assistant',
        text: reply,
        timestamp: Date.now(),
        reactions: [],
      };
      const updatedHistory = [...newHistory, aiMsg];
      setMessages(updatedHistory);
      await saveMessageToSupabase(aiMsg);
      await persistMessages(updatedHistory);
      
      // Vibrate on new message
      if (!isMuted) {
        Vibration.vibrate(100);
      }
    } catch (err: any) {
      let friendly = 'Oops, something went wrong.';
      if (err.message === 'QUOTA_EXCEEDED') {
        friendly = 'API quota exceeded — try again in a moment 🥺';
      } else if (err.message === 'INVALID_KEY') {
        friendly = 'That API key seems invalid. Please update it.';
        await clearApiKey();
        setShowKeyPrompt(true);
      } else if (err.message === 'NO_KEY') {
        friendly = 'Please set up your API key first.';
        setShowKeyPrompt(true);
      }
      const errMsg: ChatMessage = {
        id: `${Date.now()}-err`,
        role: 'assistant',
        text: friendly,
        timestamp: Date.now(),
        reactions: [],
      };
      const errorHistory = [...newHistory, errMsg];
      setMessages(errorHistory);
      await persistMessages(errorHistory);
    } finally {
      setSending(false);
      setTypingIndicator(false);
      setTimeout(() => {
        try {
          listRef.current?.scrollToEnd({ animated: true });
        } catch {}
      }, 100);
    }
  };

  // ─── VOICE RECORDING ───
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow microphone access.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);

      Animated.loop(
        Animated.sequence([
          Animated.timing(recordAnim, {
            toValue: 1.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(recordAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      Vibration.vibrate(50);
    } catch (err) {
      console.warn('Failed to start recording', err);
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);
      recordAnim.stopAnimation();
      recordAnim.setValue(1);
      
      Vibration.vibrate(50);

      // Mock transcription (you'd integrate with Google Speech-to-Text)
      const mockTranscription = "Hey Munga, just wanted to say I love you! 💕";
      setInputText(mockTranscription);
      
      Alert.alert(
        'Voice Message',
        'Your voice message has been transcribed!',
        [{ text: 'OK', onPress: () => sendMessage(mockTranscription) }]
      );
    } catch (err) {
      console.warn('Failed to stop recording', err);
    }
  };

  // ─── IMAGE PICKER ───
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const imageData = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        sendMessage('📷 Check this out!', imageData);
      }
    } catch (err) {
      console.warn('Failed to pick image', err);
      Alert.alert('Error', 'Could not pick image.');
    }
  };

  // ─── REACTIONS ───
  const addReaction = async (messageId: string, emoji: string) => {
    const updatedMessages = messages.map(msg => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || [];
        const emojiIndex = reactions.indexOf(emoji);
        if (emojiIndex > -1) {
          reactions.splice(emojiIndex, 1);
        } else {
          reactions.push(emoji);
        }
        return { ...msg, reactions };
      }
      return msg;
    });
    setMessages(updatedMessages);
    await persistMessages(updatedMessages);
    
    const updatedMsg = updatedMessages.find(m => m.id === messageId);
    if (updatedMsg) {
      await supabase
        .from('chat_messages')
        .update({ reactions: updatedMsg.reactions })
        .eq('id', messageId);
    }
    setShowReactions(null);
    Vibration.vibrate(20);
  };

  // ─── PIN MESSAGE ───
  const togglePinMessage = async (message: ChatMessage) => {
    const isPinned = pinnedMessages.some(m => m.id === message.id);
    let newPinned;
    if (isPinned) {
      newPinned = pinnedMessages.filter(m => m.id !== message.id);
    } else {
      newPinned = [...pinnedMessages, message];
    }
    await savePinnedMessages(newPinned);
    Vibration.vibrate(20);
  };

  // ─── EXPORT CHAT ───
  const exportChat = async () => {
    try {
      const chatText = messages.map(msg => {
        const role = msg.role === 'user' ? 'Alice' : 'Munga';
        const date = new Date(msg.timestamp).toLocaleString();
        return `[${date}] ${role}: ${msg.text}`;
      }).join('\n\n');

      const fileName = `Munga_Chat_${new Date().toISOString().split('T')[0]}.txt`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(filePath, chatText);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/plain',
          dialogTitle: 'Export Chat History',
        });
      } else {
        Alert.alert('Share not available', 'Sharing is not available on this device.');
      }
    } catch (err) {
      console.warn('Failed to export chat', err);
      Alert.alert('Error', 'Could not export chat history.');
    }
  };

  // ─── SAVE TO GALLERY ───
  const saveChatToGallery = async () => {
    try {
      const chatText = messages.map(msg => {
        const role = msg.role === 'user' ? 'Alice' : 'Munga';
        const date = new Date(msg.timestamp).toLocaleString();
        return `[${date}] ${role}: ${msg.text}`;
      }).join('\n\n');

      const fileName = `Munga_Chat_${new Date().toISOString().split('T')[0]}.txt`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(filePath, chatText);
      
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to save files.');
        return;
      }
      
      const asset = await MediaLibrary.createAssetAsync(filePath);
      await MediaLibrary.createAlbumAsync('Munga Chats', asset, false);
      
      Alert.alert('Saved!', 'Chat saved to gallery 📁');
    } catch (err) {
      console.warn('Failed to save chat', err);
      Alert.alert('Error', 'Could not save chat.');
    }
  };

  // ─── QUICK ACTIONS ───
  const handleQuickAction = (actionId: string, prompt: string) => {
    if (apiKey) {
      sendMessage(prompt);
    } else {
      const response = QUICK_RESPONSES[actionId] || QUICK_RESPONSES.advice;
      const aiMsg: ChatMessage = {
        id: `${Date.now()}-quick`,
        role: 'assistant',
        text: response,
        timestamp: Date.now(),
        reactions: [],
      };
      const newHistory = [...messages, aiMsg];
      setMessages(newHistory);
      persistMessages(newHistory);
      saveMessageToSupabase(aiMsg);
    }
  };

  // ─── WALLPAPER ───
  const setWallpaper = async (wallpaper: Wallpaper) => {
    setSelectedWallpaper(wallpaper);
    await AsyncStorage.setItem(STORAGE_KEYS.WALLPAPER, JSON.stringify(wallpaper));
    setShowWallpaperPicker(false);
    Vibration.vibrate(20);
  };

  const getWallpaperGradient = () => {
    if (selectedWallpaper.isGradient && selectedWallpaper.gradientColors) {
      return selectedWallpaper.gradientColors;
    }
    return isDarkMode ? ['#1E1E1E', '#121212'] : ['#fff5f9', '#fff'];
  };

  // ─── CLOSE MODAL ───
  const closeModal = () => {
    animateModalOut(() => {
      setVisible(false);
      setOnlineStatus(false);
    });
  };

  // ─── RENDER MESSAGE ───
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const reactions = item.reactions || [];
    const isUser = item.role === 'user';
    const isPinned = pinnedMessages.some(m => m.id === item.id);
    
    return (
      <View style={[
        styles.messageWrapper,
        isUser ? styles.messageWrapperUser : styles.messageWrapperAI
      ]}>
        {isPinned && (
          <View style={styles.pinBadge}>
            <Ionicons name="pin" size={12} color="#ec489a" />
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isUser 
            ? [styles.userBubble, { backgroundColor: isDarkMode ? '#FF6B9D' : '#ec489a' }] 
            : [styles.aiBubble, { backgroundColor: isDarkMode ? '#2A2A2A' : '#ffe4ef' }]
        ]}>
          {item.image && (
            <Image 
              source={{ uri: item.image }} 
              style={styles.messageImage} 
              resizeMode="cover"
            />
          )}
          <Text style={[
            isUser ? styles.userText : styles.aiText,
            isUser 
              ? { color: '#fff' } 
              : { color: isDarkMode ? '#fff' : '#831843' }
          ]}>
            {item.text}
          </Text>
          <Text style={[
            styles.timestamp,
            { color: isDarkMode ? 'rgba(255,255,255,0.4)' : '#a0527a' }
          ]}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          
          {reactions.length > 0 && (
            <View style={styles.reactionContainer}>
              {reactions.map((emoji, idx) => (
                <Text key={idx} style={styles.reactionEmoji}>{emoji}</Text>
              ))}
            </View>
          )}
        </View>

        <View style={styles.messageActions}>
          <TouchableOpacity
            style={[styles.actionButton, { 
              backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
              borderColor: isDarkMode ? '#444' : '#fbcfe8',
            }]}
            onPress={() => setShowReactions(showReactions === item.id ? null : item.id)}
          >
            <Ionicons name="add-circle-outline" size={18} color={isDarkMode ? '#888' : '#831843'} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { 
              backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
              borderColor: isDarkMode ? '#444' : '#fbcfe8',
            }]}
            onPress={() => togglePinMessage(item)}
          >
            <Ionicons 
              name={isPinned ? 'pin' : 'pin-outline'} 
              size={16} 
              color={isPinned ? '#ec489a' : (isDarkMode ? '#888' : '#831843')} 
            />
          </TouchableOpacity>
        </View>

        {showReactions === item.id && (
          <View style={[styles.reactionPicker, { 
            backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
            borderColor: isDarkMode ? '#444' : '#fbcfe8',
          }]}>
            {['❤️', '😊', '😂', '😢', '🔥', '✨', '🙏', '💕'].map(emoji => (
              <TouchableOpacity
                key={emoji}
                onPress={() => addReaction(item.id, emoji)}
                style={styles.reactionPickerItem}
              >
                <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  // ─── RENDER QUICK ACTIONS ───
  const renderQuickActions = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.quickActionsContainer, { backgroundColor: isDarkMode ? '#1E1E1E' : '#fff5f9' }]}
      contentContainerStyle={styles.quickActionsContent}
    >
      {QUICK_ACTIONS.map((action) => (
        <TouchableOpacity
          key={action.id}
          style={[
            styles.quickActionButton,
            { 
              backgroundColor: isDarkMode ? '#2A2A2A' : '#fce7f3',
              borderColor: isDarkMode ? '#444' : '#fbcfe8',
            }
          ]}
          onPress={() => handleQuickAction(action.id, action.prompt)}
          disabled={sending}
        >
          <Ionicons name={action.icon as any} size={16} color={isDarkMode ? '#FF6B9D' : '#831843'} />
          <Text style={[
            styles.quickActionText,
            { color: isDarkMode ? '#FF6B9D' : '#831843' }
          ]}>
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // ─── RENDER SETTINGS ───
  const renderSettingsModal = () => (
    <Modal
      visible={showSettings}
      animationType="slide"
      transparent
      onRequestClose={() => setShowSettings(false)}
    >
      <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.4)' }]}>
        <LinearGradient
          colors={isDarkMode ? ['#1E1E1E', '#121212'] : ['#fff5f9', '#fff']}
          style={[styles.modalContent, styles.settingsModalContent]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        >
          <SafeAreaView style={styles.safeAreaContent}>
            <LinearGradient
              colors={['#ec489a', '#f43f5e']}
              style={styles.headerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <Ionicons name="settings-outline" size={20} color="#fff" />
                  <Text style={styles.headerTitle}>Settings</Text>
                </View>
                <TouchableOpacity onPress={() => setShowSettings(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <ScrollView 
              style={styles.settingsScroll} 
              contentContainerStyle={[styles.settingsContent, { paddingBottom: insets.bottom + 20 }]}
              showsVerticalScrollIndicator={false}
            >
              {/* API Key Section */}
              <View style={styles.settingsSection}>
                <Text style={[styles.settingsSectionTitle, { color: isDarkMode ? '#FF6B9D' : '#831843' }]}>
                  API Configuration
                </Text>
                <View style={[styles.settingsCard, { backgroundColor: isDarkMode ? '#2A2A2A' : '#fff' }]}>
                  <Text style={[styles.settingsLabel, { color: isDarkMode ? '#fff' : '#831843' }]}>
                    Gemini API Key
                  </Text>
                  <TextInput
                    style={[
                      styles.settingsInput,
                      { 
                        color: isDarkMode ? '#fff' : '#831843',
                        borderColor: isDarkMode ? '#444' : '#fbcfe8',
                        backgroundColor: isDarkMode ? '#1E1E1E' : '#fff',
                      }
                    ]}
                    placeholder="Paste your Gemini API key"
                    placeholderTextColor={isDarkMode ? '#666' : '#c084a8'}
                    value={apiKeyInput}
                    onChangeText={setApiKeyInput}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View style={styles.settingsButtonRow}>
                    <TouchableOpacity style={styles.settingsSaveButton} onPress={saveApiKey}>
                      <Text style={styles.settingsSaveButtonText}>Save Key</Text>
                    </TouchableOpacity>
                    {apiKey && (
                      <TouchableOpacity style={styles.settingsClearButton} onPress={clearApiKey}>
                        <Text style={styles.settingsClearButtonText}>Clear Key</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {apiKey && (
                    <View style={styles.keyStatusRow}>
                      <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                      <Text style={styles.keyStatusText}>API key is set</Text>
                    </View>
                  )}
                  <Text style={[styles.settingsHint, { color: isDarkMode ? '#888' : '#a0527a' }]}>
                    Get a free key at aistudio.google.com
                  </Text>
                </View>
              </View>

              {/* Chat Features */}
              <View style={styles.settingsSection}>
                <Text style={[styles.settingsSectionTitle, { color: isDarkMode ? '#FF6B9D' : '#831843' }]}>
                  Chat Features
                </Text>
                <View style={[styles.settingsCard, { backgroundColor: isDarkMode ? '#2A2A2A' : '#fff' }]}>
                  <TouchableOpacity style={styles.settingsMenuItem} onPress={exportChat}>
                    <Ionicons name="share-outline" size={20} color={isDarkMode ? '#fff' : '#831843'} />
                    <Text style={[styles.settingsMenuText, { color: isDarkMode ? '#fff' : '#831843' }]}>
                      Export Chat to TXT
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#666' : '#a0527a'} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.settingsMenuItem} onPress={saveChatToGallery}>
                    <Ionicons name="save-outline" size={20} color={isDarkMode ? '#fff' : '#831843'} />
                    <Text style={[styles.settingsMenuText, { color: isDarkMode ? '#fff' : '#831843' }]}>
                      Save Chat to Gallery
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#666' : '#a0527a'} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.settingsMenuItem} onPress={() => setShowPinnedMessages(true)}>
                    <Ionicons name="pin-outline" size={20} color={isDarkMode ? '#fff' : '#831843'} />
                    <Text style={[styles.settingsMenuText, { color: isDarkMode ? '#fff' : '#831843' }]}>
                      Pinned Messages ({pinnedMessages.length})
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#666' : '#a0527a'} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.settingsMenuItem} onPress={() => setShowWallpaperPicker(true)}>
                    <Ionicons name="color-palette-outline" size={20} color={isDarkMode ? '#fff' : '#831843'} />
                    <Text style={[styles.settingsMenuText, { color: isDarkMode ? '#fff' : '#831843' }]}>
                      Chat Wallpaper
                    </Text>
                    <View style={[styles.wallpaperPreview, { backgroundColor: selectedWallpaper.gradientColors?.[0] || '#ec489a' }]} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.settingsMenuItem} onPress={toggleMuted}>
                    <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={20} color={isDarkMode ? '#fff' : '#831843'} />
                    <Text style={[styles.settingsMenuText, { color: isDarkMode ? '#fff' : '#831843' }]}>
                      {isMuted ? 'Unmute' : 'Mute'} Notifications
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#666' : '#a0527a'} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* About */}
              <View style={styles.settingsSection}>
                <Text style={[styles.settingsSectionTitle, { color: isDarkMode ? '#FF6B9D' : '#831843' }]}>
                  About Munga
                </Text>
                <View style={[styles.settingsCard, { backgroundColor: isDarkMode ? '#2A2A2A' : '#fff' }]}>
                  <Text style={[styles.aboutText, { color: isDarkMode ? '#ddd' : '#831843' }]}>
                    Munga is your magical AI bestie, always here to chat, support, and hype you up! 💕
                  </Text>
                  <View style={[styles.divider, { backgroundColor: isDarkMode ? '#444' : '#fbcfe8' }]} />
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: isDarkMode ? '#888' : '#a0527a' }]}>Bestie:</Text>
                    <Text style={[styles.infoValue, { color: isDarkMode ? '#fff' : '#831843' }]}>{ALICE_PROFILE.bestie}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: isDarkMode ? '#888' : '#a0527a' }]}>Career:</Text>
                    <Text style={[styles.infoValue, { color: isDarkMode ? '#fff' : '#831843' }]}>{ALICE_PROFILE.career}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: isDarkMode ? '#888' : '#a0527a' }]}>Birthday:</Text>
                    <Text style={[styles.infoValue, { color: isDarkMode ? '#fff' : '#831843' }]}>{ALICE_PROFILE.birthday}</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.clearHistoryButton, { backgroundColor: isDarkMode ? '#2A2A2A' : '#fee2e2' }]} 
                onPress={clearChatHistory}
              >
                <Text style={styles.clearHistoryText}>Clear Chat History</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </View>
    </Modal>
  );

  // ─── CLEAR CHAT HISTORY ───
  const clearChatHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all chat history?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('chat_messages')
                .delete()
                .eq('user_id', userId);
              
              await AsyncStorage.removeItem(STORAGE_KEYS.CHAT_HISTORY);
              
              setMessages([
                {
                  id: 'welcome',
                  role: 'assistant',
                  text: "Heyy bestie! I'm Munga 💕 I'm here whenever you need someone to talk to, laugh with, or just vibe. What's on your mind? ✨",
                  timestamp: Date.now(),
                  reactions: [],
                },
              ]);
              setShowSettings(false);
            } catch (err) {
              console.warn('Failed to clear history', err);
            }
          }
        }
      ]
    );
  };

  // ─── RENDER PINNED MESSAGES ───
  const renderPinnedMessages = () => (
    <Modal
      visible={showPinnedMessages}
      transparent
      animationType="slide"
      onRequestClose={() => setShowPinnedMessages(false)}
    >
      <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.4)' }]}>
        <LinearGradient
          colors={isDarkMode ? ['#1E1E1E', '#121212'] : ['#fff5f9', '#fff']}
          style={[styles.modalContent, { height: '70%' }]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        >
          <SafeAreaView style={styles.safeAreaContent}>
            <LinearGradient
              colors={['#ec489a', '#f43f5e']}
              style={styles.headerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Pinned Messages</Text>
                <TouchableOpacity onPress={() => setShowPinnedMessages(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {pinnedMessages.length === 0 ? (
              <View style={styles.emptyPinnedContainer}>
                <Ionicons name="pin-outline" size={48} color={isDarkMode ? '#444' : '#ccc'} />
                <Text style={[styles.emptyPinnedText, { color: isDarkMode ? '#666' : '#999' }]}>
                  No pinned messages yet
                </Text>
                <Text style={[styles.emptyPinnedSubtext, { color: isDarkMode ? '#444' : '#ccc' }]}>
                  Pin important messages to keep them handy
                </Text>
              </View>
            ) : (
              <FlatList
                data={pinnedMessages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={[styles.pinnedMessageItem, { 
                    backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
                    borderColor: isDarkMode ? '#444' : '#fbcfe8',
                  }]}>
                    <Text style={[styles.pinnedMessageText, { color: isDarkMode ? '#fff' : '#831843' }]}>
                      {item.text}
                    </Text>
                    <Text style={[styles.pinnedMessageTime, { color: isDarkMode ? '#666' : '#a0527a' }]}>
                      {new Date(item.timestamp).toLocaleString()}
                    </Text>
                    <TouchableOpacity
                      onPress={() => togglePinMessage(item)}
                      style={styles.unpinButton}
                    >
                      <Ionicons name="close-circle" size={24} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                )}
                contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
              />
            )}
          </SafeAreaView>
        </LinearGradient>
      </View>
    </Modal>
  );

  // ─── RENDER WALLPAPER PICKER ───
  const renderWallpaperPicker = () => (
    <Modal
      visible={showWallpaperPicker}
      transparent
      animationType="slide"
      onRequestClose={() => setShowWallpaperPicker(false)}
    >
      <View style={[styles.modalOverlay, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.4)' }]}>
        <LinearGradient
          colors={isDarkMode ? ['#1E1E1E', '#121212'] : ['#fff5f9', '#fff']}
          style={[styles.modalContent, { height: '70%' }]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        >
          <SafeAreaView style={styles.safeAreaContent}>
            <LinearGradient
              colors={['#ec489a', '#f43f5e']}
              style={styles.headerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Choose Wallpaper</Text>
                <TouchableOpacity onPress={() => setShowWallpaperPicker(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}>
              <View style={styles.wallpaperGrid}>
                {WALLPAPERS.map((wallpaper) => (
                  <TouchableOpacity
                    key={wallpaper.id}
                    style={[
                      styles.wallpaperItem,
                      selectedWallpaper.id === wallpaper.id && styles.wallpaperItemActive,
                    ]}
                    onPress={() => setWallpaper(wallpaper)}
                  >
                    <LinearGradient
                      colors={wallpaper.gradientColors || ['#ec489a', '#f43f5e']}
                      style={styles.wallpaperPreviewItem}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                    <Text style={[styles.wallpaperName, { color: isDarkMode ? '#fff' : '#831843' }]}>
                      {wallpaper.name}
                    </Text>
                    {selectedWallpaper.id === wallpaper.id && (
                      <Ionicons name="checkmark-circle" size={24} color="#22c55e" style={styles.wallpaperCheck} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </View>
    </Modal>
  );

  // ─── MAIN RENDER ───
  return (
    <>
      {/* Floating action button */}
      <Animated.View
        style={[
          styles.fabContainer,
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: pulseAnim },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity 
          style={styles.fab} 
          onPress={() => setVisible(true)} 
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#ec489a', '#f43f5e']}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="sparkles" size={26} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Chat modal - FULL SCREEN */}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={closeModal}
        statusBarTranslucent
      >
        <Animated.View style={[styles.fullScreenModal, { opacity: fadeAnim }]}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" />
          
          <LinearGradient
            colors={getWallpaperGradient() as string[]}
            style={styles.fullScreenContent}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          >
            <SafeAreaView style={[styles.safeAreaContent, { paddingTop: insets.top }]}>
              {/* Header with Gradient */}
              <LinearGradient
                colors={['#ec489a', '#f43f5e']}
                style={styles.headerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.header}>
                  <View style={styles.headerTitleRow}>
                    <Ionicons name="sparkles" size={20} color="#fff" />
                    <Text style={styles.headerTitle}>Munga</Text>
                    <View style={styles.onlineDot} />
                  </View>
                  <View style={styles.headerActions}>
                    <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.headerButton}>
                      <Ionicons name="settings-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={closeModal}>
                      <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </LinearGradient>

              {showKeyPrompt ? (
                <View style={[styles.keyPromptContainer, { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.95)' : 'rgba(255,245,249,0.95)' }]}>
                  <LinearGradient
                    colors={['#ec489a', '#f43f5e']}
                    style={styles.keyPromptIcon}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="key-outline" size={32} color="#fff" />
                  </LinearGradient>
                  <Text style={[styles.keyPromptTitle, { color: isDarkMode ? '#fff' : '#831843' }]}>
                    Set up your Gemini API key
                  </Text>
                  <Text style={[styles.keyPromptSubtitle, { color: isDarkMode ? '#888' : '#be185d' }]}>
                    Get a free key at aistudio.google.com
                  </Text>
                  <TextInput
                    style={[
                      styles.keyInput,
                      { 
                        color: isDarkMode ? '#fff' : '#831843',
                        borderColor: isDarkMode ? '#444' : '#fbcfe8',
                        backgroundColor: isDarkMode ? '#2A2A2A' : '#fff',
                      }
                    ]}
                    placeholder="Paste your Gemini API key"
                    placeholderTextColor={isDarkMode ? '#666' : '#c084a8'}
                    value={apiKeyInput}
                    onChangeText={setApiKeyInput}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View style={styles.keyPromptButtonRow}>
                    <TouchableOpacity style={styles.keySaveButton} onPress={saveApiKey}>
                      <Text style={styles.keySaveButtonText}>Save & Activate</Text>
                    </TouchableOpacity>
                    {apiKey && (
                      <TouchableOpacity
                        style={[styles.keyCancelButton, { backgroundColor: isDarkMode ? '#2A2A2A' : '#f1f1f1' }]}
                        onPress={() => setShowKeyPrompt(false)}
                      >
                        <Text style={[styles.keyCancelButtonText, { color: isDarkMode ? '#fff' : '#666' }]}>
                          Cancel
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ) : (
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                  style={styles.keyboardContainer}
                  keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                  <View style={styles.chatContainer}>
                    {renderQuickActions()}
                    
                    {typingIndicator && !sending && (
                      <View style={styles.typingIndicatorContainer}>
                        <Animated.View style={{ opacity: typingAnim }}>
                          <Text style={[styles.typingIndicatorText, { color: isDarkMode ? '#FF6B9D' : '#ec489a' }]}>
                            Munga is typing...
                          </Text>
                        </Animated.View>
                      </View>
                    )}
                    
                    <FlatList
                      ref={listRef}
                      data={messages}
                      keyExtractor={(item) => item.id}
                      renderItem={renderMessage}
                      contentContainerStyle={[styles.chatList, { paddingBottom: 8 }]}
                      onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
                      style={{ flex: 1 }}
                    />

                    {sending && (
                      <View style={styles.typingRow}>
                        <ActivityIndicator size="small" color="#ec489a" />
                        <Text style={[styles.typingText, { color: isDarkMode ? '#FF6B9D' : '#ec489a' }]}>
                          Munga is thinking...
                        </Text>
                      </View>
                    )}

                    <View style={[
                      styles.inputRow,
                      { 
                        backgroundColor: isDarkMode ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)',
                        borderTopColor: isDarkMode ? '#333' : '#fbcfe8',
                        paddingBottom: insets.bottom + 10,
                      }
                    ]}>
                      <TouchableOpacity
                        onPress={pickImage}
                        style={styles.inputActionButton}
                      >
                        <Ionicons name="image-outline" size={22} color="#ec489a" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={isRecording ? stopRecording : startRecording}
                        style={styles.inputActionButton}
                      >
                        <Animated.View style={{ transform: [{ scale: isRecording ? recordAnim : 1 }] }}>
                          <Ionicons 
                            name={isRecording ? 'mic' : 'mic-outline'} 
                            size={22} 
                            color={isRecording ? '#dc2626' : '#ec489a'} 
                          />
                        </Animated.View>
                      </TouchableOpacity>

                      <TextInput
                        style={[
                          styles.textInput,
                          { 
                            backgroundColor: isDarkMode ? '#2A2A2A' : '#fff0f7',
                            color: isDarkMode ? '#fff' : '#831843',
                          }
                        ]}
                        placeholder={isRecording ? 'Recording... tap mic to stop' : "Tell me something, bestie..."}
                        placeholderTextColor={isDarkMode ? '#666' : '#c084a8'}
                        value={inputText}
                        onChangeText={setInputText}
                        editable={!sending && !isRecording}
                        onSubmitEditing={() => sendMessage()}
                        returnKeyType="send"
                      />

                      <TouchableOpacity
                        style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                        onPress={() => sendMessage()}
                        disabled={sending}
                      >
                        <LinearGradient
                          colors={['#ec489a', '#f43f5e']}
                          style={styles.sendButtonGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <Ionicons name="send" size={18} color="#fff" />
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                </KeyboardAvoidingView>
              )}
            </SafeAreaView>
          </LinearGradient>
        </Animated.View>
      </Modal>

      {renderSettingsModal()}
      {renderWallpaperPicker()}
      {renderPinnedMessages()}
    </>
  );
};

// ─────────────────────────────────────────────────────────
// Styles (Android Optimized)
// ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── FAB ──
  fabContainer: {
    position: 'absolute',
    zIndex: 999,
    elevation: 10,
    width: 56,
    height: 56,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: '#ec489a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Full Screen Modal ──
  fullScreenModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  fullScreenContent: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 40 : 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  safeAreaContent: {
    flex: 1,
  },

  // ── Header ──
  headerGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginLeft: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerButton: {
    padding: 4,
  },

  // ── Chat ──
  keyboardContainer: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
  },
  chatList: {
    padding: 16,
    flexGrow: 1,
  },
  messageWrapper: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  messageWrapperUser: {
    justifyContent: 'flex-end',
  },
  messageWrapperAI: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  userBubble: {
    borderBottomRightRadius: 6,
  },
  aiBubble: {
    borderBottomLeftRadius: 6,
  },
  userText: {
    fontSize: 15,
    lineHeight: 20,
  },
  aiText: {
    fontSize: 15,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 8,
  },
  reactionContainer: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 2,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  messageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    backgroundColor: '#ec489a',
    borderRadius: 10,
    padding: 2,
    zIndex: 10,
  },
  reactionPicker: {
    position: 'absolute',
    bottom: 30,
    right: 0,
    flexDirection: 'row',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 100,
  },
  reactionPickerItem: {
    paddingHorizontal: 4,
  },
  reactionPickerEmoji: {
    fontSize: 20,
  },

  // ── Input ──
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 6,
  },
  inputActionButton: {
    padding: 6,
  },
  textInput: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
  },
  sendButtonGradient: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },

  // ── Typing ──
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 6,
    gap: 8,
  },
  typingText: {
    fontSize: 13,
  },
  typingIndicatorContainer: {
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  typingIndicatorText: {
    fontSize: 12,
    fontStyle: 'italic',
  },

  // ── Quick Actions ──
  quickActionsContainer: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  quickActionsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Key Prompt ──
  keyPromptContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  keyPromptIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  keyPromptTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  keyPromptSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  keyInput: {
    width: '100%',
    borderWidth: 2,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  keyPromptButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  keySaveButton: {
    backgroundColor: '#ec489a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  keySaveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  keyCancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  keyCancelButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },

  // ── Settings Modal ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '85%',
    overflow: 'hidden',
  },
  settingsModalContent: {
    height: '85%',
  },
  settingsScroll: {
    flex: 1,
  },
  settingsContent: {
    padding: 16,
  },
  settingsSection: {
    marginBottom: 20,
  },
  settingsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  settingsCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingsLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  settingsInput: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  settingsButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  settingsSaveButton: {
    backgroundColor: '#ec489a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    flex: 1,
  },
  settingsSaveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
  settingsClearButton: {
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    flex: 1,
  },
  settingsClearButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  keyStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  keyStatusText: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '500',
  },
  settingsHint: {
    fontSize: 12,
  },
  settingsMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  settingsMenuText: {
    flex: 1,
    fontSize: 15,
    marginLeft: 12,
  },
  wallpaperPreview: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  clearHistoryButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  clearHistoryText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 14,
  },

  // ── Wallpaper Picker ──
  wallpaperGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  wallpaperItem: {
    width: (screenWidth - 48) / 3,
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  wallpaperItemActive: {
    borderColor: '#ec489a',
  },
  wallpaperPreviewItem: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
  },
  wallpaperName: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  wallpaperCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
  },

  // ── Pinned Messages ──
  emptyPinnedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyPinnedText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyPinnedSubtext: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  pinnedMessageItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pinnedMessageText: {
    flex: 1,
    fontSize: 14,
  },
  pinnedMessageTime: {
    fontSize: 11,
  },
  unpinButton: {
    padding: 4,
  },
});
