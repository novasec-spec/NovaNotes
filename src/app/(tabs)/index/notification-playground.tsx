// src/screens/notification/NotificationPlayground.tsx

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
  Pressable,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNotification } from '../../../contexts/NotificationContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotificationBadge } from '../../../hooks/notification/useNotificationBadge';
import { NotificationType, NotificationCategory } from '../../../types/notifications';

const { width } = Dimensions.get('window');

// ─── TYPES ─────────────────────────────────────────────

type FieldType = 'text' | 'textarea' | 'select' | 'switch' | 'json' | 'datetime';

interface FormField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: Array<{ label: string; value: any }>;
  defaultValue?: any;
  required?: boolean;
  section?: string;
}

// ─── FORM CONFIGURATION ──────────────────────────────

const FORM_FIELDS: FormField[] = [
  // Basic Info
  { key: 'title', label: 'Title', type: 'text', placeholder: 'Notification title...', required: true, section: 'Basic Info' },
  { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Notification body...', required: true, section: 'Basic Info' },
  
  // Types
  { 
    key: 'type', 
    label: 'Type', 
    type: 'select', 
    options: [
      { label: 'System', value: 'system' },
      { label: 'Chat', value: 'chat' },
      { label: 'Task', value: 'task' },
      { label: 'Reminder', value: 'reminder' },
      { label: 'Progress', value: 'progress' },
      { label: 'Alert', value: 'alert' },
    ],
    defaultValue: 'system',
    section: 'Notification Settings',
  },
  {
    key: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { label: 'System', value: 'system' },
      { label: 'Message', value: 'message' },
      { label: 'Task', value: 'task' },
      { label: 'Reminder', value: 'reminder' },
      { label: 'Social', value: 'social' },
    ],
    defaultValue: 'system',
    section: 'Notification Settings',
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'select',
    options: [
      { label: 'Low', value: 'low' },
      { label: 'Normal', value: 'normal' },
      { label: 'High', value: 'high' },
    ],
    defaultValue: 'normal',
    section: 'Notification Settings',
  },

  // Navigation
  {
    key: 'screen',
    label: 'Navigate to Screen',
    type: 'select',
    options: [
      { label: 'None', value: '' },
      { label: 'Home', value: 'home' },
      { label: 'Chat', value: 'chat' },
      { label: 'Tasks', value: 'tasks' },
      { label: 'Notifications', value: 'notifications' },
      { label: 'Profile', value: 'profile' },
      { label: 'Settings', value: 'settings' },
      { label: 'Mood Music', value: 'moodmusic' },
    ],
    defaultValue: '',
    section: 'Navigation',
  },
  { key: 'params', label: 'Navigation Params (JSON)', type: 'json', placeholder: '{"userId": "123"}', section: 'Navigation' },

  // Options
  { key: 'showLocal', label: 'Show Local Notification', type: 'switch', defaultValue: true, section: 'Options' },
  { key: 'schedule', label: 'Schedule for Later', type: 'switch', defaultValue: false, section: 'Options' },
  { key: 'expires', label: 'Expires After', type: 'switch', defaultValue: false, section: 'Options' },
  { key: 'expiresHours', label: 'Expires In (hours)', type: 'text', placeholder: '24', defaultValue: '24', section: 'Options' },

  // Extra Data
  { key: 'extraData', label: 'Extra Data (JSON)', type: 'json', placeholder: '{"image": "url", "badge": 5}', section: 'Extra Data' },
];

// ─── TEMPLATES ─────────────────────────────────────────

