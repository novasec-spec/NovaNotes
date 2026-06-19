// screens/ExpoTokenManager.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';

interface ExpoTokenManagerProps {
  userId: string;
}
export default function ExpoTokenManager({
  userId,
}: ExpoTokenManagerProps) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    fetchToken();
    getDeviceId();
  }, []);

  const getDeviceId = async () => {
    try {
      let id = await AsyncStorage.getItem('deviceId');
      if (!id) {
        id = 'device_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString();
        await AsyncStorage.setItem('deviceId', id);
      }
      setDeviceId(id);
    } catch (error) {
      console.error('Failed to get device ID:', error);
    }
  };

  const fetchToken = async () => {
    setIsLoading(true);
    try {
      // Request permissions if not already granted
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please enable notifications to get push token');
        setToken('Permission denied');
        setIsLoading(false);
        return;
      }

      // Get project ID
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        setToken('No project ID found. Run: eas build:configure');
        setIsLoading(false);
        return;
      }

      // Get Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      setToken(tokenData.data);
      console.log('✅ Expo token fetched:', tokenData.data);
      
      // Auto-save to Supabase
      await saveTokenToSupabase(tokenData.data);
      
    } catch (error) {
      console.error('Failed to fetch token:', error);
      setToken(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveTokenToSupabase = async (expoToken: string) => {
    setIsSaving(true);
    setSaveStatus('idle');
    
    try {
      // Get device ID
      let deviceIdValue = deviceId;
      if (!deviceIdValue) {
        deviceIdValue = await getDeviceId();
      }
      
      // Get user ID
      let userIdValue = userId || 'default_user';
      
      console.log('Saving to Supabase:', { userId: userIdValue, deviceId: deviceIdValue, token: expoToken });
      
      const { data, error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: userIdValue,
          device_id: deviceIdValue,
          expo_token: expoToken,
          platform: Platform.OS,
          app_version: Constants.expoConfig?.version || 'unknown',
          last_active: new Date().toISOString(),
          is_active: true,
        }, {
          onConflict: 'device_id'
        });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      setSaveStatus('success');
      console.log('✅ Token saved to Supabase');
      
      // Save to AsyncStorage too
      await AsyncStorage.setItem('expoToken', expoToken);
      await AsyncStorage.setItem('lastTokenSave', new Date().toISOString());
      
      setTimeout(() => setSaveStatus('idle'), 3000);
      
    } catch (error) {
      console.error('Failed to save token:', error);
      setSaveStatus('error');
      Alert.alert('Save Failed', `Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const shareToken = async () => {
    if (!token || token.startsWith('Error')) {
      Alert.alert('Nothing to share', 'Fetch a valid token first');
      return;
    }
    
    try {
      await Share.share({
        message: `📱 My Expo Push Token:\n\n${token}\n\nDevice ID: ${deviceId || 'N/A'}`,
        title: 'Expo Push Token',
      });
    } catch (error) {
      Alert.alert('Error', 'Could not share token');
    }
  };

  const refreshToken = async () => {
    await fetchToken();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Icon name="key" size={50} color="#FF6B9D" />
        <Text style={styles.title}>📱 Expo Push Token</Text>
        <Text style={styles.subtitle}>Your device's push notification token</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Device Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Device ID:</Text>
          <Text style={styles.infoValue}>{deviceId || 'Loading...'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Platform:</Text>
          <Text style={styles.infoValue}>{Platform.OS}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status:</Text>
          <Text style={[styles.infoValue, { color: token && !token.startsWith('Error') ? '#4CAF50' : '#F44336' }]}>
            {token && !token.startsWith('Error') ? '✅ Active' : '❌ Not Set'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Expo Push Token</Text>
        
        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#FF6B9D" />
            <Text style={styles.loaderText}>Fetching token...</Text>
          </View>
        ) : (
          <>
            <View style={styles.tokenContainer}>
              <Text style={styles.tokenLabel}>Token:</Text>
              <View style={styles.tokenBox}>
                <Text style={styles.tokenValue} selectable>
                  {token || 'Not fetched yet'}
                </Text>
              </View>
            </View>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.button, styles.refreshButton]} onPress={refreshToken}>
                <Icon name="refresh" size={20} color="#fff" />
                <Text style={styles.buttonText}>Refresh</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.shareButton]} 
                onPress={shareToken}
                disabled={!token || token.startsWith('Error')}
              >
                <Icon name="share-social" size={20} color="#fff" />
                <Text style={styles.buttonText}>Share</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>☁️ Cloud Backup</Text>
        
        {isSaving ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="small" color="#FF6B9D" />
            <Text style={styles.loaderText}>Saving to Supabase...</Text>
          </View>
        ) : (
          <>
            {saveStatus === 'success' && (
              <View style={styles.statusContainer}>
                <Icon name="checkmark-circle" size={24} color="#4CAF50" />
                <Text style={styles.successText}>✅ Token saved to Supabase!</Text>
              </View>
            )}
            
            {saveStatus === 'error' && (
              <View style={styles.statusContainer}>
                <Icon name="alert-circle" size={24} color="#F44336" />
                <Text style={styles.errorText}>❌ Failed to save to Supabase</Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={() => token && !token.startsWith('Error') && saveTokenToSupabase(token)}
              disabled={!token || token.startsWith('Error') || isSaving}
            >
              <Icon name="cloud-upload" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>
                {isSaving ? 'Saving...' : '💾 Save to Supabase'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔍 What is this?</Text>
        <Text style={styles.helpText}>
          This token uniquely identifies your device for push notifications.
          Share it with someone to receive notifications from their device.
        </Text>
        <Text style={styles.helpText}>
          💡 Keep it private and only share with trusted contacts.
        </Text>
      </View>

      <View style={styles.noteCard}>
        <Icon name="information-circle" size={20} color="#FF6B9D" />
        <Text style={styles.noteText}>
          Token is automatically saved to Supabase when fetched.
          {'\n'}If you're on Android, ensure google-services.json is configured.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F7',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B9D',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B9D',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  infoLabel: {
    fontSize: 14,
    color: '#888',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  tokenContainer: {
    marginBottom: 16,
  },
  tokenLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 6,
  },
  tokenBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFE4E9',
  },
  tokenValue: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#333',
    lineHeight: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  refreshButton: {
    backgroundColor: '#2196F3',
  },
  copyButton: {
    backgroundColor: '#4CAF50',
  },
  shareButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loaderText: {
    color: '#888',
    marginTop: 10,
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#FF6B9D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
  },
  successText: {
    color: '#4CAF50',
    fontWeight: '500',
    fontSize: 14,
  },
  errorText: {
    color: '#F44336',
    fontWeight: '500',
    fontSize: 14,
  },
  helpText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  noteCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 10,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: '#E65100',
    lineHeight: 18,
  },
});
