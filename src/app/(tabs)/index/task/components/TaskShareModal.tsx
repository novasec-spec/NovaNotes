// src/components/TaskShareModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
 Image,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { supabase } from '../../../../../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
}

interface TaskShareModalProps {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
  onShare: (taskId: string, userIds: string[]) => void;
  colors: any;
}

export function TaskShareModal({ visible, task, onClose, onShare, colors }: TaskShareModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadUsers();
      getCurrentUser();
    } else {
      setSelectedUsers([]);
      setSearchQuery('');
    }
  }, [visible]);

  const getCurrentUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('chat_user');
      if (userData) {
        const user = JSON.parse(userData);
        setCurrentUserId(user.id);
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      // ✅ Fetch real users from Supabase
      const { data, error } = await supabase
        .from('users')
        .select('id, username, email, avatar_url')
        .order('username', { ascending: true });

      if (error) throw error;

      // Filter out current user
      const filteredUsers = data?.filter(u => u.id !== currentUserId) || [];
      setUsers(filteredUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      // Fallback to mock users if needed
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    if (task && selectedUsers.length > 0) {
      onShare(task.id, selectedUsers);
      onClose();
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const filteredUsers = users.filter(user =>
    user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderUser = ({ item }: { item: User }) => {
    const isSelected = selectedUsers.includes(item.id);
    const initial = item.username?.charAt(0).toUpperCase() || '?';
    
    return (
      <TouchableOpacity
        style={[
          styles.userItem,
          { 
            backgroundColor: isSelected ? colors.primary + '15' : colors.card,
            borderColor: isSelected ? colors.primary : colors.border,
          }
        ]}
        onPress={() => toggleUser(item.id)}
      >
        {item.avatar_url ? (
          <Image 
            source={{ uri: item.avatar_url }} 
            style={[styles.avatar, { borderRadius: 20 }]} 
          />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.primary + '30' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {initial}
            </Text>
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.text }]}>
            {item.username || 'Unknown User'}
          </Text>
          <Text style={[styles.userEmail, { color: colors.muted }]}>
            {item.email}
          </Text>
        </View>
        <Icon
          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={isSelected ? colors.primary : colors.muted}
        />
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Share Task
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {task && (
            <View style={[styles.taskPreview, { backgroundColor: colors.card }]}>
              <Text style={[styles.taskPreviewTitle, { color: colors.text }]}>
                {task.title}
              </Text>
              {task.description && (
                <Text style={[styles.taskPreviewDesc, { color: colors.muted }]}>
                  {task.description}
                </Text>
              )}
            </View>
          )}

          <View style={styles.searchContainer}>
            <Icon name="search-outline" size={20} color={colors.muted} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search users..."
              placeholderTextColor={colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.selectedCount}>
            <Text style={[styles.countText, { color: colors.muted }]}>
              {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.muted }]}>
                Loading users...
              </Text>
            </View>
          ) : users.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="people-outline" size={50} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.text }]}>
                No users found
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.muted }]}>
                Invite someone to share tasks with!
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id}
              renderItem={renderUser}
              contentContainerStyle={styles.userList}
              showsVerticalScrollIndicator={false}
            />
          )}

          <TouchableOpacity
            style={[
              styles.shareBtn,
              { 
                backgroundColor: colors.primary,
                opacity: selectedUsers.length > 0 ? 1 : 0.5,
              }
            ]}
            onPress={handleShare}
            disabled={selectedUsers.length === 0 || loading}
          >
            <Icon name="share-social" size={20} color="#fff" />
            <Text style={styles.shareBtnText}>
              Share with {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  taskPreview: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  taskPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  taskPreviewDesc: {
    fontSize: 12,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  selectedCount: {
    marginBottom: 12,
  },
  countText: {
    fontSize: 13,
  },
  userList: {
    paddingBottom: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
  },
  userEmail: {
    fontSize: 12,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  shareBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    marginTop: 4,
  },
});
