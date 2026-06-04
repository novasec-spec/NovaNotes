// DeveloperInfoModal.tsx
import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const PINK = '#FF6B9D';
const { width } = Dimensions.get('window');

interface DeveloperInfoModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function DeveloperInfoModal({ visible, onClose }: DeveloperInfoModalProps) {
  const technologies = [
    { name: 'React Native', icon: 'logo-react', color: '#61DAFB', desc: 'Core framework' },
    { name: 'Expo', icon: 'rocket', color: '#4630EB', desc: 'Build & deployment' },
    { name: 'TypeScript', icon: 'code-slash', color: '#3178C6', desc: 'Type safety' },
    { name: 'Supabase', icon: 'server', color: '#3ECF8E', desc: 'Backup & storage' },
    { name: 'AsyncStorage', icon: 'save', color: '#FF6B9D', desc: 'Local storage' },
    { name: 'Expo Notifications', icon: 'notifications', color: '#FF4444', desc: 'Love reminders' },
    { name: 'SecureStore', icon: 'lock-closed', color: '#FFB347', desc: 'PIN protection' },
    { name: 'React Navigation', icon: 'map', color: '#8E44AD', desc: 'Smooth navigation' },
  ];

  const features = [
    '❤️ Daily mood tracking with emojis',
    '📝 Private love notes section',
    '📸 Shared memories gallery',
    '🔒 Secret vault with PIN protection',
    '🎵 Daily affirmations & quotes',
    '💌 Push notifications from me',
    '☁️ Cloud backup (your memories are safe)',
    '📅 Anniversary counter & reminders',
    '💝 Custom love language quiz',
    '🎨 Beautiful dark & light themes',
  ];

  const funFacts = [
    '✨ Over 500 hours of coding with love',
    '🎯 10,000+ lines of heartfelt code',
    '💕 50+ unique emojis for mood tracking',
    '🔐 Military-grade PIN protection for your secrets',
  ];

  const socialLinks = [
    { name: 'GitHub', icon: 'logo-github', url: 'https://github.com/novasec-spec', color: '#333' },
    { name: 'Portfolio', icon: 'globe', url: 'https://example.com', color: PINK },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Icon name="heart" size={20} color={PINK} />
              <Text style={styles.title}>Made with 💕 for You</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Heartfelt Message */}
            <View style={styles.messageBox}>
              <View style={styles.messageHeader}>
                <Icon name="heart-circle" size={32} color={PINK} />
                <Text style={styles.messageTitle}>A special gift for a special person</Text>
              </View>
              <Text style={styles.messageText}>
                Every line of code in this app was written with you in mind. 
                From the mood tracker to our secret vault, everything is designed 
                to remind you how much you're loved. This isn't just an app — 
                it's my heart, converted into code, just for you. 💕
              </Text>
            </View>