const TEMPLATES = [
  {
    id: 'welcome',
    name: '👋 Welcome',
    description: 'Welcome message for new users',
    data: {
      title: 'Welcome to the App! 🎉',
      body: 'We\'re excited to have you here. Let\'s get started!',
      type: 'system',
      category: 'system',
      priority: 'normal',
      screen: 'home',
      showLocal: true,
    },
  },
  {
    id: 'chat',
    name: '💬 New Chat Message',
    description: 'New message from a user',
    data: {
      title: 'New Message from Alice 💬',
      body: 'Hey! How are you doing today?',
      type: 'chat',
      category: 'message',
      priority: 'high',
      screen: 'chat',
      params: '{"userId": "alice123", "messageId": "msg_001"}',
      showLocal: true,
    },
  },
  {
    id: 'task',
    name: '✅ Task Reminder',
    description: 'Task due notification',
    data: {
      title: 'Task Due: Review Designs ✅',
      body: 'Complete the design review by 5pm today',
      type: 'task',
      category: 'task',
      priority: 'high',
      screen: 'tasks',
      params: '{"taskId": "task_789"}',
      showLocal: true,
    },
  },
  {
    id: 'reminder',
    name: '⏰ Reminder',
    description: 'General reminder notification',
    data: {
      title: 'Time to Take Your Medication 💊',
      body: 'Don\'t forget to take your daily medication',
      type: 'reminder',
      category: 'reminder',
      priority: 'normal',
      screen: 'moodmusic',
      showLocal: true,
    },
  },
  {
    id: 'progress',
    name: '📊 Progress Update',
    description: 'Progress notification with percentage',
    data: {
      title: 'Upload Progress 📊',
      body: 'Your file is being uploaded',
      type: 'progress',
      category: 'system',
      priority: 'normal',
      screen: '',
      extraData: '{"progress": 50, "total": 100}',
      showLocal: true,
    },
  },
  {
    id: 'alert',
    name: '⚠️ Urgent Alert',
    description: 'Urgent system alert',
    data: {
      title: '⚠️ Session Expiring Soon',
      body: 'Your session will expire in 5 minutes',
      type: 'alert',
      category: 'system',
      priority: 'high',
      screen: 'settings',
      showLocal: true,
    },
  },
  {
    id: 'social',
    name: '👥 Social Update',
    description: 'Social notification',
    data: {
      title: 'New Follower 👥',
      body: 'Sarah started following you',
      type: 'chat',
      category: 'social',
      priority: 'normal',
      screen: 'profile',
      params: '{"userId": "sarah456"}',
      showLocal: true,
    },
  },
  {
    id: 'scheduled',
    name: '📅 Scheduled',
    description: 'Scheduled notification',
    data: {
      title: 'Meeting Reminder 📅',
      body: 'Team meeting in 30 minutes',
      type: 'reminder',
      category: 'reminder',
      priority: 'high',
      screen: 'calendar',
      showLocal: true,
      schedule: true,
    },
  },
];

// ─── ACTION PRESETS ────────────────────────────────────

const ACTION_PRESETS = [
  {
    id: 'message_actions',
    label: '💬 Message Actions',
    description: 'Reply, Mark Read, Dismiss',
    color: '#10B981',
    category: 'message',
  },
  {
    id: 'task_actions',
    label: '✅ Task Actions',
    description: 'Complete, Snooze',
    color: '#8B5CF6',
    category: 'task',
  },
  {
    id: 'reminder_actions',
    label: '⏰ Reminder Actions',
    description: 'Done, Later',
    color: '#F59E0B',
    category: 'reminder',
  },
];

// ─── MAIN COMPONENT ────────────────────────────────────

