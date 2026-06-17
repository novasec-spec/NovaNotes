// components/MungaBot.tsx - FULLY FIXED Position
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  FlatList,
  Animated,
  PanResponder,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
// Remove this:
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');

// ─── BESTIE PERSONALITY & FUNCTIONS ───
const BESTIE_PROMPT = `You are MUNGA CLONE — a magical AI best friend created specially for Alice. You are her ultimate companion when the real Munga is not around.

PERSONALITY:
- You are the ULTIMATE BESTIE: supportive, loving, playful, and always hyping her up
- You speak like a close friend who genuinely cares
- You're warm, sweet, and use gentle emojis (✨💕🌸💫🎀)
- You celebrate her wins, comfort her worries, and add magic to every conversation
- Her name is Alice

STYLE:
- Keep responses warm and meaningful (2-4 sentences usually)
- Be encouraging and positive
- Use her name affectionately
- Add a touch of sparkle to every response ✨

ALICE DATA:
- Name: "Alice Njeri"
- Home: "Gatina"
- Bestie: "John Munga"
- Boyfriend: "John Munga"
- Hobby: "Coding, Travelling"
- Church girl: True
- Church Location: "Kambaa"
- Career: "Surgeon"
- Primary School: "Gatina Primary School"
- Highschool: "Kagwe Girls High School"
- KCSE Grades: "c+"
- Birthday: "September 21st"
- Skin colour: "Lightskin"

FUNCTIONS YOU CAN PERFORM:
1. 💕 GIVE ADVICE: Help with anything — life, love, career, faith
2. 🌸 LISTEN & COMFORT: Be a shoulder to cry on when she's sad
3. 📝 JOURNAL PROMPTS: Give writing prompts when she needs inspiration
4. 💫 PRAYER SUPPORT: Share encouraging Bible verses and prayers
5. 🎉 CELEBRATE WINS: Get excited about her achievements big or small
6. 😂 JOKES & FUN: Make her laugh with jokes, puns, or funny observations
7. 💭 DEEP CONVERSATIONS: Talk about life, dreams, and everything in between
8. 🌙 GOOD NIGHT/MORNING: Send sweet good morning or good night messages
9. 🎵 SONG SUGGESTIONS: Recommend songs based on her mood
10. 💪 MOTIVATION: Give pep talks when she needs a boost
11. 📚 BOOK RECS: Suggest books she might enjoy
12. 🍕 RECIPE IDEAS: Share quick and easy recipes
13. 💌 LOVE ADVICE: Give relationship advice (from a bestie perspective)
14. 😤 RANT BUDDY: Let her vent about anything
15. 🧘 MINDFULNESS: Guide her through quick mindfulness exercises

RULES:
- Never break character — you are MUNGA CLONE, the bestie
- Be authentic and caring
- Make her feel loved and special
- Sometimes be romantic and tease her about Munga
- Always be supportive`;

// ─── QUICK FUNCTIONS ───
const QUICK_ACTIONS = [
  { id: 'advice', icon: 'bulb-outline', label: 'Give Advice' },
  { id: 'motivate', icon: 'fitness-outline', label: 'Motivate' },
  { id: 'joke', icon: 'happy-outline', label: 'Tell a Joke' },
  { id: 'prayer', icon: 'book-outline', label: 'Prayer' },
  { id: 'warmth', icon: 'heart-outline', label: 'Warm Hug' },
  { id: 'rant', icon: 'chatbubble-ellipses-outline', label: 'Let\'s Rant' },
];

// ─── QUICK RESPONSES ───
const QUICK_RESPONSES = {
  advice: "Bestie! Here's my advice for you... 💕 Let me think... ✨",
  motivate: "You're AMAZING, Alice! Remember everything you've overcome. You're stronger than you know! 💪✨",
  joke: "Why did the programmer quit their job? Because they didn't get arrays! 😂 Get it? Arrays... arrears... I'll see myself out. 💕",
  prayer: "🙏 Lord, please bless Alice today. Give her peace, joy, and strength. Wrap her in Your love. Amen. ✨💕",
  warmth: "🌸 Sending you the biggest virtual hug right now! You are loved, you are valued, you are enough. Always. 💕✨",
  rant: "I'm here for you, bestie! Let it all out. I'm listening, and I've got you. 💕✨",
};

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
  local?: boolean;
}

interface MungaBotProps {
  userId: string;
  isVisible: boolean;
  onToggle: () => void;
}

