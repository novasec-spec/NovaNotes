import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  FlatList,
  Animated,
  PanResponder,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
export default function ChatModal({
  isOpen,
  toggleChat,
  clearHistory,
  apiKey,
  setShowApiModal,
  flatListRef = "",
  messages = "",
  renderMessage,
  inputText = "",
  setInputText,
  sendMessage,
  isLoading,
  inputRef,
})  {
    return (
     <Modal visible={isOpen}>
      transparent
      animationType="slide"
      onRequestClose={toggleChat}
    >
      <SafeAreaView style={styles.modalSafeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Icon name="sparkles" size={24} color="#FF6B9D" />
              <Text style={styles.headerTitle}>MUNGA CLONE 💕</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={() => setShowApiModal(true)} style={styles.iconBtn}>
                <Icon name="settings-outline" size={22} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity onPress={clearHistory} style={styles.iconBtn}>
                <Icon name="trash-outline" size={22} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleChat} style={styles.iconBtn}>
                <Icon name="close" size={26} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="sparkles" size={48} color="#FF6B9D" />
                <Text style={styles.emptyTitle}>Hey bestie! 💕</Text>
                <Text style={styles.emptyText}>
                  I'm MUNGA CLONE — your magical AI bestie! ✨
                  {'\n'}Set up your Gemini API key in settings and let's chat!
                </Text>
                {!apiKey && (
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => setShowApiModal(true)}
                  >
                    <Text style={styles.emptyButtonText}>🔑 Set API Key</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />

          {/* Typing Indicator */}
          {isLoading && (
            <View style={styles.typingContainer}>
              <Text style={styles.typingText}>MUNGA is thinking</Text>
              <View style={styles.typingDots}>
                <View style={[styles.dot, styles.dot1]} />
                <View style={[styles.dot, styles.dot2]} />
                <View style={[styles.dot, styles.dot3]} />
              </View>
            </View>
          )}

          {/* Input Area */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder={apiKey ? "Message your bestie..." : "🔑 Set API key first..."}
                placeholderTextColor="#999"
                multiline
                maxLength={500}
                onSubmitEditing={sendMessage}
                blurOnSubmit={false}
                returnKeyType="send"
                editable={!!apiKey}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!inputText.trim() || isLoading || !apiKey) && styles.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={!inputText.trim() || isLoading || !apiKey}
              >
                <Icon name="send" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Quick Actions */}
            {messages.length > 0 && (
              <View style={styles.quickActions}>
                {QUICK_ACTIONS.map((action) => (
                  <TouchableOpacity
                    key={action.id}
                    style={styles.quickBtn}
                    onPress={() => handleQuickAction(action.id)}
                  >
                    <Icon name={action.icon} size={20} color="#FF6B9D" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
// ─── STYLES ───
const styles = StyleSheet.create({
  // ─── Modal ───
  modalSafeArea: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  iconBtn: {
    padding: 4,
  },

  // ─── Messages ───
  messagesContainer: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  userWrapper: {
    justifyContent: 'flex-end',
  },
  aiWrapper: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFE4E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '78%',
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#FF6B9D',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#2a2a2a',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: '#eee',
  },
  messageTime: {
    fontSize: 10,
    color: '#888',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  syncIndicator: {
    fontSize: 9,
    color: '#888',
    marginTop: 2,
  },

  // ─── Empty ───
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FF6B9D',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#FF6B9D',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },

  // ─── Typing ───
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#1a1a1a',
  },
  typingText: {
    fontSize: 13,
    color: '#999',
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF6B9D',
  },
  dot1: { opacity: 0.3 },
  dot2: { opacity: 0.6 },
  dot3: { opacity: 1 },

  // ─── Input ───
  inputContainer: {
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    maxHeight: 100,
    color: '#fff',
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: '#FF6B9D',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#444',
  },

  // ─── Quick Actions ───
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 8,
  },
  quickBtn: {
    padding: 6,
  },

  // ─── API Modal ───
  apiModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  apiModalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  apiModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  apiModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  apiModalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 22,
  },
  apiLink: {
    color: '#FF6B9D',
    fontWeight: '600',
  },
  apiInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 16,
  },
  apiModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  apiButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
  },
  apiCancelButton: {
    backgroundColor: '#F5F5F5',
  },
  apiCancelText: {
    color: '#666',
    fontWeight: '600',
  },
  apiSaveButton: {
    backgroundColor: '#FF6B9D',
  },
  apiSaveText: {
    color: '#fff',
    fontWeight: '600',
  },
  apiStatus: {
    fontSize: 13,
    color: '#4CAF50',
    marginTop: 12,
    textAlign: 'center',
  },
  apiNote: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});





