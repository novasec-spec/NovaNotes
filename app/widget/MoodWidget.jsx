import { Text, View, StyleSheet } from 'react-native';
import { createWidget } from 'expo-widgets';

const MoodWidget = ({ mood, moodEmoji, quote, streak, lastUpdated }) => {
  const isSmall = true; // You can detect size if needed
  
  return (
    <View style={styles.container}>
      {/* Header with Mood */}
      <View style={styles.moodContainer}>
        <Text style={styles.moodEmoji}>{moodEmoji || '😊'}</Text>
        <Text style={styles.moodText}>{mood || 'Great'}</Text>
      </View>
      
      {/* Quote - Romantic and inspiring */}
      <Text style={styles.quoteText} numberOfLines={2}>
        {quote || "You mean the world to me 💝"}
      </Text>
      
      {/* Streak Counter */}
      <View style={styles.streakContainer}>
        <Text style={styles.streakEmoji}>🔥</Text>
        <Text style={styles.streakText}>
          {streak || 0} day{streak !== 1 ? 's' : ''} in a row!
        </Text>
      </View>
      
      {/* Last Updated Time */}
      <Text style={styles.timestamp}>
        Updated: {lastUpdated || 'Just now'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
  },
  moodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  moodEmoji: {
    fontSize: 28,
  },
  moodText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginLeft: 8,
  },
  quoteText: {
    fontSize: 13,
    color: '#DDDDDD',
    marginBottom: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  streakEmoji: {
    fontSize: 16,
  },
  streakText: {
    fontSize: 13,
    color: '#FFD93D',
    marginLeft: 6,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 9,
    color: '#666666',
    marginTop: 4,
  },
});

const Widget = createWidget('MoodWidget', MoodWidget);
export default Widget;
