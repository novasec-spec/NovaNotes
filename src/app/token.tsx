// screens/TestNotificationScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { NotificationService } from '../services/notificationService';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_ID = 'Njeri';

// Customizable message templates
const MESSAGE_TEMPLATES = {
  love: [
    { title: "💕 Thinking of You", body: "You crossed my mind and made me smile. Hope you're having a beautiful day! Sending you virtual hugs 🤗" },
    { title: "💖 You're Amazing", body: "Just wanted to remind you how incredible you are. Never forget that! 💫" },
    { title: "💗 Miss You", body: "Missing you extra today. Can't wait to see you again! 💕" },
    { title: "💞 My Everything", body: "You mean the world to me. Thank you for being you! 🌎" },
  ],
  morning: [
    { title: "🌅 Good Morning Sunshine!", body: "Rise and shine, beautiful! Today is full of possibilities. Remember how amazing you are! 💪" },
    { title: "☀️ Wake Up Beautiful", body: "Another beautiful day because you're in it. Hope you slept well! 🌸" },
    { title: "🌤️ Morning Love", body: "Starting my day thinking of you. Hope yours is wonderful! 💕" },
  ],
  night: [
    { title: "🌙 Sweet Dreams", body: "May your dreams be as sweet as you are. Can't wait to see you tomorrow. Good night! 💤" },
    { title: "⭐ Starry Night", body: "The stars are out but none shine as bright as you. Sleep well, my love! ✨" },
    { title: "💭 Dream of Us", body: "Hope you dream of our beautiful moments together. Good night! 🌙" },
  ],
  question: [
    { title: "💭 Daily Question", body: "What made you smile today? I'd love to hear about it! 💕" },
    { title: "🤔 Quick Check", body: "How are you feeling right now? Take a moment to check in with yourself." },
    { title: "📝 Share Something", body: "Tell me one thing that happened today, good or bad. I'm here for you! 💬" },
  ],
  reminder: [
    { title: "⏰ Self Care", body: "Don't forget to take a break and do something nice for yourself today. You deserve it! ✨" },
    { title: "💧 Hydration Check", body: "Drink some water! Your body will thank you 💕" },
    { title: "🍎 Eat Something", body: "Have you eaten? Take a moment to nourish yourself! 🥗" },
  ],
  encouragement: [
    { title: "💪 You've Got This!", body: "Whatever you're facing right now, I believe in you. You're stronger than you think! 🦁" },
    { title: "🌟 Keep Going", body: "You're doing amazing things. Don't stop now! 🚀" },
    { title: "🌸 You Matter", body: "Just a reminder that you are loved, valued, and appreciated. Always! 💕" },
  ],
};

// Action button presets
const ACTION_PRESETS = {
  love_actions: [
    { id: 'REPLY', title: '💬 Reply', type: 'reply' },
    { id: 'LOVE', title: '❤️ Love It', type: 'custom' },
    { id: 'SNOOZE', title: '⏰ Later', type: 'snooze' },
  ],
  question_actions: [
    { id: 'HAPPY', title: '😊 Happy', type: 'custom' },
    { id: 'LOVED', title: '🥰 Loved', type: 'custom' },
    { id: 'SAD', title: '😢 Sad', type: 'custom' },
    { id: 'ENERGETIC', title: '⚡ Energetic', type: 'custom' },
  ],
  reminder_actions: [
    { id: 'DONE', title: '✅ Done', type: 'custom' },
    { id: 'REMIND_1H', title: '⏰ 1 Hour', type: 'snooze' },
    { id: 'REMIND_TMRW', title: '📅 Tomorrow', type: 'snooze' },
  ],
};

