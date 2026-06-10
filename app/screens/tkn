// screens/TokenManagerScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Share,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../../config/supabase';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
export default function TokenManagerScreen() {

  const [expoToken, setExpoToken] = useState<string | null>(null);
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
      // Get or create a unique device ID
      let id = await AsyncStorage.getItem('deviceId');
      if (!id) {
        id = Math.random().toString(36).substring(2, 15) + 
             Math.random().toString(36).substring(2, 15);
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
        setExpoToken('Permission denied');
        setIsLoading(false);
        return;
      }

      // Get project ID from app.json
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        setExpoToken('No project ID found. Run: eas build:configure');
        setIsLoading(false);
        return;
      }

      // Get Expo push token
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      setExpoToken(token.data);
      console.log('✅ Expo token fetched:', token.data);
      
      // Auto-save to Supabase
      await saveTokenToSupabase(token.data);
      
    } catch (error) {
      console.error('Failed to fetch token:', error);
      setExpoToken(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveTokenToSupabase = async (token: string) => {
    setIsSaving(true);
    setSaveStatus('idle');
    
    try {
      // Get user ID (you can set this manually or from somewhere else)
      const userId = await AsyncStorage.getItem('e9077b65-46aa-4a24-b9c4-48ef704c0973') || 'default_user';
      
      // Save to Supabase
      const { data, error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: userId,
          device_id: deviceId,
          expo_token: token,
          platform: Platform.OS,
          app_version: Constants.expoConfig?.version || 'unknown',
          last_active: new Date().toISOString(),
          is_active: true,
        }, {
          onConflict: 'device_id'
        });

      if (error) throw error;
      
      setSaveStatus('success');
      console.log('✅ Token saved to Supabase');
      
      // Also save locally
      await AsyncStorage.setItem('lastTokenSave', new Date().toISOString());
      await AsyncStorage.setItem('expoToken', token);
      
    } catch (error) {
      console.error('Failed to save token:', error);
      setSaveStatus('error');
      Alert.alert('Save Failed', 'Could not save token to Supabase. Check your connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = async () => {
    if (!expoToken || expoToken.startsWith('Error') || expoToken === 'Permission denied') {
      Alert.alert('Nothing to copy', 'Fetch a valid token first');
      return;
    }
    
    try {
      await Clipboard.setString(expoToken);
      Alert.alert('Copied!', 'Expo token copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Could not copy to clipboard');
    }
  };

  const shareToken = async () => {
    if (!expoToken || expoToken.startsWith('Error')) {
      Alert.alert('Nothing to share', 'Fetch a valid token first');
      return;
    }
    
    try {
      await Share.share({
        message: `Expo Push Token:\n${expoToken}\n\nDevice ID: ${deviceId}`,
        title: 'Expo Push Token',
      });
    } catch (error) {
      Alert.alert('Error', 'Could not share');
    }
  };

  const sendTestNotification = async () => {
    if (!expoToken || expoToken.startsWith('Error')) {
      Alert.alert('No Token', 'Fetch a valid token first');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: expoToken,
          title: '🎉 Test Notification',
          body: 'If you see this, push notifications are working!',
          sound: 'default',
          data: { type: 'test' },
        }),
      });

      const result = await response.json();
      if (result.data?.status === 'ok') {
        Alert.alert('Success', 'Test notification sent! Check your phone.');
      } else {
        Alert.alert('Error', `Failed: ${result.errors?.[0]?.message || 'Unknown error'}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not send test notification');
    } finally {
      setIsLoading(false);
    }
  };

  return (
<SafeAreaView style={styles.container} edges={['top']}>
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="key" size={50} color="#FF6B9D" />
        <Text style={styles.title}>Push Token Manager</Text>
        <Text style={styles.subtitle}>Hidden Screen - For Developer Use Only</Text>
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
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Expo Push Token</Text>
        
        {isLoading ? (
          <ActivityIndicator size="large" color="#FF6B9D" style={styles.loader} />
        ) : (
          <>
            <View style={styles.tokenContainer}>
              <Text style={styles.tokenLabel}>Token:</Text>
              <Text style={styles.tokenValue} selectable>
                {expoToken || 'Not fetched yet'}
              </Text>
            </View>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.iconButton} onPress={fetchToken}>
                <Icon name="refresh" size={24} color="#fff" />
                <Text style={styles.iconButtonText}>Fetch</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.iconButton} onPress={copyToClipboard}>
                <Icon name="copy" size={24} color="#fff" />
                <Text style={styles.iconButtonText}>Copy</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.iconButton} onPress={shareToken}>
                <Icon name="share-social" size={24} color="#fff" />
                <Text style={styles.iconButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Backup Status</Text>
        
        {isSaving ? (
          <ActivityIndicator size="small" color="#FF6B9D" />
        ) : (
          <>
            {saveStatus === 'success' && (
              <View style={styles.successContainer}>
                <Icon name="checkmark-circle" size={24} color="#4CAF50" />
                <Text style={styles.successText}>Token saved to Supabase!</Text>
              </View>
            )}
            
            {saveStatus === 'error' && (
              <View style={styles.errorContainer}>
                <Icon name="alert-circle" size={24} color="#F44336" />
                <Text style={styles.errorText}>Failed to save to Supabase</Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={() => expoToken && saveTokenToSupabase(expoToken)}
              disabled={!expoToken || expoToken.startsWith('Error')}>
              <Icon name="cloud-upload" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Manual Save to Supabase</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Test</Text>
        <TouchableOpacity 
          style={styles.testButton} 
          onPress={sendTestNotification}
          disabled={!expoToken || expoToken.startsWith('Error')}>
          <Icon name="notifications" size={20} color="#fff" />
          <Text style={styles.testButtonText}>Send Test Notification</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.noteCard}>
        <Icon name="information-circle" size={20} color="#FF6B9D" />
        <Text style={styles.noteText}>
          This token is unique to this device. Keep it secret. You can use it to send push notifications to this phone via Expo's API.
        </Text>
      </View>
    </ScrollView>
</SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F7',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B9D',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF6B9D',
    marginBottom: 15,
  },
  tokenContainer: {
    marginBottom: 20,
  },
  tokenLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 5,
  },
  tokenValue: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#333',
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
    overflow: 'scroll',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  iconButton: {
    backgroundColor: '#FF6B9D',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 8,
  },
  iconButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 25,
    gap: 8,
    marginTop: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  testButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 25,
    gap: 8,
  },
  testButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  loader: {
    marginVertical: 20,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    marginBottom: 15,
  },
  successText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
    marginBottom: 15,
  },
  errorText: {
    color: '#F44336',
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  noteCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    padding: 15,
    gap: 10,
    marginBottom: 30,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: '#E65100',
    lineHeight: 18,
  },
});
