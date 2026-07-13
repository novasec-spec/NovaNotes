// src/app/(tabs)/faith/settings.tsx - FIXED
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import FaithNotificationService from './services/notificationService';
// src/app/(tabs)/faith/settings.tsx - Add missing import
import * as Notifications from 'expo-notifications'; // ✅ Add this import

export default function FaithSettingsScreen() {
  const { colors, isDarkMode } = useTheme();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // ✅ Get the service instance
  const notificationService = FaithNotificationService.getInstance();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await notificationService.getSettings();
      setSettings(saved);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSetting = async (key: keyof any) => {
    if (!settings) return;

    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    await notificationService.saveSettings(newSettings);
  };

  const setPrayerTime = () => {
    Alert.alert(
      'Set Prayer Time',
      'Choose your daily prayer time',
      [
        { text: '5:00 AM', onPress: async () => {
          const newSettings = { ...settings!, prayerTime: { hour: 5, minute: 0 } };
          setSettings(newSettings);
          await notificationService.saveSettings(newSettings);
          Alert.alert('✅ Prayer time set to 5:00 AM');
        }},
        { text: '6:00 AM', onPress: async () => {
          const newSettings = { ...settings!, prayerTime: { hour: 6, minute: 0 } };
          setSettings(newSettings);
          await notificationService.saveSettings(newSettings);
          Alert.alert('✅ Prayer time set to 6:00 AM');
        }},
        { text: '7:00 AM', onPress: async () => {
          const newSettings = { ...settings!, prayerTime: { hour: 7, minute: 0 } };
          setSettings(newSettings);
          await notificationService.saveSettings(newSettings);
          Alert.alert('✅ Prayer time set to 7:00 AM');
        }},
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const sendTestNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 Faith Test Notification',
        body: 'Your notifications are working! 🙏✨',
        sound: true,
        data: { type: 'test', timestamp: Date.now() },
      },
      trigger: null,
    });
    Alert.alert('✅ Test notification sent!');
  };

  if (loading || !settings) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>⚙️ Faith Settings</Text>
        <TouchableOpacity style={styles.placeholderBtn}>
          <View style={{ width: 24 }} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>🔔 Notifications</Text>

          <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
            <View style={styles.settingInfo}>
              <MaterialCommunityIcons name="bible" size={22} color="#8B5CF6" />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Verse of the Day</Text>
            </View>
            <Switch
              value={settings.verseOfTheDay}
              onValueChange={() => toggleSetting('verseOfTheDay')}
              trackColor={{ false: colors.border, true: '#8B5CF6' }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
            <View style={styles.settingInfo}>
              <MaterialCommunityIcons name="hands-pray" size={22} color="#22C55E" />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Prayer Reminders</Text>
            </View>
            <Switch
              value={settings.prayerReminder}
              onValueChange={() => toggleSetting('prayerReminder')}
              trackColor={{ false: colors.border, true: '#22C55E' }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.border }]}
            onPress={setPrayerTime}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <MaterialCommunityIcons name="clock" size={22} color="#F59E0B" />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Prayer Time</Text>
                <Text style={[styles.settingSub, { color: colors.muted }]}>
                  {`${settings.prayerTime.hour}:${settings.prayerTime.minute.toString().padStart(2, '0')}`}
                </Text>
              </View>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>

          <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
            <View style={styles.settingInfo}>
              <MaterialCommunityIcons name="church" size={22} color="#F59E0B" />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Sermon Reminders (Sunday)</Text>
            </View>
            <Switch
              value={settings.sermonReminder}
              onValueChange={() => toggleSetting('sermonReminder')}
              trackColor={{ false: colors.border, true: '#F59E0B' }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.settingItem]}>
            <View style={styles.settingInfo}>
              <MaterialCommunityIcons name="star" size={22} color="#22C55E" />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Praise Reminders</Text>
            </View>
            <Switch
              value={settings.praiseReminder}
              onValueChange={() => toggleSetting('praiseReminder')}
              trackColor={{ false: colors.border, true: '#22C55E' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>🧪 Test Notifications</Text>
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: '#8B5CF6' }]}
            onPress={sendTestNotification}
          >
            <Icon name="notifications" size={20} color="#fff" />
            <Text style={styles.testButtonText}>Send Test Notification</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <MaterialCommunityIcons name="information" size={20} color={colors.muted} />
          <Text style={[styles.infoText, { color: colors.muted }]}>
            Notifications help you stay connected with your faith journey. You'll receive verses, prayer reminders, and more.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  placeholderBtn: { padding: 4 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, fontWeight: '500' },
  content: { padding: 16 },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingLabel: { fontSize: 15, fontWeight: '500' },
  settingSub: { fontSize: 12, opacity: 0.6 },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  testButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18, opacity: 0.7 },
});
