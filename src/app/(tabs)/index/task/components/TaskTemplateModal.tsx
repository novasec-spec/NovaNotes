import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { TaskTemplate } from '../types/task.types';
import { TaskService } from '../services/taskService';

interface TaskTemplateModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyTemplate: (templateId: string) => void;
  colors: any;
}

export function TaskTemplateModal({ visible, onClose, onApplyTemplate, colors }: TaskTemplateModalProps) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const taskService = TaskService.getInstance();

  useEffect(() => {
    if (visible) {
      loadTemplates();
    }
  }, [visible]);

  const loadTemplates = async () => {
    setLoading(true);
    const data = await taskService.getTemplates();
    setTemplates(data);
    setLoading(false);
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderTemplate = ({ item }: { item: TaskTemplate }) => (
    <TouchableOpacity
      style={[styles.templateItem, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => onApplyTemplate(item.id)}
    >
      <View style={styles.templateHeader}>
        <Icon name="copy-outline" size={20} color={colors.primary} />
        <Text style={[styles.templateName, { color: colors.text }]}>
          {item.name}
        </Text>
      </View>
      
      {item.description && (
        <Text style={[styles.templateDesc, { color: colors.muted }]}>
          {item.description}
        </Text>
      )}

      <View style={styles.templateMeta}>
        <View style={[styles.categoryTag, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.categoryText, { color: colors.primary }]}>
            {item.category}
          </Text>
        </View>
        <Text style={[styles.taskCount, { color: colors.muted }]}>
          {item.tasks.length} tasks
        </Text>
        <Text style={[styles.usageCount, { color: colors.muted }]}>
          Used {item.usageCount} times
        </Text>
      </View>

      <View style={styles.templateTasks}>
        {item.tasks.slice(0, 3).map((task, index) => (
          <Text key={index} style={[styles.taskPreview, { color: colors.muted }]}>
            • {task.title}
          </Text>
        ))}
        {item.tasks.length > 3 && (
          <Text style={[styles.moreTasks, { color: colors.muted }]}>
            +{item.tasks.length - 3} more
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Task Templates
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Icon name="search-outline" size={20} color={colors.muted} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search templates..."
              placeholderTextColor={colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <FlatList
            data={filteredTemplates}
            keyExtractor={(item) => item.id}
            renderItem={renderTemplate}
            contentContainerStyle={styles.templatesList}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={loadTemplates}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="copy-outline" size={48} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted }]}>
                  No templates found
                </Text>
                <Text style={[styles.emptySub, { color: colors.muted }]}>
                  Create templates from your existing tasks
                </Text>
              </View>
            }
          />
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  templatesList: {
    paddingBottom: 16,
  },
  templateItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
  },
  templateDesc: {
    fontSize: 13,
    marginBottom: 8,
  },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '500',
  },
  taskCount: {
    fontSize: 11,
  },
  usageCount: {
    fontSize: 11,
  },
  templateTasks: {
    marginTop: 4,
  },
  taskPreview: {
    fontSize: 12,
    marginBottom: 2,
  },
  moreTasks: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    marginTop: 4,
  },
});
