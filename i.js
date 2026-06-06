// ❌ Current — content bleeds under status bar
<View style={styles.container}>

// ✅ Fix — respects status bar + notch
import { SafeAreaView } from 'react-native-safe-area-context';

<SafeAreaView style={styles.container} edges={['top']}>
// Remove this:
import { ..., SafeAreaView } from 'react-native';

// Add this:
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
