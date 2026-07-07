// src/app/call-test.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
// import CallService from '../services/CallService';
import { supabase } from '../config/supabase';

export default function CallTestScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [calleeId, setCalleeId] = useState('');
  const [calleeName, setCalleeName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Load users for testing
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, email, avatar_url')
        .neq('id', user?.id)
        .limit(20);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleVideoCall = async () => {
    if (!calleeId) {
      Alert.alert('Error', 'Please select a user to call');
      return;
    }

    if (isLoading) return;

    try {
      setIsLoading(true);
      
      // Get the user's name
      const selectedUser = users.find(u => u.id === calleeId);
      const displayName = selectedUser?.username || calleeName || 'User';

      // Initiate the call
      const call = await CallService.initiateCall(calleeId);
      
      if (call) {
        // Navigate to call screen
        router.push({
          pathname: '/call/CallScreen',
          params: {
            callId: call.id,
            calleeId: calleeId,
            calleeName: displayName,
            type: 'video',
            isCaller: 'true',
          },
        });
      } else {
        Alert.alert('Error', 'Failed to start call');
      }
    } catch (error: any) {
      console.error('Call error:', error);
      Alert.alert('Error', error?.message || 'Failed to start call');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudioCall = async () => {
    if (!calleeId) {
      Alert.alert('Error', 'Please select a user to call');
      return;
    }

    if (isLoading) return;

    try {
      setIsLoading(true);
      
      const selectedUser = users.find(u => u.id === calleeId);
      const displayName = selectedUser?.username || calleeName || 'User';

      const call = await CallService.initiateCall(calleeId, 'audio');
      
      if (call) {
        router.push({
          pathname: '/call/CallScreen',
          params: {
            callId: call.id,
            calleeId: calleeId,
            calleeName: displayName,
            type: 'audio',
            isCaller: 'true',
          },
        });
      } else {
        Alert.alert('Error', 'Failed to start call');
      }
    } catch (error: any) {
      console.error('Call error:', error);
      Alert.alert('Error', error?.message || 'Failed to start call');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Video Call Test
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search */}
        <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Icon name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search users..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* User List */}
        <ScrollView style={styles.userList} showsVerticalScrollIndicator={false}>
          {filteredUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="people-outline" size={60} color={colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                {searchQuery ? 'No users found' : 'No users available'}
              </Text>
            </View>
          ) : (
            filteredUsers.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={[
                  styles.userItem,
                  { 
                    backgroundColor: calleeId === user.id ? colors.primary : colors.card,
                    borderColor: colors.border,
                  }
                ]}
                onPress={() => {
                  setCalleeId(user.id);
                  setCalleeName(user.username || 'User');
                }}
              >
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {user.username?.[0]?.toUpperCase() || 'U'}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: colors.text }]}>
                    {user.username || 'User'}
                  </Text>
                  <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
                    {user.email || ''}
                  </Text>
                </View>
                {calleeId === user.id && (
                  <View style={styles.selectedBadge}>
                    <Icon name="checkmark-circle" size={24} color="#22C55E" />
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* Call Controls */}
        <View style={[styles.callControls, { borderTopColor: colors.border }]}>
          <View style={styles.selectedUserContainer}>
            <Text style={[styles.selectedUserLabel, { color: colors.textSecondary }]}>
              Selected User:
            </Text>
            <Text style={[styles.selectedUserName, { color: colors.text }]}>
              {calleeName || 'None selected'}
            </Text>
          </View>

          <View style={styles.callButtons}>
            <TouchableOpacity
              style={[styles.callButton, styles.audioCallButton, !calleeId && styles.disabledButton]}
              onPress={handleAudioCall}
              disabled={!calleeId || isLoading}
            >
              <Icon name="call" size={28} color="#fff" />
              <Text style={styles.callButtonText}>Audio</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.callButton, styles.videoCallButton, !calleeId && styles.disabledButton]}
              onPress={handleVideoCall}
              disabled={!calleeId || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="videocam" size={28} color="#fff" />
                  <Text style={styles.callButtonText}>Video</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    padding: 0,
  },
  userList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF6B9D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
  },
  userEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  selectedBadge: {
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    marginTop: 12,
  },
  callControls: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  selectedUserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectedUserLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  selectedUserName: {
    fontSize: 16,
    fontWeight: '500',
  },
  callButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  audioCallButton: {
    backgroundColor: '#22C55E',
  },
  videoCallButton: {
    backgroundColor: '#8B5CF6',
  },
  disabledButton: {
    opacity: 0.5,
  },
  callButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