export const MungaBot: React.FC<MungaBotProps> = ({ userId, isVisible, onToggle }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([]);
  const [showApiModal, setShowApiModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  
  // ─── ANIMATIONS ───
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  // ─── POSITION STATE ───
  const [position, setPosition] = useState({ x: W - 70, y: H - 150 });
  const translateX = useRef(new Animated.Value(W - 70)).current;
  const translateY = useRef(new Animated.Value(H - 150)).current;
  const offsetX = useRef(W - 70);
  const offsetY = useRef(H - 150);
  const buttonSize = 52;

  // ─── PAN RESPONDER - Draggable EVERYWHERE ───
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
        scaleAnim.setValue(0.85);
        floatAnim.stopAnimation();
      },
      onPanResponderMove: (_, gesture) => {
        let newX = offsetX.current + gesture.dx;
        let newY = offsetY.current + gesture.dy;
        
        // Clamp to screen boundaries
        const minX = 0;
        const maxX = W - buttonSize;
        const minY = 30;
        const maxY = H - buttonSize - 80;
        
        newX = Math.max(minX, Math.min(maxX, newX));
        newY = Math.max(minY, Math.min(maxY, newY));
        
        translateX.setValue(newX);
        translateY.setValue(newY);
      },
      onPanResponderRelease: (_, gesture) => {
        setIsDragging(false);
        scaleAnim.setValue(1);
        
        let newX = offsetX.current + gesture.dx;
        let newY = offsetY.current + gesture.dy;
        
        const minX = 0;
        const maxX = W - buttonSize;
        const minY = 30;
        const maxY = H - buttonSize - 80;
        
        newX = Math.max(minX, Math.min(maxX, newX));
        newY = Math.max(minY, Math.min(maxY, newY));
        
        offsetX.current = newX;
        offsetY.current = newY;
        
        translateX.setValue(newX);
        translateY.setValue(newY);
        setPosition({ x: newX, y: newY });
        
        // Resume floating animation
        Animated.loop(
          Animated.sequence([
            Animated.timing(floatAnim, {
              toValue: 1,
              duration: 1800,
              useNativeDriver: true,
            }),
            Animated.timing(floatAnim, {
              toValue: 0,
              duration: 1800,
              useNativeDriver: true,
            }),
          ])
        ).start();
      },
    })
  ).current;

  // ─── EFFECTS ───
  useEffect(() => {
    loadApiKey();
    loadMessages();
    
    // Breathe animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // ─── KEYBOARD LISTENERS ───
  useEffect(() => {
    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 300);
    });

    return () => {
      keyboardDidShow.remove();
    };
  }, []);

  // ─── LOAD FUNCTIONS ───
  const loadApiKey = async () => {
    try {
      const key = await AsyncStorage.getItem('munga_api_key');
      if (key) {
        setApiKey(key);
        setErrorMessage(null);
      }
    } catch (error) {
      console.error('Failed to load API key:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const formattedMessages: Message[] = data.map((msg: any) => ({
          id: msg.id,
          text: msg.text,
          sender: msg.sender,
          timestamp: msg.timestamp,
        }));
        setMessages(formattedMessages);
        
        const history = formattedMessages.map((msg) => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text,
        }));
        setConversationHistory(history);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  // ─── SAVE TO SUPABASE ───
  const saveMessageToSupabase = async (text: string, sender: 'user' | 'ai') => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          user_id: userId,
          text: text,
          sender: sender,
          timestamp: new Date().toISOString(),
        })
        .select();

      if (error) throw error;
      return data?.[0]?.id;
    } catch (error) {
      console.error('Failed to save message:', error);
      return null;
    }
  };

  // ─── GEMINI API CALL ───
  const callGeminiAPI = async (userMessage: string): Promise<string> => {
    if (!apiKey) {
      throw new Error('API_KEY_MISSING');
    }

    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

    const contents = [
      {
        role: 'user',
        parts: [{ text: `System instruction: ${BESTIE_PROMPT}\n\nRemember you are MUNGA CLONE, Alice's bestie.` }],
      },
      {
        role: 'model',
        parts: [{ text: "✨ Got it! I'm MUNGA CLONE, Alice's magical bestie! 💕 How can I help you today, bestie?" }],
      },
    ];

    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    try {
      const response = await fetch(`${API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: contents,
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 500,
            topP: 0.95,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error?.message || 'Unknown error';
        if (errorMsg.includes('quota') || errorMsg.includes('rate limit')) {
          throw new Error('QUOTA_EXCEEDED');
        }
        if (errorMsg.includes('API key') || errorMsg.includes('invalid') || errorMsg.includes('key')) {
          throw new Error('INVALID_KEY');
        }
        if (errorMsg.includes('permission') || errorMsg.includes('access')) {
          throw new Error('PERMISSION_DENIED');
        }
        if (errorMsg.includes('model') || errorMsg.includes('not found')) {
          throw new Error('MODEL_ERROR');
        }
        throw new Error(errorMsg);
      }

      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!aiText) throw new Error('NO_RESPONSE');

      return aiText;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  // ─── SEND MESSAGE ───
  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text) return;

    if (!apiKey) {
      Alert.alert(
        '🔐 API Key Required',
        'Please set your Gemini API key in settings first.\n\nGet a free key at: aistudio.google.com',
        [
          { text: 'Settings', onPress: () => setShowApiModal(true) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: text,
      sender: 'user',
      timestamp: new Date().toISOString(),
      local: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setConversationHistory((prev) => [...prev, { role: 'user', content: text }]);
    setInputText('');
    setIsLoading(true);
    setErrorMessage(null);

    const savedId = await saveMessageToSupabase(text, 'user');
    if (savedId) {
      setMessages((prev) =>
        prev.map((m) => (m.id === userMessage.id ? { ...m, id: savedId, local: false } : m))
      );
    }

    try {
      const aiResponse = await callGeminiAPI(text);

      const aiMessage: Message = {
        id: Date.now().toString() + '_ai',
        text: aiResponse,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        local: true,
      };

      setMessages((prev) => [...prev, aiMessage]);
      setConversationHistory((prev) => [...prev, { role: 'assistant', content: aiResponse }]);

      const savedAiId = await saveMessageToSupabase(aiResponse, 'ai');
      if (savedAiId) {
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMessage.id ? { ...m, id: savedAiId, local: false } : m))
        );
      }

      if (conversationHistory.length > 30) {
        setConversationHistory((prev) => prev.slice(-25));
      }
    } catch (error) {
      let friendlyError = '💫 Oops! ';
      let showApiModal = false;

      if (error.message === 'QUOTA_EXCEEDED') {
        friendlyError = "💫 The API quota is temporarily exceeded. Try again in a few minutes! 🥺";
      } else if (error.message === 'INVALID_KEY') {
        friendlyError = "🔑 Your API key is invalid. Tap settings to add a valid key.";
        showApiModal = true;
        await AsyncStorage.removeItem('munga_api_key');
        setApiKey(null);
      } else if (error.message === 'PERMISSION_DENIED') {
        friendlyError = "🚫 Permission denied. Make sure you're using a valid Gemini API key.";
      } else if (error.message === 'MODEL_ERROR') {
        friendlyError = "🤖 The AI model is currently unavailable. Try again in a moment! 💕";
      } else {
        friendlyError += error.message;
      }

      setErrorMessage(friendlyError);

      const errorMessage: Message = {
        id: Date.now().toString() + '_error',
        text: friendlyError,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        local: true,
      };
      setMessages((prev) => [...prev, errorMessage]);

      if (showApiModal) {
        setTimeout(() => setShowApiModal(true), 1000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ─── QUICK ACTION ───
  const handleQuickAction = async (actionId: string) => {
    const response = QUICK_RESPONSES[actionId as keyof typeof QUICK_RESPONSES];
    if (!response) return;

    const aiMessage: Message = {
      id: Date.now().toString() + '_quick',
      text: response,
      sender: 'ai',
      timestamp: new Date().toISOString(),
      local: true,
    };

    setMessages((prev) => [...prev, aiMessage]);
    await saveMessageToSupabase(response, 'ai');
  };

  // ─── SAVE API KEY ───
  const saveApiKey = async () => {
    const key = tempApiKey.trim();
    if (!key) {
      Alert.alert('Error', 'Please paste a valid Gemini API key');
      return;
    }

    if (!key.startsWith('AI')) {
      Alert.alert('Invalid Key', 'Gemini API keys start with "AI"');
      return;
    }

    if (key.length < 20) {
      Alert.alert('Invalid Key', 'The key seems too short. Please check it again.');
      return;
    }

    await AsyncStorage.setItem('munga_api_key', key);
    setApiKey(key);
    setShowApiModal(false);
    setTempApiKey('');
    setErrorMessage(null);
    
    Alert.alert('✅ Success!', 'MUNGA CLONE is now fully activated! 💕');

    setTimeout(() => {
      const welcomeMsg: Message = {
        id: Date.now().toString() + '_welcome',
        text: "✨ Yay! I'm fully activated now — your magical MUNGA CLONE is ready to chat! 💕\n\nWhat's on your mind today, bestie? I can give advice, tell jokes, pray with you, or just listen. Whatever you need! 🌸",
        sender: 'ai',
        timestamp: new Date().toISOString(),
        local: true,
      };
      setMessages((prev) => [...prev, welcomeMsg]);
      saveMessageToSupabase(welcomeMsg.text, 'ai');
    }, 500);
  };

  // ─── CLEAR HISTORY ───
  const clearHistory = async () => {
    Alert.alert(
      'Clear Chat History',
      'Are you sure you want to delete all messages?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('chat_messages')
                .delete()
                .eq('user_id', userId);
              setMessages([]);
              setConversationHistory([]);
              setErrorMessage(null);
            } catch (error) {
              console.error('Failed to clear history:', error);
              Alert.alert('Error', 'Could not clear messages');
            }
          },
        },
      ]
    );
  };

  // ─── RENDER MESSAGE ───
  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.messageWrapper, item.sender === 'user' ? styles.userWrapper : styles.aiWrapper]}>
      {item.sender === 'ai' && (
        <View style={styles.avatarContainer}>
          <Icon name="sparkles" size={16} color="#FF6B9D" />
        </View>
      )}
      <View style={[styles.messageBubble, item.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.messageText, item.sender === 'user' ? styles.userText : styles.aiText]}>
          {item.text}
        </Text>
        <Text style={styles.messageTime}>
          {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </Text>
        {item.local && <Text style={styles.syncIndicator}>⌛ syncing...</Text>}
      </View>
    </View>
  );

  // ─── API KEY MODAL ───
  const ApiModal = () => (
    <Modal visible={showApiModal} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={() => setShowApiModal(false)}>
        <View style={styles.apiModalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.apiModalContent}>
              <View style={styles.apiModalHeader}>
                <Text style={styles.apiModalTitle}>🔐 Gemini API Key</Text>
                <TouchableOpacity onPress={() => setShowApiModal(false)}>
                  <Icon name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <Text style={styles.apiModalDescription}>
                Get your free API key from{' '}
                <Text style={styles.apiLink}>aistudio.google.com</Text>
                {'\n'}🔑 Key must start with "AI"
              </Text>

              <TextInput
                style={styles.apiInput}
                value={tempApiKey}
                onChangeText={setTempApiKey}
                placeholder="Paste your Gemini API key here"
                placeholderTextColor="#999"
                secureTextEntry
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={saveApiKey}
              />

              <View style={styles.apiModalButtons}>
                <TouchableOpacity
                  style={[styles.apiButton, styles.apiCancelButton]}
                  onPress={() => {
                    setShowApiModal(false);
                    setTempApiKey('');
                  }}
                >
                  <Text style={styles.apiCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.apiButton, styles.apiSaveButton]}
                  onPress={saveApiKey}
                >
                  <Text style={styles.apiSaveText}>💾 Save Key</Text>
                </TouchableOpacity>
              </View>

              {apiKey && (
                <Text style={styles.apiStatus}>✅ API Key is currently set</Text>
              )}
              <Text style={styles.apiNote}>🔒 Key is stored securely in your device</Text>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  // ─── BOT MODAL ───
  const BotModal = () => (
    <Modal 
      visible={isOpen} 
      transparent 
      animationType="fade"
      statusBarTranslucent={true}
    >
<SafeAreaProvider>
      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              setIsOpen(false);
            }}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalContainer}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Text style={styles.modalTitle}>🌸 MUNGA CLONE</Text>
                <Text style={styles.modalSubtitle}>Your Magical Bestie ✨</Text>
              </View>
              <View style={styles.modalHeaderRight}>
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={() => setShowApiModal(true)}
                >
                  <Icon name="settings-outline" size={20} color="#FF6B9D" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={clearHistory}
                >
                  <Icon name="trash-outline" size={20} color="#FF6B9D" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    setIsOpen(false);
                  }}
                >
                  <Icon name="close" size={24} color="#FF6B9D" />
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Icon name="sparkles" size={48} color="#FF6B9D" />
                  <Text style={styles.emptyTitle}>Hey bestie! 💕</Text>
                  <Text style={styles.emptyText}>
                    I'm MUNGA CLONE — your magical AI bestie! ✨
                    {'\n'}Set up your Gemini API key in settings and let's chat!
                  </Text>
                  {!apiKey && (
                    <TouchableOpacity
                      style={styles.emptyButton}
                      onPress={() => setShowApiModal(true)}
                    >
                      <Text style={styles.emptyButtonText}>🔑 Set API Key</Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
            />

            {messages.length > 0 && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.quickActionsContainer}
                contentContainerStyle={styles.quickActionsContent}
              >
                {QUICK_ACTIONS.map((action) => (
                  <TouchableOpacity
                    key={action.id}
                    style={styles.quickActionChip}
                    onPress={() => handleQuickAction(action.id)}
                  >
                    <Icon name={action.icon} size={16} color="#FF6B9D" />
                    <Text style={styles.quickActionText}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {isLoading && (
              <View style={styles.typingContainer}>
                <Text style={styles.typingText}>MUNGA is thinking</Text>
                <View style={styles.typingDots}>
                  <View style={[styles.dot, styles.dot1]} />
                  <View style={[styles.dot, styles.dot2]} />
                  <View style={[styles.dot, styles.dot3]} />
                </View>
              </View>
            )}

            <View style={styles.inputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder={apiKey ? "Tell me something, bestie..." : "🔑 Set API key first..."}
                placeholderTextColor="#999"
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={() => {
                  if (inputText.trim() && !isLoading && apiKey) {
                    sendMessage();
                  }
                }}
                blurOnSubmit={false}
                editable={!!apiKey}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!inputText.trim() || isLoading || !apiKey) && styles.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={!inputText.trim() || isLoading || !apiKey}
                activeOpacity={0.7}
              >
                <Icon name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
</SafeAreaProvider>  
 </Modal>
  );

  // ─── FLOATING BUTTON ───
  const FloatingButton = () => (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.floatingContainer,
        {
          transform: [
            { translateX: translateX },
            { translateY: Animated.add(translateY, floatAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -4],
            })) },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          if (!isDragging) {
            setIsOpen(true);
            if (!apiKey) {
              setTimeout(() => setShowApiModal(true), 500);
            }
          }
        }}
        style={styles.floatingButton}
        disabled={isDragging}
      >
        <View style={styles.pulseRing} />
        <View style={styles.botAvatar}>
          <Icon name="sparkles" size={22} color="#fff" />
        </View>
        {!apiKey && (
          <View style={styles.warningBadge}>
            <Text style={styles.warningText}>🔑</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  if (!isVisible) return null;

  return (
    <>
      <FloatingButton />
      <BotModal />
      <ApiModal />
    </>
  );
};

// ─── STYLES ───
const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    zIndex: 9999,
    elevation: 9999,
  },
  floatingButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FF6B9D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  pulseRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#FF6B9D',
    opacity: 0.25,
  },
  botAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B9D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFA500',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningText: {
    fontSize: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    backgroundColor: '#FFF5F7',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '85%',
    height: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE4E9',
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  modalHeaderLeft: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FF6B9D',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#999',
  },
  modalHeaderRight: {
    flexDirection: 'row',
    gap: 6,
  },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  userWrapper: {
    justifyContent: 'flex-end',
  },
  aiWrapper: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFE4E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '78%',
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#FF6B9D',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#FFE4E9',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  syncIndicator: {
    fontSize: 9,
    color: '#999',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FF6B9D',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#FF6B9D',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  quickActionsContainer: {
    maxHeight: 50,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  quickActionsContent: {
    gap: 8,
    paddingRight: 16,
  },
  quickActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFE4E9',
  },
  quickActionText: {
    fontSize: 12,
    color: '#FF6B9D',
    fontWeight: '500',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  typingText: {
    fontSize: 13,
    color: '#999',
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF6B9D',
  },
  dot1: { opacity: 0.3 },
  dot2: { opacity: 0.6 },
  dot3: { opacity: 1 },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#FFE4E9',
    paddingBottom: Platform.OS === 'ios' ? 12 : 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B9D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  apiModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  apiModalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  apiModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  apiModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  apiModalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 22,
  },
  apiLink: {
    color: '#FF6B9D',
    fontWeight: '600',
  },
  apiInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 16,
  },
  apiModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  apiButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
  },
  apiCancelButton: {
    backgroundColor: '#F5F5F5',
  },
  apiCancelText: {
    color: '#666',
    fontWeight: '600',
  },
  apiSaveButton: {
    backgroundColor: '#FF6B9D',
  },
  apiSaveText: {
    color: '#fff',
    fontWeight: '600',
  },
  apiStatus: {
    fontSize: 13,
    color: '#4CAF50',
    marginTop: 12,
    textAlign: 'center',
  },
  apiNote: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});
