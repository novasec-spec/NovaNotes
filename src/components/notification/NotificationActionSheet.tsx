// src/components/notification/NotificationActionSheet.tsx

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppNotification } from '../../types/notifications';

interface ActionOption {
  id: string;
  label: string;
  icon: string;
  color?: string;
  destructive?: boolean;
  action: (notification: AppNotification) => void;
}

interface NotificationActionSheetProps {
  visible: boolean;
  notification: AppNotification | null;
  options: ActionOption[];
  onClose: () => void;
}

export function NotificationActionSheet({
  visible,
  notification,
  options,
  onClose,
}: NotificationActionSheetProps) {
  if (!notification) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{notification.title}</Text>
            <Text style={styles.body} numberOfLines={2}>
              {notification.body}
            </Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Options */}
          <ScrollView>
            {options.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.option,
                  option.destructive && styles.optionDestructive,
                ]}
                onPress={() => {
                  option.action(notification);
                  onClose();
                }}
              >
                <Ionicons
                  name={option.icon as any}
                  size={24}
                  color={option.destructive ? '#EF4444' : (option.color || '#3B82F6')}
                />
                <Text
                  style={[
                    styles.optionLabel,
                    option.destructive && styles.optionLabelDestructive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Cancel button */}
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: { paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  body: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  optionDestructive: { borderBottomColor: '#FECACA' },
  optionLabel: { fontSize: 16, color: '#111827' },
  optionLabelDestructive: { color: '#EF4444' },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#6B7280' },
});
