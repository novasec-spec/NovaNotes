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

interface TaskProjectModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateProject: (data: any) => void;
  colors: any;
}

const PROJECT_COLORS = ['#FF6B9D', '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#FF5722'];

export function TaskProjectModal({ visible, onClose, onCreateProject, colors }: TaskProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0]);

  const handleCreate = () => {
    if (name.trim()) {
      onCreateProject({
        name: name.trim(),
        description: description.trim(),
        color: selectedColor,
        icon: 'folder-outline',
      });
      onClose();
      setName('');
      setDescription('');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Create New Project
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
            placeholder="Project name"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
          />

          <TextInput
            style={[styles.input, styles.textArea, { 
              backgroundColor: colors.card, 
              color: colors.text,
              borderColor: colors.border,
            }]}
            placeholder="Description (optional)"
            placeholderTextColor={colors.muted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          <Text style={[styles.label, { color: colors.text }]}>Choose Color</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorRow}>
            {PROJECT_COLORS.map((color) => (
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
            <Text style={styles.createBtnText}>Create Project</Text>
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
    marginBottom: 12,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
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
