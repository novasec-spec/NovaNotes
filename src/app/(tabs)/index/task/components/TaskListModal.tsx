import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

interface TaskListModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateList: (name: string, icon: string, color: string) => void;
  colors: any;
}

const AVAILABLE_ICONS = ['list-outline', 'folder-outline', 'bookmark-outline', 'star-outline', 'flag-outline'];
const AVAILABLE_COLORS = ['#FF6B9D', '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336'];

export function TaskListModal({ visible, onClose, onCreateList, colors }: TaskListModalProps) {
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(AVAILABLE_ICONS[0]);
  const [selectedColor, setSelectedColor] = useState(AVAILABLE_COLORS[0]);

  const handleCreate = () => {
    if (name.trim()) {
      onCreateList(name.trim(), selectedIcon, selectedColor);
      onClose();
      setName('');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Create New List
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.card, 
              color: colors.text,
              borderColor: colors.border,
            }]}
            placeholder="List name"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
          />

          <Text style={[styles.label, { color: colors.text }]}>Choose Icon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconRow}>
            {AVAILABLE_ICONS.map((icon) => (
              <TouchableOpacity
                key={icon}
                style={[
                  styles.iconBtn,
                  { 
                    backgroundColor: selectedIcon === icon ? colors.primary : colors.card,
                    borderColor: colors.border,
                  }
                ]}
                onPress={() => setSelectedIcon(icon)}
              >
                <Icon name={icon} size={24} color={selectedIcon === icon ? '#fff' : colors.text} />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.label, { color: colors.text }]}>Choose Color</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorRow}>
            {AVAILABLE_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorBtn,
                  { 
                    backgroundColor: color,
                    borderWidth: selectedColor === color ? 3 : 0,
                    borderColor: '#fff',
                  }
                ]}
                onPress={() => setSelectedColor(color)}
              />
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.createBtn, { 
              backgroundColor: colors.primary,
              opacity: name.trim() ? 1 : 0.5,
            }]}
            onPress={handleCreate}
            disabled={!name.trim()}
          >
            <Text style={styles.createBtnText}>Create List</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    borderRadius: 24,
    padding: 24,
    maxHeight: '80%',
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
  input: {
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  iconRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
  },
  colorRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  colorBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
  },
  createBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
