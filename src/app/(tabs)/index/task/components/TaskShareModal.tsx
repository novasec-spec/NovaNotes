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
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Task } from '../types/task.types';
import { ShareService } from '../services/shareService';

interface User {
  id: string;
 username: string;
  email: string;
  avatar_url?: string;
  selected?: boolean;
}

interface TaskShareModalProps {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
  onShare: (taskId: string, userIds: string[], message?: string) => Promise<void>;
  colors: any;
}

export function TaskShareModal({ visible, task, onClose, onShare, colors }: TaskShareModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sharing, setSharing] = useState(false);
  
  const shareService = ShareService.getInstance();

  useEffect(() => {
    if (visible) {
      loadUsers();
      // Reset selections
      setSelectedUsers([]);
      setMessage('');
    }
  }, [visible]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const availableUsers = await shareService.getAvailableUsers();
      setUsers(availableUsers);
    } catch (error) {
      console.error('Load users error:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!task || selectedUsers.length === 0) return;

    setSharing(true);
    try {
      await onShare(task.id, selectedUsers, message || undefined);
      Alert.alert(
        'Success',
        `Task shared with ${selectedUsers.length} user${selectedUsers.length > 1 ? 's' : ''}`,
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share task. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderUser = ({ item }: { item: User }) => {
    const isSelected = selectedUsers.includes(item.id);
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
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, { backgroundColor: colors.primary + '30' }]}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {item.username.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.text }]}>
            {item.username}
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
            <TouchableOpacity onPress={onClose} disabled={sharing}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {task && (
            <View style={[styles.taskPreview, { backgroundColor: colors.card }]}>
              <View style={styles.taskPreviewHeader}>
                <Icon name="document-text-outline" size={20} color={colors.primary} />
                <Text style={[styles.taskPreviewTitle, { color: colors.text }]}>
                  {task.title}
                </Text>
              </View>
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
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="close-circle" size={20} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.controlsRow}>
            <View style={styles.selectedCount}>
              <Text style={[styles.countText, { color: colors.muted }]}>
                {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
              </Text>
            </View>
            {filteredUsers.length > 0 && (
              <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllBtn}>
                <Text style={[styles.selectAllText, { color: colors.primary }]}>
                  {selectedUsers.length === filteredUsers.length ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.muted }]}>
                Loading users...
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id}
              renderItem={renderUser}
              contentContainerStyle={styles.userList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Icon name="people-outline" size={48} color={colors.muted} />
                  <Text style={[styles.emptyText, { color: colors.muted }]}>
                    No users found
                  </Text>
                </View>
              }
            />
          )}

          {/* Message Input */}
          <View style={styles.messageContainer}>
            <TextInput
              style={[styles.messageInput, { 
                backgroundColor: colors.card,
                color: colors.text,
                borderColor: colors.border,
              }]}
              placeholder="Add a message (optional)"
              placeholderTextColor={colors.muted}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={2}
              editable={!sharing}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.shareBtn,
              { 
                backgroundColor: colors.primary,
                opacity: selectedUsers.length > 0 && !sharing ? 1 : 0.5,
              }
            ]}
            onPress={handleShare}
            disabled={selectedUsers.length === 0 || sharing}
          >
            {sharing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="share-social" size={20} color="#fff" />
                <Text style={styles.shareBtnText}>
                  Share with {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''}
                </Text>
              </>
            )}
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
  taskPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  taskPreviewDesc: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 28,
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
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectedCount: {
    flex: 1,
  },
  countText: {
    fontSize: 13,
  },
  selectAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '500',
  },
  userList: {
    paddingBottom: 8,
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
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
  messageContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  messageInput: {
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    minHeight: 50,
    textAlignVertical: 'top',
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
});
