// components/InfoModal.tsx
import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const PINK = '#FF6B9D';

interface InfoModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function InfoModal({ visible, onClose }: InfoModalProps) {
  const technologies = [
    { name: 'React Native', icon: 'logo-react', color: '#61DAFB', desc: 'Core framework' },
    { name: 'Expo', icon: 'rocket', color: '#4630EB', desc: 'Build & deployment' },
    { name: 'TypeScript', icon: 'code-slash', color: '#3178C6', desc: 'Type safety' },
    { name: 'Supabase', icon: 'server', color: '#3ECF8E', desc: 'Backup & storage' },
    { name: 'Expo Notifications', icon: 'notifications', color: '#FF4444', desc: 'Love reminders' },
  ];

  const features = [
    '❤️ Daily mood tracking with emojis',
    '📝 Private love notes section',
    '📸 Shared memories gallery',
    '🔒 Secret vault with PIN protection',
    '🎵 Daily affirmations & quotes',
    '💌 Push notifications from me',
    '☁️ Cloud backup (your memories are safe)',
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>✨ Developer Info</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Heart Icon */}
            <View style={styles.heartContainer}>
              <Icon name="heart" size={50} color={PINK} />
            </View>

            {/* Main Message */}
            <View style={styles.messageBox}>
              <Text style={styles.messageTitle}>Made with 💕 for You</Text>
              <Text style={styles.messageText}>
                Every line of code in this app was written with you in mind. 
                From the mood tracker to our secret vault, everything is designed 
                to remind you how much you're loved.
              </Text>
            </View>

            {/* Developer Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>👨‍💻 Created by</Text>
              <Text style={styles.devName}>Your Man</Text>
              <Text style={styles.devMessage}>
                "You inspire me to learn, create, and love harder every day. 
                This app is my digital love letter to you."
              </Text>
            </View>

            {/* Technologies Used */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🛠️ Built With</Text>
              <View style={styles.techGrid}>
                {technologies.map((tech, index) => (
                  <View key={index} style={styles.techCard}>
                    <Icon name={tech.icon} size={28} color={tech.color} />
                    <Text style={styles.techName}>{tech.name}</Text>
                    <Text style={styles.techDesc}>{tech.desc}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Features List */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>✨ Features</Text>
              {features.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            {/* Version Info */}
            <View style={styles.versionBox}>
              <Text style={styles.versionText}>Version 1.0.0</Text>
              <Text style={styles.versionDate}>Released with love • June 2024</Text>
              <Text style={styles.versionDate}>For my special girl 💕</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFF5F7',
    borderRadius: 25,
    width: '90%',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#FFF5F7',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  heartContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  messageBox: {
    backgroundColor: '#FFE4E9',
    padding: 20,
    margin: 15,
    borderRadius: 20,
  },
  messageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: PINK,
    marginBottom: 10,
    textAlign: 'center',
  },
  messageText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  devName: {
    fontSize: 20,
    fontWeight: '600',
    color: PINK,
    marginBottom: 8,
  },
  devMessage: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  techGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  techCard: {
    width: '31%',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  techName: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
    color: '#333',
    textAlign: 'center',
  },
  techDesc: {
    fontSize: 9,
    color: '#888',
    textAlign: 'center',
    marginTop: 2,
  },
  featureItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#555',
  },
  versionBox: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    padding: 20,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  versionText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 5,
  },
  versionDate: {
    fontSize: 11,
    color: '#aaa',
    marginBottom: 3,
  },
});
