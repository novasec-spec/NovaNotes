// screens/RemoteNotificationSender.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { NotificationService } from '../../services/notificationService';
import Icon from 'react-native-vector-icons/Ionicons';

export default function RemoteNotificationSender({ userId }: { userId: string }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const notificationService = NotificationService.getInstance(userId);

  const sendCustomNotification = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Error', 'Please enter both title and body');
      return;
    }

    setIsSending(true);
    const success = await notificationService.sendRemoteNotification(title, body);
    setIsSending(false);

    if (success) {
      Alert.alert('Success', 'Notification sent!');
      setTitle('');
      setBody('');
    } else {
      Alert.alert('Error', 'Failed to send notification');
    }
  };

  const sendQuickMessage = async (type: string) => {
    setIsSending(true);
    switch (type) {
      case 'love':
        await notificationService.sendInteractiveLoveMessage();
        break;
      case 'question':
        await notificationService.sendDailyQuestionNotification();
        break;
      case 'reminder':
        await notificationService.sendRemoteNotification('⏰ Reminder', 'Just checking in! Hope you\'re doing well 💕');
        break;
    }
    setIsSending(false);
    Alert.alert('Sent!', 'Quick message notification sent');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📡 Remote Notification Sender</Text>
      <Text style={styles.subtitle}>Send notifications to your girlfriend's phone</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., Thinking of You 💕"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Body</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={body}
          onChangeText={setBody}
          placeholder="Your message here..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={4}
        />
      </View>

      <TouchableOpacity style={styles.sendButton} onPress={sendCustomNotification} disabled={isSending}>
        <Icon name="send" size={20} color="#fff" />
        <Text style={styles.sendButtonText}>{isSending ? 'Sending...' : 'Send Custom Notification'}</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Quick Templates</Text>
      
      <TouchableOpacity style={styles.quickButton} onPress={() => sendQuickMessage('love')}>
        <Icon name="heart" size={24} color="#FF6B9D" />
        <Text style={styles.quickButtonText}>Send Interactive Love Message (with buttons)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.quickButton} onPress={() => sendQuickMessage('question')}>
        <Icon name="help-circle" size={24} color="#FF6B9D" />
        <Text style={styles.quickButtonText}>Send Daily Question (with options)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.quickButton} onPress={() => sendQuickMessage('reminder')}>
        <Icon name="notifications" size={24} color="#FF6B9D" />
        <Text style={styles.quickButtonText}>Send Check-in Reminder</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7', padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#FF6B9D', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 30 },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 15, fontSize: 16, borderWidth: 1, borderColor: '#FFE4E9' },
  textArea: { height: 100, textAlignVertical: 'top' },
  sendButton: { backgroundColor: '#FF6B9D', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 25, gap: 10, marginBottom: 30 },
  sendButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#FF6B9D', marginBottom: 15, marginTop: 10 },
  quickButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, gap: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, elevation: 2 },
  quickButtonText: { flex: 1, fontSize: 14, color: '#333' },
});
