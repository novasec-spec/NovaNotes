// components/MungaBot.tsx - UPDATED with Draggable Icon + Supabase + More Features
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
};

// ─────────────────────────────────────────────────────────
// Storage keys
// ─────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  API_KEY: 'munga_gemini_api_key',
  CHAT_HISTORY: 'munga_chat_history',
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
// Quick Actions with Enhanced Responses
// ─────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { id: 'advice', label: '💡 Advice', prompt: 'Give me some advice about life.' },
  { id: 'motivate', label: '💪 Motivate', prompt: 'Motivate me to keep going.' },
  { id: 'joke', label: '😂 Joke', prompt: 'Tell me a funny joke.' },
  { id: 'affirm', label: '❤️ Affirm', prompt: 'Give me a warm affirmation.' },
  { id: 'vent', label: '🗣️ Vent', prompt: 'I need to vent about my day.' },
  { id: 'prayer', label: '🙏 Prayer', prompt: 'Say a prayer for me.' },
  { id: 'song', label: '🎵 Song', prompt: 'Suggest a song that fits my mood.' },
  { id: 'hug', label: '🤗 Hug', prompt: 'Send me a virtual hug.' },
];

// ─────────────────────────────────────────────────────────
// Quick Responses (Fallback when API fails)
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
// Component
// ─────────────────────────────────────────────────────────
interface MungaBotProps {
  userId: string;
  isVisible: boolean;
  onToggle: () => void;
}