export default function TestNotificationScreen() {
  const notificationService = NotificationService.getInstance(USER_ID);
  
  // Remote token state
  const [remoteToken, setRemoteToken] = useState('');
  const [useRemoteToken, setUseRemoteToken] = useState(false);
  const [savedToken, setSavedToken] = useState('');
  
  // Custom message state
  const [customTitle, setCustomTitle] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof ACTION_PRESETS>('love_actions');
  const [scheduleSeconds, setScheduleSeconds] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);
  
  // Load saved token on mount
  useEffect(() => {
    loadSavedToken();
  }, []);
  
  const loadSavedToken = async () => {
    const token = await AsyncStorage.getItem('targetDeviceToken');
    if (token) {
      setSavedToken(token);
      setRemoteToken(token);
    }
  };
  
  const saveToken = async () => {
    if (remoteToken.trim()) {
      await AsyncStorage.setItem('targetDeviceToken', remoteToken.trim());
      setSavedToken(remoteToken.trim());
      Alert.alert('✅ Token Saved', 'Target device token has been saved!');
    } else {
      Alert.alert('⚠️ Empty', 'Please enter a valid Expo token');
    }
  };
  
  // Send notification to target device
  const sendToRemoteDevice = async (title: string, body: string, category: keyof typeof ACTION_PRESETS) => {
    if (!remoteToken.trim()) {
      Alert.alert('❌ No Token', 'Please enter a target device token first!');
      return false;
    }
    
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: remoteToken.trim(),
          title: title,
          body: body,
          sound: 'default',
          badge: 1,
          categoryIdentifier: category,
          _category: category,
          data: { type: 'remote', from: USER_ID },
        }),
      });
      
      const result = await response.json();
      if (result.data?.status === 'ok') {
        Alert.alert('✅ Sent!', 'Notification sent to remote device!');
        return true;
      } else {
        Alert.alert('❌ Failed', result.errors?.[0]?.message || 'Unknown error');
        return false;
      }
    } catch (error) {
      Alert.alert('❌ Error', error.message);
      return false;
    }
  };
  
  // Send local notification
  const sendLocal = async (title: string, body: string, category: keyof typeof ACTION_PRESETS) => {
    await notificationService.sendActionNotification(title, body, category as any);
  };
  
  // Main send function (chooses local vs remote)
  const sendNotification = async (title: string, body: string, category: keyof typeof ACTION_PRESETS) => {
    if (useRemoteToken && remoteToken.trim()) {
      await sendToRemoteDevice(title, body, category);
    } else if (useRemoteToken && !remoteToken.trim()) {
      Alert.alert('⚠️ No Token', 'Please enter a remote token or disable remote mode');
    } else {
      await sendLocal(title, body, category);
    }
  };
  
  // Send custom message
  const sendCustomMessage = async () => {
    if (!customTitle.trim() || !customBody.trim()) {
      Alert.alert('⚠️ Incomplete', 'Please enter both title and message');
      return;
    }
    
    if (useRemoteToken && !remoteToken.trim()) {
      Alert.alert('⚠️ No Token', 'Please enter a remote token');
      return;
    }
    
    await sendNotification(customTitle, customBody, selectedCategory);
    setShowCustomModal(false);
    setCustomTitle('');
    setCustomBody('');
  };
  
  // Schedule a notification
  const scheduleNotification = async () => {
    const seconds = parseInt(scheduleSeconds);
    if (isNaN(seconds) || seconds < 1) {
      Alert.alert('⚠️ Invalid', 'Please enter valid seconds (1-86400)');
      return;
    }
    
    if (useRemoteToken && remoteToken.trim()) {
      // For remote scheduling, we need to use setTimeout
      Alert.alert('📅 Scheduled', `Will send in ${seconds} seconds`);
      setTimeout(async () => {
        await sendToRemoteDevice('⏰ Scheduled Message', `This message was scheduled ${seconds} seconds ago!`, selectedCategory);
      }, seconds * 1000);
    } else {
      await notificationService.scheduleNotification(
        '⏰ Scheduled Message',
        `This message was scheduled ${seconds} seconds ago!`,
        seconds,
        selectedCategory as any
      );
      Alert.alert('📅 Scheduled', `Local notification scheduled in ${seconds} seconds`);
    }
    setScheduleSeconds('');
  };
  
  // Random message from template
  const getRandomFromTemplate = (template: typeof MESSAGE_TEMPLATES.love) => {
    return template[Math.floor(Math.random() * template.length)];
  };
  
  // Send random love message
  const sendRandomLove = async () => {
    const random = getRandomFromTemplate(MESSAGE_TEMPLATES.love);
    await sendNotification(random.title, random.body, 'love_actions');
  };
  
  // Send random morning message
  const sendRandomMorning = async () => {
    const random = getRandomFromTemplate(MESSAGE_TEMPLATES.morning);
    await sendNotification(random.title, random.body, 'love_actions');
  };
  
  // Send random night message
  const sendRandomNight = async () => {
    const random = getRandomFromTemplate(MESSAGE_TEMPLATES.night);
    await sendNotification(random.title, random.body, 'love_actions');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🧪 Notification Center</Text>
      <Text style={styles.subtitle}>Send love messages with action buttons</Text>
      
      {/* Remote Token Section */}
      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Text style={styles.sectionTitle}>📡 Remote Mode</Text>
          <Switch
            value={useRemoteToken}
            onValueChange={setUseRemoteToken}
            trackColor={{ false: '#ddd', true: '#FF6B9D' }}
            thumbColor="#fff"
          />
        </View>
        
        {useRemoteToken && (
          <View style={styles.tokenContainer}>
            <Text style={styles.label}>Target Device Expo Token:</Text>
            <TextInput
              style={styles.tokenInput}
              value={remoteToken}
              onChangeText={setRemoteToken}
              placeholder="ExponentPushToken[...]"
              placeholderTextColor="#999"
              multiline
            />
            <TouchableOpacity style={styles.saveTokenButton} onPress={saveToken}>
              <Text style={styles.saveTokenText}>💾 Save Token</Text>
            </TouchableOpacity>
            {savedToken ? (
              <Text style={styles.savedHint}>Saved: {savedToken.substring(0, 30)}...</Text>
            ) : null}
          </View>
        )}
      </View>
      
      {/* Quick Send Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚡ Quick Send</Text>
        
        <TouchableOpacity style={[styles.button, { backgroundColor: '#FF6B9D' }]} onPress={sendRandomLove}>
          <Icon name="heart" size={20} color="#fff" />
          <Text style={styles.buttonText}>💕 Random Love Message</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, { backgroundColor: '#FFA500' }]} onPress={sendRandomMorning}>
          <Icon name="sunny" size={20} color="#fff" />
          <Text style={styles.buttonText}>🌅 Random Good Morning</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, { backgroundColor: '#483D8B' }]} onPress={sendRandomNight}>
          <Icon name="moon" size={20} color="#fff" />
          <Text style={styles.buttonText}>🌙 Random Good Night</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, { backgroundColor: '#4CAF50' }]} onPress={() => sendNotification('💭 Daily Question', 'What made you smile today? I\'d love to hear about it! 💕', 'question_actions')}>
          <Icon name="help-circle" size={20} color="#fff" />
          <Text style={styles.buttonText}>❓ Daily Question</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, { backgroundColor: '#FF9800' }]} onPress={() => sendNotification('⏰ Gentle Reminder', 'Don\'t forget to take a break and do something nice for yourself today. You deserve it! ✨', 'reminder_actions')}>
          <Icon name="alarm" size={20} color="#fff" />
          <Text style={styles.buttonText}>⏰ Reminder</Text>
        </TouchableOpacity>
      </View>
      
      {/* Custom Message Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>✏️ Custom Message</Text>
        
        <TouchableOpacity style={[styles.button, { backgroundColor: '#9C27B0' }]} onPress={() => setShowCustomModal(true)}>
          <Icon name="create" size={20} color="#fff" />
          <Text style={styles.buttonText}>📝 Write Custom Message</Text>
        </TouchableOpacity>
        
        <View style={styles.categoryRow}>
          <Text style={styles.label}>Action Buttons:</Text>
          <View style={styles.categoryButtons}>
            <TouchableOpacity 
              style={[styles.categoryChip, selectedCategory === 'love_actions' && styles.categoryChipActive]}
              onPress={() => setSelectedCategory('love_actions')}>
              <Text style={[styles.categoryText, selectedCategory === 'love_actions' && styles.categoryTextActive]}>💕 Love</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.categoryChip, selectedCategory === 'question_actions' && styles.categoryChipActive]}
              onPress={() => setSelectedCategory('question_actions')}>
              <Text style={[styles.categoryText, selectedCategory === 'question_actions' && styles.categoryTextActive]}>❓ Question</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.categoryChip, selectedCategory === 'reminder_actions' && styles.categoryChipActive]}
              onPress={() => setSelectedCategory('reminder_actions')}>
              <Text style={[styles.categoryText, selectedCategory === 'reminder_actions' && styles.categoryTextActive]}>⏰ Reminder</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.scheduleRow}>
          <TextInput
            style={styles.scheduleInput}
            placeholder="Schedule (seconds)"
            value={scheduleSeconds}
            onChangeText={setScheduleSeconds}
            keyboardType="numeric"
            placeholderTextColor="#999"
          />
          <TouchableOpacity style={styles.scheduleButton} onPress={scheduleNotification}>
            <Text style={styles.scheduleButtonText}>📅 Schedule</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Message Templates Preview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Message Templates</Text>
        
        <Text style={styles.templateLabel}>💕 Love Messages:</Text>
        {MESSAGE_TEMPLATES.love.slice(0, 2).map((msg, i) => (
          <TouchableOpacity key={i} style={styles.templatePreview} onPress={() => sendNotification(msg.title, msg.body, 'love_actions')}>
            <Text style={styles.templateTitle}>{msg.title}</Text>
            <Text style={styles.templateBody} numberOfLines={2}>{msg.body}</Text>
          </TouchableOpacity>
        ))}
        
        <Text style={styles.templateLabel}>🌅 Morning Messages:</Text>
        {MESSAGE_TEMPLATES.morning.slice(0, 2).map((msg, i) => (
          <TouchableOpacity key={i} style={styles.templatePreview} onPress={() => sendNotification(msg.title, msg.body, 'love_actions')}>
            <Text style={styles.templateTitle}>{msg.title}</Text>
            <Text style={styles.templateBody} numberOfLines={2}>{msg.body}</Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Cancel All Button */}
      <TouchableOpacity style={[styles.button, { backgroundColor: '#F44336', marginBottom: 30 }]} onPress={() => notificationService.cancelAllNotifications()}>
        <Icon name="trash" size={20} color="#fff" />
        <Text style={styles.buttonText}>🗑️ Cancel All Local Notifications</Text>
      </TouchableOpacity>
      
      {/* Info Note */}
      <View style={styles.note}>
        <Icon name="information-circle" size={20} color="#FF6B9D" />
        <Text style={styles.noteText}>
          {useRemoteToken 
            ? "📡 Remote Mode ON: Notifications will be sent to the token you entered.\n\n"
            : "📱 Local Mode: Notifications will appear on THIS device.\n\n"}
          Action buttons appear below notifications on Android.{'\n'}
          On iOS, long-press or 3D touch the notification.
        </Text>
      </View>
      
      {/* Custom Message Modal */}
      <Modal visible={showCustomModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✏️ Custom Message</Text>
            
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.modalInput}
              value={customTitle}
              onChangeText={setCustomTitle}
              placeholder="e.g., Thinking of You 💕"
              placeholderTextColor="#999"
            />
            
            <Text style={styles.label}>Message</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              value={customBody}
              onChangeText={setCustomBody}
              placeholder="Your message here..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />
            
            <Text style={styles.label}>Action Buttons: {selectedCategory === 'love_actions' ? '💕 Love' : selectedCategory === 'question_actions' ? '❓ Question' : '⏰ Reminder'}</Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCustomModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSend} onPress={sendCustomMessage}>
                <Text style={styles.modalSendText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F7',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF6B9D',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF6B9D',
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tokenContainer: {
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 8,
  },
  tokenInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    borderWidth: 1,
    borderColor: '#FFE4E9',
    marginBottom: 10,
  },
  saveTokenButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveTokenText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  savedHint: {
    fontSize: 10,
    color: '#888',
    marginTop: 5,
  },
  button: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 25,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  categoryRow: {
    marginTop: 10,
  },
  categoryButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  categoryChipActive: {
    backgroundColor: '#FF6B9D',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
  },
  categoryTextActive: {
    color: '#fff',
  },
  scheduleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  scheduleInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#FFE4E9',
  },
  scheduleButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    justifyContent: 'center',
  },
  scheduleButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  templateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B9D',
    marginTop: 12,
    marginBottom: 8,
  },
  templatePreview: {
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B9D',
  },
  templateTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  templateBody: {
    fontSize: 12,
    color: '#666',
  },
  note: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 15,
    marginBottom: 30,
    gap: 10,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: '#E65100',
    lineHeight: 18,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '90%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF6B9D',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#FFE4E9',
    marginBottom: 15,
  },
  modalTextArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  modalCancel: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    padding: 14,
    borderRadius: 25,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#666',
    fontWeight: '600',
  },
  modalSend: {
    flex: 1,
    backgroundColor: '#FF6B9D',
    padding: 14,
    borderRadius: 25,
    alignItems: 'center',
  },
  modalSendText: {
    color: '#fff',
    fontWeight: '600',
  },
});