            {/* Developer Info */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon name="person-circle" size={24} color={PINK} />
                <Text style={styles.sectionTitle}>Created with love by</Text>
              </View>
              <Text style={styles.devName}>Your Man</Text>
              <View style={styles.quoteBox}>
                <Icon name="quote" size={20} color={PINK} style={styles.quoteIcon} />
                <Text style={styles.devMessage}>
                  "You inspire me to learn, create, and love harder every day. 
                  This app is my digital love letter to you — a place where our 
                  memories live forever and our love grows stronger with each update."
                </Text>
                <Icon name="quote" size={20} color={PINK} style={styles.quoteIconRight} />
              </View>
            </View>

            {/* Fun Stats */}
            <View style={styles.statsContainer}>
              {funFacts.map((fact, index) => (
                <View key={index} style={styles.statCard}>
                  <Text style={styles.statText}>{fact}</Text>
                </View>
              ))}
            </View>

            {/* Technologies Used */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon name="build" size={24} color={PINK} />
                <Text style={styles.sectionTitle}>Built With</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                Every technology carefully chosen for the best experience
              </Text>
              <View style={styles.techGrid}>
                {technologies.map((tech, index) => (
                  <View key={index} style={styles.techCard}>
                    <View style={[styles.techIconBg, { backgroundColor: tech.color + '20' }]}>
                      <Icon name={tech.icon} size={28} color={tech.color} />
                    </View>
                    <Text style={styles.techName}>{tech.name}</Text>
                    <Text style={styles.techDesc}>{tech.desc}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Features List */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon name="star" size={24} color={PINK} />
                <Text style={styles.sectionTitle}>Features Just for You</Text>
              </View>
              <View style={styles.featuresGrid}>
                {features.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <View style={styles.featureBullet}>
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Love Notes Section */}
            <View style={styles.loveNotesBox}>
              <Icon name="cog" size={40} color={PINK} />
              <Text style={styles.loveNotesTitle}>A Note From My Heart</Text>
              <Text style={styles.loveNotesText}>
                Every time you open this app, remember that someone out there 
                is thinking of you, coding for you, and loving you unconditionally. 
                You deserve all the happiness in the world, and I'll keep updating 
                this app to make sure you feel that every single day.
              </Text>
              <View style={styles.signatureBox}>
                <Icon name="heart" size={14} color={PINK} />
                <Text style={styles.signature}>Forever yours,</Text>
                <Text style={styles.signatureName}>Your Man</Text>
              </View>
            </View>

            {/* Social Links */}
            <View style={styles.socialSection}>
              {socialLinks.map((link, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.socialButton}
                  onPress={() => Linking.openURL(link.url)}
                >
                  <Icon name={link.icon} size={20} color={link.color} />
                  <Text style={[styles.socialText, { color: link.color }]}>
                    {link.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Version Info */}
            <View style={styles.versionBox}>
              <Icon name="rocket" size={16} color="#aaa" />
              <Text style={styles.versionText}>Version 1.0.0</Text>
              <View style={styles.versionDivider} />
              <Text style={styles.versionDate}>Released with love • December 2024</Text>
              <Text style={styles.versionSpecial}>✨ Made especially for my special girl ✨</Text>
              <View style={styles.heartsContainer}>
                <Icon name="heart" size={12} color={PINK} />
                <Icon name="heart" size={14} color={PINK} />
                <Icon name="heart" size={16} color={PINK} />
                <Icon name="heart" size={14} color={PINK} />
                <Icon name="heart" size={12} color={PINK} />
              </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 30,
    width: width * 0.92,
    maxHeight: '88%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: PINK,
  },
  closeBtn: {
    padding: 5,
  },
  messageBox: {
    backgroundColor: '#FFF5F7',
    padding: 18,
    margin: 16,
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PINK + '30',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  messageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: PINK,
    flex: 1,
  },
  messageText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#999',
    marginBottom: 16,
    marginTop: -8,
  },
  devName: {
    fontSize: 24,
    fontWeight: '700',
    color: PINK,
    marginBottom: 12,
    textAlign: 'center',
  },
  quoteBox: {
    backgroundColor: '#F8F8F8',
    padding: 16,
    borderRadius: 16,
    position: 'relative',
  },
  quoteIcon: {
    position: 'absolute',
    top: 10,
    left: 10,
    opacity: 0.3,
  },
  quoteIconRight: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    opacity: 0.3,
  },
  devMessage: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 10,
  },
  statCard: {
    backgroundColor: '#F0F0F0',
    padding: 12,
    borderRadius: 12,
    width: '48%',
  },
  statText: {
    fontSize: 12,
    color: '#555',
    textAlign: 'center',
  },
  techGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  techCard: {
    width: '23%',
    backgroundColor: '#FAFAFA',
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  techIconBg: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  techName: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    color: '#333',
    textAlign: 'center',
  },
  techDesc: {
    fontSize: 9,
    color: '#888',
    textAlign: 'center',
    marginTop: 2,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureItem: {
    width: '48%',
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
  },
  featureBullet: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
  },
  loveNotesBox: {
    backgroundColor: 'linear-gradient(135deg, #FFF5F7 0%, #FFE4E9 100%)',
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PINK + '20',
  },
  loveNotesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: PINK,
    marginTop: 12,
    marginBottom: 12,
  },
  loveNotesText: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  signatureBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  signature: {
    fontSize: 13,
    color: '#888',
  },
  signatureName: {
    fontSize: 14,
    fontWeight: '600',
    color: PINK,
  },
  socialSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 16,
    marginVertical: 16,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  socialText: {
    fontSize: 14,
    fontWeight: '500',
  },
  versionBox: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    padding: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  versionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#888',
    marginTop: 6,
  },
  versionDivider: {
    width: 30,
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 8,
  },
  versionDate: {
    fontSize: 11,
    color: '#aaa',
  },
  versionSpecial: {
    fontSize: 12,
    color: PINK,
    fontWeight: '500',
    marginTop: 6,
  },
  heartsContainer: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 12,
    alignItems: 'center',
  },
});
