// screens/RemoteNotificationSender.tsx
import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ScrollView, Alert, Switch, Platform 
} from 'react-native';
import { NotificationService, NotificationAction } from '../../services/notificationService';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';

type ActionButton = {
  id: string;
  title: string;
  type: 'reply' | 'mark-read' | 'snooze' | 'custom';
  icon?: string;
};

export default function RemoteNotificationSender({ userId }: { userId: string }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [useActionButtons, setUseActionButtons] = useState(false);
  const [scheduleLater, setScheduleLater] = useState(false);
  const [scheduleTime, setScheduleTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [customActions, setCustomActions] = useState<ActionButton[]>([
    { id: 'REPLY', title: '💬 Reply', type: 'reply' },
    { id: 'SNOOZE', title: '⏰ Remind later', type: 'snooze' },
    { id: 'LOVE', title: '❤️ Love it', type: 'custom' },
  ]);

  const notificationService = NotificationService.getInstance(userId);

  // Pre-defined action button templates
  const actionTemplates = {
    love: [
      { id: 'REPLY', title: '💬 Reply', type: 'reply' as const },
      { id: 'LOVE', title: '❤️ Love', type: 'custom' as const },
      { id: 'SNOOZE', title: '⏰ Later', type: 'snooze' as const },
    ],
    question: [
      { id: 'YES', title: '✅ Yes', type: 'custom' as const },
      { id: 'NO', title: '❌ No', type: 'custom' as const },
      { id: 'MAYBE', title: '🤔 Maybe', type: 'custom' as const },
    ],
    reminder: [
      { id: 'DONE', title: '✓ Done', type: 'custom' as const },
      { id: 'REMIND_1H', title: '⏰ In 1 hour', type: 'snooze' as const },
      { id: 'REMIND_TMRW', title: '📅 Tomorrow', type: 'snooze' as const },
    ],
    mood: [
      { id: 'HAPPY', title: '😊 Happy', type: 'custom' as const },
      { id: 'LOVED', title: '🥰 Loved', type: 'custom' as const },
      { id: 'SAD', title: '😢 Sad', type: 'custom' as const },
      { id: 'TIRED', title: '😴 Tired', type: 'custom' as const },
    ],
  };

  const sendCustomNotification = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Error', 'Please enter both title and body');
      return;
    }

    setIsSending(true);
    
    try {
      if (useActionButtons) {
        // Send with action buttons
        await notificationService.sendActionNotification(
          title,
          body,
          customActions,
          { type: 'custom', timestamp: Date.now() }
        );
      } else {
        // Send regular notification
        const success = await notificationService.sendRemoteNotification(title, body);
        if (!success) throw new Error('Failed to send');
      }
      
      Alert.alert('Success', 'Notification sent!');
      setTitle('');
      setBody('');
    } catch (error) {
      Alert.alert('Error', 'Failed to send notification');
    } finally {
      setIsSending(false);
    }
  };

  const sendScheduledNotification = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Error', 'Please enter both title and body');
      return;
    }

    setIsSending(true);
    
    try {
      // Calculate delay in seconds
      const now = new Date();
      const delaySeconds = Math.max(0, (scheduleTime.getTime() - now.getTime()) / 1000);
      
      if (delaySeconds > 0) {
        // Schedule for later
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: true,
            data: { type: 'scheduled' },
          },
          trigger: { seconds: delaySeconds, channelId: 'love_channel' },
        });
        Alert.alert('Scheduled', `Notification scheduled for ${scheduleTime.toLocaleTimeString()}`);
      } else {
        // Send immediately
        await sendCustomNotification();
      }
      
      setTitle('');
      setBody('');
      setScheduleLater(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to schedule notification');
    } finally {
      setIsSending(false);
    }
  };

  const applyActionTemplate = (template: keyof typeof actionTemplates) => {
    setCustomActions([...actionTemplates[template]]);
    Alert.alert('Template Applied', `Action buttons updated to ${template} template`);
  };

  const addCustomAction = () => {
    Alert.prompt(
      'Add Action Button',
      'Enter button title (e.g., "👍 Like")',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: (buttonTitle) => {
            if (buttonTitle) {
              setCustomActions([
                ...customActions,
                {
                  id: `CUSTOM_${Date.now()}`,
                  title: buttonTitle,
                  type: 'custom',
                },
              ]);
            }
          },
        },
      ]
    );
  };

  const removeAction = (id: string) => {
    setCustomActions(customActions.filter(a => a.id !== id));
  };

  // Quick Templates with rich content
  const quickTemplates = [
    {
      name: '💕 Love Message',
      icon: 'heart',
      color: '#FF6B9D',
      title: 'Thinking of You 💕',
      body: 'You crossed my mind and made me smile. Hope you\'re having a beautiful day!',
      actions: 'love',
    },
    {
      name: '🌅 Good Morning',
      icon: 'sunny',
      color: '#FFA500',
      title: 'Good Morning Sunshine! 🌅',
      body: 'Rise and shine, beautiful! Today is full of possibilities. I believe in you! 💪',
      actions: 'love',
    },
    {
      name: '🌙 Good Night',
      icon: 'moon',
      color: '#483D8B',
      title: 'Sweet Dreams 🌙',
      body: 'May your dreams be as sweet as you are. Can\'t wait to see you tomorrow. Good night, my love! 💤',
      actions: 'love',
    },
    {
      name: '❓ Daily Question',
      icon: 'help-circle',
      color: '#4CAF50',
      title: '💭 Quick Question',
      body: 'What\'s one thing that made you smile today?',
      actions: 'question',
    },
    {
      name: '📸 Memory Request',
      icon: 'camera',
      color: '#9C27B0',
      title: 'Share a Memory 📸',
      body: 'Take a photo of something beautiful today and save it to our memories album!',
      actions: 'reminder',
    },
    {
      name: '😊 Mood Check',
      icon: 'happy',
      color: '#FF9800',
      title: 'How are you feeling? 🌈',
      body: 'Take a moment to check in with yourself. Your feelings matter to me.',
      actions: 'mood',
    },
    {
      name: '🎵 Song Reminder',
      icon: 'musical-note',
      color: '#E91E63',
      title: '🎵 This song reminded me of you!',
      body: 'Listen to "Perfect" by Ed Sheeran - it\'s our song! Sending you virtual hugs 🤗',
      actions: 'love',
    },
    {
      name: '📝 Note Reminder',
      icon: 'document-text',
      color: '#607D8B',
      title: 'Don\'t forget! 📝',
      body: 'You had something important to do today. Just a gentle reminder that I believe in you!',
      actions: 'reminder',
    },
    {
      name: '🎉 Celebration',
      icon: 'gift',
      color: '#FF5722',
      title: 'Celebrate You! 🎉',
      body: 'Just wanted to remind you how amazing you are. You deserve all the happiness in the world!',
      actions: 'love',
    },
    {
      name: '💪 Encouragement',
      icon: 'fitness',
      color: '#2196F3',
      title: 'You\'ve Got This! 💪',
      body: 'Whatever you\'re facing right now, I know you can handle it. You\'re stronger than you think!',
      actions: 'love',
    },
    {
      name: '🍕 Lunch Reminder',
      icon: 'restaurant',
      color: '#FF9800',
      title: 'Time to Eat! 🍕',
      body: 'Don\'t skip lunch! Take a break and nourish your body. You deserve it!',
      actions: 'reminder',
    },
    {
      name: '💧 Hydration Reminder',
      icon: 'water',
      color: '#00BCD4',
      title: 'Drink Water! 💧',
      body: 'Stay hydrated, beautiful! Your body will thank you 💕',
      actions: 'reminder',
    },
  ];

  const loadTemplate = (template: typeof quickTemplates[0]) => {
    setTitle(template.title);
    setBody(template.body);
    if (template.actions && actionTemplates[template.actions as keyof typeof actionTemplates]) {
      setCustomActions([...actionTemplates[template.actions as keyof typeof actionTemplates]]);
      setUseActionButtons(true);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Icon name="notifications-circle" size={60} color="#FF6B9D" />
        <Text style={styles.title}>📡 Remote Notification Sender</Text>
        <Text style={styles.subtitle}>Send beautiful messages with action buttons</Text>
      </View>

      {/* Custom Message Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>✏️ Custom Message</Text>
        
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
          <Text style={styles.label}>Message</Text>
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

        {/* Action Buttons Toggle */}
        <View style={styles.switchRow}>
          <Text style={styles.label}>Add Action Buttons</Text>
          <Switch
            value={useActionButtons}
            onValueChange={setUseActionButtons}
            trackColor={{ false: '#ddd', true: '#FF6B9D' }}
            thumbColor="#fff"
          />
        </View>

        {/* Custom Actions Editor */}
        {useActionButtons && (
          <View style={styles.actionsContainer}>
            <Text style={styles.label}>Action Buttons:</Text>
            {customActions.map((action, index) => (
              <View key={action.id} style={styles.actionItem}>
                <Text style={styles.actionText}>{action.title}</Text>
                <TouchableOpacity onPress={() => removeAction(action.id)}>
                  <Icon name="close-circle" size={20} color="#FF6B9D" />
                </TouchableOpacity>
              </View>
            ))}
            
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity style={styles.addActionButton} onPress={addCustomAction}>
                <Icon name="add-circle" size={20} color="#FF6B9D" />
                <Text style={styles.addActionText}>Add Button</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.addActionButton, styles.templateButton]} 
                onPress={() => applyActionTemplate('love')}>
                <Icon name="heart" size={16} color="#FF6B9D" />
                <Text style={styles.addActionText}>Love Template</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Schedule Later Toggle */}
        <View style={styles.switchRow}>
          <Text style={styles.label}>Schedule for later</Text>
          <Switch
            value={scheduleLater}
            onValueChange={setScheduleLater}
            trackColor={{ false: '#ddd', true: '#FF6B9D' }}
            thumbColor="#fff"
          />
        </View>

        {scheduleLater && (
          <TouchableOpacity 
            style={styles.timePickerButton} 
            onPress={() => setShowTimePicker(true)}>
            <Icon name="time" size={20} color="#FF6B9D" />
            <Text style={styles.timePickerText}>
              {scheduleTime.toLocaleTimeString()}
            </Text>
          </TouchableOpacity>
        )}

        {showTimePicker && (
          <DateTimePicker
            value={scheduleTime}
            mode="time"
            is24Hour={false}
            onChange={(event, selectedDate) => {
              setShowTimePicker(false);
              if (selectedDate) setScheduleTime(selectedDate);
            }}
          />
        )}

        <TouchableOpacity 
          style={styles.sendButton} 
          onPress={scheduleLater ? sendScheduledNotification : sendCustomNotification} 
          disabled={isSending}>
          <Icon name={scheduleLater ? "calendar" : "send"} size={20} color="#fff" />
          <Text style={styles.sendButtonText}>
            {isSending ? 'Sending...' : (scheduleLater ? 'Schedule Notification' : 'Send Now')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick Templates Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Quick Templates</Text>
        <Text style={styles.sectionSubtitle}>Tap to load and customize</Text>
        
        <View style={styles.templatesGrid}>
          {quickTemplates.map((template, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.templateCard, { borderTopColor: template.color }]}
              onPress={() => loadTemplate(template)}>
              <Icon name={template.icon} size={28} color={template.color} />
              <Text style={styles.templateName}>{template.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Action Templates Quick Access */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎯 Action Button Presets</Text>
        <View style={styles.presetRow}>
          <TouchableOpacity style={styles.presetButton} onPress={() => applyActionTemplate('love')}>
            <Icon name="heart" size={16} color="#FF6B9D" />
            <Text style={styles.presetText}>Love</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetButton} onPress={() => applyActionTemplate('question')}>
            <Icon name="help-circle" size={16} color="#4CAF50" />
            <Text style={styles.presetText}>Question</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetButton} onPress={() => applyActionTemplate('reminder')}>
            <Icon name="alarm" size={16} color="#FF9800" />
            <Text style={styles.presetText}>Reminder</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetButton} onPress={() => applyActionTemplate('mood')}>
            <Icon name="happy" size={16} color="#9C27B0" />
            <Text style={styles.presetText}>Mood</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F7',
  },
  header: {
    alignItems: 'center',
    paddingTop: 30,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B9D',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 5,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 20,
    margin: 15,
    marginTop: 0,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF6B9D',
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#999',
    marginBottom: 15,
  },
  inputContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#FFE4E9',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingVertical: 5,
  },
  actionsContainer: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    color: '#333',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
  },
  addActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
    borderWidth: 1,
    borderColor: '#FF6B9D',
  },
  templateButton: {
    borderColor: '#4CAF50',
  },
  addActionText: {
    fontSize: 12,
    color: '#FF6B9D',
    fontWeight: '500',
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 12,
    gap: 10,
    marginBottom: 15,
  },
  timePickerText: {
    fontSize: 14,
    color: '#333',
  },
  sendButton: {
    backgroundColor: '#FF6B9D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 25,
    gap: 10,
    marginTop: 10,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  templateCard: {
    width: '48%',
    backgroundColor: '#F9F9F9',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    borderTopWidth: 3,
  },
  templateName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#555',
    textAlign: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  presetText: {
    fontSize: 13,
    color: '#666',
  },
});