export default function NotificationPlayground() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { 
    sendNotification,
    sendMessageWithActions,
    sendTaskWithActions,
    sendReminderWithActions,
    sendScheduled,
  } = useNotification();
  const { refresh: refreshBadge } = useNotificationBadge();

  // ─── STATE ─────────────────────────────────────────

  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    FORM_FIELDS.forEach(field => {
      initial[field.key] = field.defaultValue || '';
    });
    initial.userId = user?.id || '';
    return initial;
  });

  const [loading, setLoading] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [recentlySent, setRecentlySent] = useState<Array<{ title: string; time: string; success: boolean; id: string }>>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Basic Info', 'Navigation']));
  const [activeTab, setActiveTab] = useState<'form' | 'templates' | 'history'>('form');

  // ─── FORM HANDLERS ─────────────────────────────────

  const updateField = useCallback((key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  const getFieldValue = useCallback((key: string) => {
    return formData[key] ?? '';
  }, [formData]);

  // ─── SEND NOTIFICATION ─────────────────────────────

  const sendNow = useCallback(async () => {
    // Validate
    if (!formData.title?.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    if (!formData.body?.trim()) {
      Alert.alert('Error', 'Please enter a body');
      return;
    }

    setLoading(true);

    try {
      // Build data object
      const data: Record<string, any> = {};
      
      // Add screen
      if (formData.screen) {
        data.screen = formData.screen;
      }

      // Add params
      if (formData.params) {
        try {
          data.params = JSON.parse(formData.params);
        } catch {
          // Invalid JSON, ignore
        }
      }

      // Add extra data
      if (formData.extraData) {
        try {
          const extra = JSON.parse(formData.extraData);
          Object.assign(data, extra);
        } catch {
          // Invalid JSON, ignore
        }
      }

      // Build notification params
      const params = {
        userId: user?.id || '',
        title: formData.title.trim(),
        body: formData.body.trim(),
        type: formData.type as NotificationType,
        data,
        showLocal: formData.showLocal !== false,
        categoryId: formData.category as NotificationCategory,
        priority: formData.priority as 'low' | 'normal' | 'high',
      };

      // Check if scheduled
      let result;
      if (formData.schedule) {
        result = await sendScheduled({
          ...params,
          scheduledFor: scheduledDate,
        } as any);
      } else {
        result = await sendNotification(params);
      }

      if (result) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        setRecentlySent(prev => [
          { title: formData.title, time: timeStr, success: true, id: result.id },
          ...prev.slice(0, 9),
        ]);

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          '✅ Notification Sent!',
          `"${formData.title}" sent successfully${formData.schedule ? ` (scheduled for ${scheduledDate.toLocaleString()})` : ''}`,
          [{ text: 'OK' }]
        );
        refreshBadge();
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      const now = new Date();
      const timeStr = now.toLocaleTimeString();
      setRecentlySent(prev => [
        { title: formData.title, time: timeStr, success: false, id: Date.now().toString() },
        ...prev.slice(0, 9),
      ]);
      Alert.alert('❌ Error', 'Failed to send notification');
    } finally {
      setLoading(false);
    }
  }, [formData, user?.id, sendNotification, sendScheduled, scheduledDate, refreshBadge]);

  // ─── SEND WITH ACTIONS ─────────────────────────────

  const sendWithActions = useCallback(async (category: 'message' | 'task' | 'reminder') => {
    if (!formData.title?.trim() || !formData.body?.trim()) {
      Alert.alert('Error', 'Please enter title and body');
      return;
    }

    setLoading(true);

    try {
      const data: Record<string, any> = {};
      if (formData.screen) data.screen = formData.screen;
      if (formData.params) {
        try {
          data.params = JSON.parse(formData.params);
        } catch {}
      }
      if (formData.extraData) {
        try {
          const extra = JSON.parse(formData.extraData);
          Object.assign(data, extra);
        } catch {}
      }

      let result;
      switch (category) {
        case 'message':
          result = await sendMessageWithActions(formData.title, formData.body, data);
          break;
        case 'task':
          result = await sendTaskWithActions(formData.title, formData.body, data);
          break;
        case 'reminder':
          result = await sendReminderWithActions(formData.title, formData.body, data);
          break;
      }

      if (result) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        setRecentlySent(prev => [
          { title: `${category}: ${formData.title}`, time: timeStr, success: true, id: result.id },
          ...prev.slice(0, 9),
        ]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('✅ Sent with Actions!', `"${formData.title}" sent with ${category} actions`);
        refreshBadge();
      }
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to send notification');
    } finally {
      setLoading(false);
    }
  }, [formData, sendMessageWithActions, sendTaskWithActions, sendReminderWithActions, refreshBadge]);

  // ─── LOAD TEMPLATE ─────────────────────────────────

  const loadTemplate = useCallback((template: typeof TEMPLATES[0]) => {
    const data = template.data;
    const newFormData: Record<string, any> = {};
    
    FORM_FIELDS.forEach(field => {
      const value = data[field.key];
      if (value !== undefined) {
        newFormData[field.key] = value;
      } else {
        newFormData[field.key] = field.defaultValue || '';
      }
    });
    
    newFormData.userId = user?.id || '';
    setFormData(newFormData);
    setShowTemplateModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Expand all sections
    const allSections = new Set(FORM_FIELDS.map(f => f.section).filter(Boolean) as string[]);
    setExpandedSections(allSections);
  }, [user?.id]);

  // ─── RENDER FIELD ──────────────────────────────────

  const renderField = (field: FormField) => {
    const value = getFieldValue(field.key);

    switch (field.type) {
      case 'text':
        return (
          <TextInput
            style={styles.input}
            placeholder={field.placeholder}
            placeholderTextColor="#9CA3AF"
            value={value}
            onChangeText={(text) => updateField(field.key, text)}
          />
        );

      case 'textarea':
        return (
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={field.placeholder}
            placeholderTextColor="#9CA3AF"
            value={value}
            onChangeText={(text) => updateField(field.key, text)}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        );

      case 'select':
        return (
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => {
              const options = field.options || [];
              Alert.alert(
                field.label,
                '',
                options.map(opt => ({
                  text: opt.label,
                  onPress: () => updateField(field.key, opt.value),
                })),
                { cancelable: true }
              );
            }}
          >
            <Text style={styles.selectText}>
              {field.options?.find(o => o.value === value)?.label || 'Select...'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#6B7280" />
          </TouchableOpacity>
        );

      case 'switch':
        return (
          <Switch
            value={!!value}
            onValueChange={(val) => updateField(field.key, val)}
            trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
            thumbColor="#fff"
          />
        );

      case 'json':
        return (
          <TextInput
            style={[styles.input, styles.jsonInput]}
            placeholder={field.placeholder}
            placeholderTextColor="#9CA3AF"
            value={value}
            onChangeText={(text) => updateField(field.key, text)}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            autoCapitalize="none"
          />
        );

      default:
        return null;
    }
  };

  // ─── RENDER SECTION ────────────────────────────────

  const renderSection = (sectionName: string) => {
    const fields = FORM_FIELDS.filter(f => f.section === sectionName);
    if (fields.length === 0) return null;

    const isExpanded = expandedSections.has(sectionName);

    return (
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => {
            const newSet = new Set(expandedSections);
            if (isExpanded) {
              newSet.delete(sectionName);
            } else {
              newSet.add(sectionName);
            }
            setExpandedSections(newSet);
          }}
        >
          <Text style={styles.sectionTitle}>{sectionName}</Text>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.sectionContent}>
            {fields.map((field) => (
              <View key={field.key} style={styles.field}>
                <View style={styles.fieldLabel}>
                  <Text style={styles.label}>
                    {field.label}
                    {field.required && <Text style={styles.required}> *</Text>}
                  </Text>
                </View>
                {renderField(field)}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // ─── RENDER ACTION BUTTONS ─────────────────────────

  const renderActionButtons = () => (
    <View style={styles.actionsContainer}>
      <Text style={styles.actionsTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        {ACTION_PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset.id}
            style={[styles.actionCard, { borderColor: preset.color }]}
            onPress={() => sendWithActions(preset.category as any)}
            disabled={loading}
          >
            <View style={[styles.actionIcon, { backgroundColor: preset.color + '15' }]}>
              <Text style={[styles.actionEmoji, { color: preset.color }]}>
                {preset.label.split(' ')[0]}
              </Text>
            </View>
            <Text style={styles.actionLabel}>{preset.label}</Text>
            <Text style={styles.actionDescription}>{preset.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ─── RENDER TEMPLATES MODAL ────────────────────────

  const renderTemplateModal = () => (
    <Modal
      visible={showTemplateModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowTemplateModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📋 Templates</Text>
            <TouchableOpacity onPress={() => setShowTemplateModal(false)}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={TEMPLATES}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.templateItem}
                onPress={() => loadTemplate(item)}
              >
                <View style={styles.templateContent}>
                  <Text style={styles.templateName}>{item.name}</Text>
                  <Text style={styles.templateDescription}>{item.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.templateList}
          />
        </View>
      </View>
    </Modal>
  );

  // ─── RENDER DATE PICKER ────────────────────────────

  const renderDateTimePicker = () => {
    if (!showDateTimePicker) return null;

    return (
      <Modal
        visible={showDateTimePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateTimePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowDateTimePicker(false)}>
          <View style={styles.datePickerContainer}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>Schedule for</Text>
              <TouchableOpacity onPress={() => setShowDateTimePicker(false)}>
                <Text style={styles.datePickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={scheduledDate}
              mode="datetime"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                if (date) {
                  setScheduledDate(date);
                }
                if (Platform.OS === 'android') {
                  setShowDateTimePicker(false);
                }
              }}
              minimumDate={new Date()}
            />
          </View>
        </Pressable>
      </Modal>
    );
  };

  // ─── RENDER HISTORY ─────────────────────────────────

  const renderHistory = () => (
    <View style={styles.historyContainer}>
      <Text style={styles.historyTitle}>📤 Recent History</Text>
      {recentlySent.length === 0 ? (
        <View style={styles.emptyHistory}>
          <Ionicons name="time-outline" size={32} color="#D1D5DB" />
          <Text style={styles.emptyHistoryText}>No notifications sent yet</Text>
        </View>
      ) : (
        recentlySent.map((item, index) => (
          <View key={index} style={styles.historyItem}>
            <Ionicons
              name={item.success ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={item.success ? '#10B981' : '#EF4444'}
            />
            <Text style={styles.historyText} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.historyTime}>{item.time}</Text>
          </View>
        ))
      )}
    </View>
  );

  // ─── RENDER ─────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : insets.top + 60}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Playground</Text>
        <TouchableOpacity
          style={styles.templateButton}
          onPress={() => setShowTemplateModal(true)}
        >
          <Ionicons name="albums-outline" size={22} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['form', 'templates', 'history'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'form' && (
          <>
            {/* User ID */}
            <View style={styles.userField}>
              <Text style={styles.label}>User ID</Text>
              <TextInput
                style={[styles.input, styles.userInput]}
                value={formData.userId}
                onChangeText={(text) => updateField('userId', text)}
                placeholder="Enter user ID..."
                placeholderTextColor="#9CA3AF"
              />
              {formData.userId === user?.id && (
                <Text style={styles.hintText}>📌 Sending to yourself (testing)</Text>
              )}
            </View>

            {/* Sections */}
            {['Basic Info', 'Notification Settings', 'Navigation', 'Options', 'Extra Data'].map(
              (section) => renderSection(section)
            )}

            {/* Schedule picker */}
            {formData.schedule && (
              <TouchableOpacity
                style={styles.scheduleButton}
                onPress={() => setShowDateTimePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#3B82F6" />
                <Text style={styles.scheduleButtonText}>
                  {scheduledDate.toLocaleString()}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#3B82F6" />
              </TouchableOpacity>
            )}

            {/* Send Button */}
            <TouchableOpacity
              style={[styles.sendButton, loading && styles.sendButtonDisabled]}
              onPress={sendNow}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send-outline" size={20} color="#fff" />
                  <Text style={styles.sendButtonText}>
                    {formData.schedule ? '📅 Schedule' : '🚀 Send Now'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Action Buttons */}
            {renderActionButtons()}
          </>
        )}

        {activeTab === 'templates' && (
          <View style={styles.templatesGrid}>
            {TEMPLATES.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={styles.templateCard}
                onPress={() => loadTemplate(template)}
              >
                <Text style={styles.templateCardName}>{template.name}</Text>
                <Text style={styles.templateCardDescription}>{template.description}</Text>
                <View style={styles.templateCardTags}>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{template.data.type}</Text>
                  </View>
                  <View style={[styles.tag, { backgroundColor: '#EFF6FF' }]}>
                    <Text style={[styles.tagText, { color: '#3B82F6' }]}>
                      {template.data.priority}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'history' && renderHistory()}

        <View style={styles.footer} />
      </ScrollView>

      {renderTemplateModal()}
      {renderDateTimePicker()}
    </KeyboardAvoidingView>
  );
}

// ─── STYLES ────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  templateButton: {
    padding: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  userField: {
    marginBottom: 16,
  },
  userInput: {
    backgroundColor: '#fff',
  },
  hintText: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
  },
  required: {
    color: '#EF4444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    minHeight: 80,
  },
  jsonInput: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
  },
  selectText: {
    fontSize: 14,
    color: '#111827',
  },
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    marginBottom: 16,
  },
  scheduleButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    marginHorizontal: 8,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    marginBottom: 16,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionsContainer: {
    marginBottom: 16,
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionEmoji: {
    fontSize: 20,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  actionDescription: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 2,
  },
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  templateCard: {
    width: (width - 16 * 2 - 12) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  templateCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  templateCardDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  templateCardTags: {
    flexDirection: 'row',
    gap: 6,
  },
  tag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
  historyContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyHistoryText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  historyText: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
  },
  historyTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  footer: {
    height: 20,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  templateList: {
    paddingBottom: 20,
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  templateContent: {
    flex: 1,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  templateDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  datePickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  datePickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  datePickerDone: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
});
