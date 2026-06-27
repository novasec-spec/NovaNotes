// src/app/chat/index.tsx - Add notification registration
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text, Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import AuthScreen from './auth';
import ChatList from './chatlist';
import ChatRoom from './chatroom';
import { User } from './types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setupNotifications, addNotificationListeners, registerPushToken, getExpoPushToken } from './notifications';

export default function ChatScreen() {
  const { colors, isDarkMode } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeChat();
    setupNotificationListeners();
  }, []);

  const initializeChat = async () => {
    await checkAuth();
    await setupNotifications();
  };

  const setupNotificationListeners = () => {
    const cleanup = addNotificationListeners((data) => {
      // Handle notification tap
      console.log('📨 Notification tapped:', data);
      if (data.senderId) {
        // Navigate to the chat with that user
        const otherUserId = data.senderId;
        // You can navigate to chat room here
      }
    });
    return cleanup;
  };

  const checkAuth = async () => {
    try {
      const auth = await AsyncStorage.getItem('is_authenticated');
      const userData = await AsyncStorage.getItem('chat_user');
      
      if (auth === 'true' && userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsAuthenticated(true);
        
        // ✅ Register push token for this user
        await registerPushToken(parsedUser.id);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (loggedInUser: User) => {
    setUser(loggedInUser);
    setIsAuthenticated(true);
    
    // ✅ Register push token when user logs in
    await registerPushToken(loggedInUser.id);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('is_authenticated');
    await AsyncStorage.removeItem('chat_user');
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    setSelectedUser(null);
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#FF6B9D" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  if (selectedUser && user) {
    return (
      <ChatRoom
        user={user}
        otherUser={selectedUser}
        onBack={() => setSelectedUser(null)}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>💬 Chat</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Hi, {user?.username}! 👋
          </Text>
        </View>

<TouchableOpacity
        style={[styles.settingsBtn, { backgroundColor: isDarkMode ? '#1A1A2E' : '#F0F4FF' }]}
        onPress={() => router.push('/chat/notification')}
      >
        <Icon name="notifications" size={24} color={colors.text} />
      </TouchableOpacity>


<TouchableOpacity
        style={[styles.settingsBtn, { backgroundColor: isDarkMode ? '#1A1A2E' : '#F0F4FF' }]}
        onPress={() => router.push('/chat/settings')}
      >
        <Icon name="settings-outline" size={24} color={colors.text} />
      </TouchableOpacity>
      </View>

      <ChatList user={user!} onSelectUser={setSelectedUser} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
settingsBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
  },
});
