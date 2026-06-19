import { View, Text, StyleSheet, Switch } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export default function SettingsScreen() {
  // Grab the toggle function along with colors and state
  const { colors, isDarkMode, toggleTheme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

      {/* Dark Mode Toggle Row */}
      <View style={[styles.settingRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.settingText, { color: colors.text }]}>
          Dark Mode
        </Text>
        
        {/* The actual toggle switch */}
        <Switch
          value={isDarkMode}
          onValueChange={toggleTheme}
          // Optional: Customize the colors of the switch itself
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={isDarkMode ? '#007AFF' : '#f4f3f4'}
        />
      </View>

      {/* You can add more settings rows here! */}
      <View style={[styles.settingRow, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 15 }]}>
        <Text style={[styles.settingText, { color: colors.text }]}>
          Notifications
        </Text>
        <Switch value={true} onValueChange={() => {}} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  settingText: {
    fontSize: 18,
    fontWeight: '500',
  },
});