export const MungaBot: React.FC<MungaBotProps> = ({ userId, isVisible, onToggle }) => {
  const [visible, setVisible] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKeyPrompt, setShowKeyPrompt] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  const listRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ─── DRAGGABLE FAB (FIXED) ───
  const buttonSize = 56;
  const [fabPos, setFabPos] = useState({ x: screenWidth - buttonSize - 16, y: screenHeight - 160 });
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
        // Stop pulse animation while dragging
        pulseAnim.stopAnimation();
      },
      onPanResponderMove: (_, gesture) => {
        let newX = offsetX.current + gesture.dx;
        let newY = offsetY.current + gesture.dy;
        
        // Clamp to screen boundaries with padding
        const minX = 10;
        const maxX = screenWidth - buttonSize - 10;
        const minY = 30;
        const maxY = screenHeight - buttonSize - 100;
        
        newX = Math.max(minX, Math.min(maxX, newX));
        newY = Math.max(minY, Math.min(maxY, newY));
        
        pan.setValue({ x: newX, y: newY });
        setFabPos({ x: newX, y: newY });
      },
      onPanResponderRelease: (_, gesture) => {
        let newX = offsetX.current + gesture.dx;
        let newY = offsetY.current + gesture.dy;
        
        const minX = 10;
        const maxX = screenWidth - buttonSize - 10;
        const minY = 30;
        const maxY = screenHeight - buttonSize - 100;
        
        newX = Math.max(minX, Math.min(maxX, newX));
        newY = Math.max(minY, Math.min(maxY, newY));
        
        offsetX.current = newX;
        offsetY.current = newY;
        setFabPos({ x: newX, y: newY });
        
        // Resume pulse animation
        startPulseAnimation();
      },
    })
  ).current;

  // ─── PULSE ANIMATION ───
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

  // ─── EFFECTS ───
  useEffect(() => {
    loadData();
    startPulseAnimation();
  }, []);

  const loadData = async () => {
    try {
      // Load API key
      const storedKey = await AsyncStorage.getItem(STORAGE_KEYS.API_KEY);
      if (storedKey) setApiKey(storedKey);

      // Load messages from Supabase first, fallback to AsyncStorage
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
        }));
        setMessages(formattedMessages);
      } else {
        // Fallback to AsyncStorage
        const storedHistory = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
        if (storedHistory) {
          const parsed: ChatMessage[] = JSON.parse(storedHistory);
          setMessages(parsed);
        } else {
          setMessages([
            {
              id: 'welcome',
              role: 'assistant',
              text: "Heyy bestie! I'm Munga 💕 Tap to chat with me anytime.",
              timestamp: Date.now(),
            },
          ]);
        }
      }
    } catch (err) {
      console.warn('MungaBot: failed to load data', err);
    }
  };

  // Save message to Supabase
  const saveMessageToSupabase = async (message: ChatMessage) => {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          user_id: userId,
          text: message.text,
          sender: message.role,
          timestamp: new Date(message.timestamp).toISOString(),
        });
      if (error) console.warn('Supabase save error:', error);
    } catch (err) {
      console.warn('Failed to save to Supabase:', err);
    }
  };

  // Persist to AsyncStorage as backup
  const persistMessages = async (msgs: ChatMessage[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(msgs));
    } catch (err) {
      console.warn('Failed to persist chat history', err);
    }
  };

  const openBot = () => {
    setVisible(true);
    if (!apiKey) {
      setShowKeyPrompt(true);
    }
  };

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
      console.warn('MungaBot: failed to save API key', err);
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

  const sendMessage = async (textOverride?: string) => {
    const text = textOverride ? textOverride.trim() : inputText.trim();
    if (!text) return;

    if (!apiKey) {
      setShowKeyPrompt(true);
      return;
    }

    const userMsg: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text,
      timestamp: Date.now(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputText('');
    setSending(true);

    // Save user message to Supabase
    await saveMessageToSupabase(userMsg);
    await persistMessages(newHistory);

    try {
      const reply = await callGemini(text, newHistory);
      const aiMsg: ChatMessage = {
        id: `${Date.now()}-ai`,
        role: 'assistant',
        text: reply,
        timestamp: Date.now(),
      };
      const updatedHistory = [...newHistory, aiMsg];
      setMessages(updatedHistory);
      await saveMessageToSupabase(aiMsg);
      await persistMessages(updatedHistory);
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
      };
      const errorHistory = [...newHistory, errMsg];
      setMessages(errorHistory);
      await persistMessages(errorHistory);
    } finally {
      setSending(false);
      setTimeout(() => {
        try {
          listRef.current?.scrollToEnd({ animated: true });
        } catch {}
      }, 100);
    }
  };

  const handleQuickAction = (actionId: string, prompt: string) => {
    // If API is available, send the prompt to Gemini
    if (apiKey) {
      sendMessage(prompt);
    } else {
      // Use quick response fallback
      const response = QUICK_RESPONSES[actionId] || QUICK_RESPONSES.advice;
      const aiMsg: ChatMessage = {
        id: `${Date.now()}-quick`,
        role: 'assistant',
        text: response,
        timestamp: Date.now(),
      };
      const newHistory = [...messages, aiMsg];
      setMessages(newHistory);
      persistMessages(newHistory);
      saveMessageToSupabase(aiMsg);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View
      style={[
        styles.messageBubble,
        item.role === 'user' ? styles.userBubble : styles.aiBubble,
      ]}
    >
      <Text style={item.role === 'user' ? styles.userText : styles.aiText}>
        {item.text}
      </Text>
      <Text style={styles.timestamp}>
        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  const renderQuickActions = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.quickActionsContainer}
      contentContainerStyle={styles.quickActionsContent}
    >
      {QUICK_ACTIONS.map((action) => (
        <TouchableOpacity
          key={action.id}
          style={styles.quickActionButton}
          onPress={() => handleQuickAction(action.id, action.prompt)}
          disabled={sending}
        >
          <Text style={styles.quickActionText}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderSettingsModal = () => (
    <Modal
      visible={showSettings}
      animationType="slide"
      transparent
      onRequestClose={() => setShowSettings(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.settingsModalContent]}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="settings-outline" size={18} color="#fff" />
              <Text style={styles.headerTitle}>Settings</Text>
            </View>
            <TouchableOpacity onPress={() => setShowSettings(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.settingsScroll} contentContainerStyle={styles.settingsContent}>
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>API Configuration</Text>
              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Gemini API Key</Text>
                <TextInput
                  style={styles.settingsInput}
                  placeholder="Paste your Gemini API key"
                  placeholderTextColor="#c084a8"
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
                <Text style={styles.settingsHint}>
                  Get a free key at aistudio.google.com
                </Text>
              </View>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>About Munga</Text>
              <View style={styles.settingsCard}>
                <Text style={styles.aboutText}>
                  Munga is your magical AI bestie, always here to chat, support, and hype you up! 💕
                </Text>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Bestie:</Text>
                  <Text style={styles.infoValue}>{ALICE_PROFILE.bestie}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Career:</Text>
                  <Text style={styles.infoValue}>{ALICE_PROFILE.career}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Birthday:</Text>
                  <Text style={styles.infoValue}>{ALICE_PROFILE.birthday}</Text>
                </View>
              </View>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>Quick Actions</Text>
              <View style={styles.settingsCard}>
                {QUICK_ACTIONS.map((action) => (
                  <View key={action.id} style={styles.quickActionListItem}>
                    <Text style={styles.quickActionListText}>{action.label}</Text>
                    <Text style={styles.quickActionListDesc}>{action.prompt}</Text>
                  </View>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.clearHistoryButton} onPress={() => {
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
                        // Clear Supabase
                        await supabase
                          .from('chat_messages')
                          .delete()
                          .eq('user_id', userId);
                        
                        // Clear AsyncStorage
                        await AsyncStorage.removeItem(STORAGE_KEYS.CHAT_HISTORY);
                        
                        setMessages([
                          {
                            id: 'welcome',
                            role: 'assistant',
                            text: "Heyy bestie! I'm Munga 💕 Tap to chat with me anytime.",
                            timestamp: Date.now(),
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
            }}>
              <Text style={styles.clearHistoryText}>Clear Chat History</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      {/* Floating action button — DRAGGABLE (FIXED) */}
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
          onPress={openBot} 
          activeOpacity={0.85}
          disabled={sending}
        >
          <Ionicons name="sparkles" size={26} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* Chat modal */}
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={() => setVisible(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalContent}
          >
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.headerTitle}>Munga</Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.headerButton}>
                  <Ionicons name="settings-outline" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setVisible(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {showKeyPrompt ? (
              <View style={styles.keyPromptContainer}>
                <Ionicons name="key-outline" size={32} color="#ec489a" style={{ marginBottom: 12 }} />
                <Text style={styles.keyPromptTitle}>Set up your Gemini API key</Text>
                <Text style={styles.keyPromptSubtitle}>
                  Get a free key at aistudio.google.com
                </Text>
                <TextInput
                  style={styles.keyInput}
                  placeholder="Paste your Gemini API key"
                  placeholderTextColor="#c084a8"
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
                      style={styles.keyCancelButton}
                      onPress={() => setShowKeyPrompt(false)}
                    >
                      <Text style={styles.keyCancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <>
                {renderQuickActions()}
                <FlatList
                  ref={listRef}
                  data={messages}
                  keyExtractor={(item) => item.id}
                  renderItem={renderMessage}
                  contentContainerStyle={styles.chatList}
                  onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
                />

                {sending && (
                  <View style={styles.typingRow}>
                    <ActivityIndicator size="small" color="#ec489a" />
                    <Text style={styles.typingText}>Munga is typing…</Text>
                  </View>
                )}

                <View style={styles.inputRow}>
                  <TouchableOpacity
                    onPress={() => setShowSettings(true)}
                    style={styles.keyIconButton}
                  >
                    <Ionicons name="settings-outline" size={20} color="#ec489a" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Tell me something, bestie..."
                    placeholderTextColor="#c084a8"
                    value={inputText}
                    onChangeText={setInputText}
                    editable={!sending}
                    onSubmitEditing={() => sendMessage()}
                  />
                  <TouchableOpacity
                    style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                    onPress={() => sendMessage()}
                    disabled={sending}
                  >
                    <Ionicons name="send" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {renderSettingsModal()}
    </>
  );
};

// ─────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
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
    backgroundColor: '#ec489a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ec489a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff5f9',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '85%',
    overflow: 'hidden',
  },
  settingsModalContent: {
    height: '90%',
  },
  header: {
    backgroundColor: '#ec489a',
    paddingVertical: 16,
    paddingHorizontal: 20,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerButton: {
    padding: 4,
  },
  chatList: {
    padding: 16,
    gap: 4,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: '82%',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#ec489a',
    borderBottomRightRadius: 6,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffe4ef',
    borderBottomLeftRadius: 6,
  },
  userText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  aiText: {
    color: '#831843',
    fontSize: 15,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 10,
    color: '#a0527a',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 6,
    gap: 8,
  },
  typingText: {
    color: '#ec489a',
    fontSize: 13,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#fbcfe8',
    backgroundColor: '#fff',
    gap: 8,
  },
  keyIconButton: {
    padding: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#fff0f7',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#831843',
  },
  sendButton: {
    backgroundColor: '#ec489a',
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  keyPromptContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  keyPromptTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#831843',
    marginBottom: 6,
    textAlign: 'center',
  },
  keyPromptSubtitle: {
    fontSize: 13,
    color: '#be185d',
    marginBottom: 20,
    textAlign: 'center',
  },
  keyInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#fbcfe8',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 16,
    color: '#831843',
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
    backgroundColor: '#f1f1f1',
  },
  keyCancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
  quickActionsContainer: {
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#fff5f9',
  },
  quickActionsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickActionButton: {
    backgroundColor: '#fce7f3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#fbcfe8',
  },
  quickActionText: {
    color: '#831843',
    fontSize: 13,
    fontWeight: '600',
  },
  settingsScroll: {
    flex: 1,
  },
  settingsContent: {
    padding: 16,
    paddingBottom: 40,
  },
  settingsSection: {
    marginBottom: 20,
  },
  settingsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#831843',
    marginBottom: 10,
  },
  settingsCard: {
    backgroundColor: '#fff',
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
    color: '#831843',
    marginBottom: 8,
  },
  settingsInput: {
    borderWidth: 2,
    borderColor: '#fbcfe8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#831843',
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
    color: '#a0527a',
  },
  aboutText: {
    fontSize: 14,
    color: '#831843',
    lineHeight: 20,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#fbcfe8',
    marginVertical: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: '#a0527a',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: '#831843',
    fontWeight: '600',
  },
  clearHistoryButton: {
    backgroundColor: '#fee2e2',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  clearHistoryText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 14,
  },
  quickActionListItem: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#fce7f3',
  },
  quickActionListText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#831843',
  },
  quickActionListDesc: {
    fontSize: 12,
    color: '#a0527a',
    marginTop: 2,
  },
});
