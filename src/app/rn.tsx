import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { ThemedAlertProvider, useAlert, defaultDarkTheme } from 'rn-themed-alert';

/**
 * TEST COMPONENT - Uses the rn-themed-alert package
 */
function TestScreen() {
  const { alert, confirm, prompt } = useAlert();
  const [result, setResult] = useState<string>('Waiting for action...');

  // ============ ALERT EXAMPLES ============
  const handleBasicAlert = async () => {
    await alert({
      title: 'Basic Alert',
      message: 'This is a simple alert',
      buttonText: 'Got it!',
    });
    setResult('✅ Basic alert dismissed');
  };

  const handleSuccessAlert = async () => {
    await alert({
      title: 'Success!',
      message: 'Operation completed successfully',
      variant: 'success',
    });
    setResult('✅ Success alert shown');
  };

  const handleErrorAlert = async () => {
    await alert({
      title: 'Error',
      message: 'Something went wrong. Please try again.',
      variant: 'error',
      buttonText: 'Retry',
    });
    setResult('❌ Error alert shown');
  };

  const handleWarningAlert = async () => {
    await alert({
      title: 'Warning',
      message: 'This action cannot be undone.',
      variant: 'warning',
    });
    setResult('⚠️ Warning alert shown');
  };

  const handleInfoAlert = async () => {
    await alert({
      title: 'Information',
      message: 'Here is some useful information for you.',
      variant: 'info',
    });
    setResult('ℹ️ Info alert shown');
  };

  // ============ CONFIRM EXAMPLES ============
  const handleSimpleConfirm = async () => {
    const ok = await confirm({
      title: 'Are you sure?',
      message: 'Do you want to proceed with this action?',
      confirmText: 'Yes, proceed',
      cancelText: 'Cancel',
    });
    setResult(`🤝 Confirm: ${ok ? 'Confirmed ✅' : 'Cancelled ❌'}`);
  };

  const handleDestructiveConfirm = async () => {
    const ok = await confirm({
      title: 'Delete Account?',
      message: 'This action cannot be undone. All data will be lost.',
      variant: 'error',
      confirmText: 'Delete',
      cancelText: 'Keep it',
      destructive: true,
    });
    setResult(`🗑️ Delete: ${ok ? 'Deleted ❌' : 'Kept ✅'}`);
  };

  // ============ PROMPT EXAMPLES ============
  const handleTextPrompt = async () => {
    const name = await prompt({
      title: 'What is your name?',
      placeholder: 'John Doe',
      defaultValue: '',
      validate: (v) =>
        v.trim().length === 0 ? 'Name cannot be empty' : null,
    });
    if (name === null) {
      setResult('✍️ Prompt: Cancelled');
    } else {
      setResult(`✍️ Hello, ${name}!`);
    }
  };

  const handleEmailPrompt = async () => {
    const email = await prompt({
      title: 'Enter your email',
      message: 'We will never share your email',
      placeholder: 'your@email.com',
      keyboardType: 'email-address',
      validate: (v) =>
        !v.includes('@') ? 'Please enter a valid email address' : null,
    });
    if (email === null) {
      setResult('📧 Email: Cancelled');
    } else {
      setResult(`📧 Email saved: ${email}`);
    }
  };

  const handlePasswordPrompt = async () => {
    const password = await prompt({
      title: 'Create a password',
      message: 'Must be at least 8 characters',
      placeholder: '••••••••',
      secureTextEntry: true,
      validate: (v) =>
        v.length < 8
          ? 'Password must be at least 8 characters'
          : null,
    });
    if (password === null) {
      setResult('🔐 Password: Cancelled');
    } else {
      setResult(`🔐 Password set (${password.length} characters)`);
    }
  };

  const handleNumberPrompt = async () => {
    const number = await prompt({
      title: 'Enter amount',
      placeholder: '100',
      keyboardType: 'numeric',
      validate: (v) => {
        const num = parseInt(v);
        return isNaN(num) || num <= 0
          ? 'Please enter a valid positive number'
          : null;
      },
    });
    if (number === null) {
      setResult('💰 Amount: Cancelled');
    } else {
      setResult(`💰 Amount: $${number}`);
    }
  };

  // ============ ADVANCED EXAMPLE ============
  const handleQueuedAlerts = async () => {
    setResult('⏳ Showing queued alerts...');
    
    await alert({
      title: 'First Alert',
      message: 'This is shown first',
      variant: 'info',
    });
    
    await confirm({
      title: 'Second: Confirm?',
      message: 'Notice they queue in order',
      confirmText: 'Next',
    });
    
    await alert({
      title: 'Third Alert',
      message: 'All done! They showed one at a time',
      variant: 'success',
    });
    
    setResult('✅ All queued alerts completed');
  };

  const handleCompleteWorkflow = async () => {
    setResult('⏳ Starting complete workflow...');
    
    // Step 1: Get user name
    const name = await prompt({
      title: 'Welcome!',
      message: 'What is your name?',
      placeholder: 'Your name',
      validate: (v) =>
        v.trim().length === 0 ? 'Name is required' : null,
    });
    if (!name) {
      setResult('Workflow cancelled at step 1');
      return;
    }

    // Step 2: Confirm action
    const confirmed = await confirm({
      title: `Hi ${name}!`,
      message: 'Do you want to continue?',
      confirmText: 'Yes',
    });
    if (!confirmed) {
      setResult('Workflow cancelled at step 2');
      return;
    }

    // Step 3: Success message
    await alert({
      title: 'Success!',
      message: `Welcome aboard, ${name}! 🎉`,
      variant: 'success',
    });
    
    setResult(`✅ Workflow complete for ${name}`);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>🎨 rn-themed-alert</Text>
        <Text style={styles.subtitle}>
          Themeable • Animated • Promise-based
        </Text>
      </View>

      {/* Alert Section */}
      <Section title="📢 Alert Examples">
        <Button label="Basic Alert" onPress={handleBasicAlert} />
        <Button
          label="Success Alert"
          onPress={handleSuccessAlert}
          color="#1E9E5A"
        />
        <Button
          label="Error Alert"
          onPress={handleErrorAlert}
          color="#E5484D"
        />
        <Button
          label="Warning Alert"
          onPress={handleWarningAlert}
          color="#D48806"
        />
        <Button
          label="Info Alert"
          onPress={handleInfoAlert}
          color="#3A7BD5"
        />
      </Section>

      {/* Confirm Section */}
      <Section title="🤝 Confirm Dialog">
        <Button label="Simple Confirm" onPress={handleSimpleConfirm} />
        <Button
          label="Destructive Confirm"
          onPress={handleDestructiveConfirm}
          color="#E5484D"
        />
      </Section>

      {/* Prompt Section */}
      <Section title="✍️ Prompt Examples">
        <Button label="Text Input" onPress={handleTextPrompt} />
        <Button label="Email Input" onPress={handleEmailPrompt} />
        <Button label="Password Input" onPress={handlePasswordPrompt} />
        <Button label="Number Input" onPress={handleNumberPrompt} />
      </Section>

      {/* Advanced Section */}
      <Section title="🚀 Advanced">
        <Button
          label="Queued Alerts"
          onPress={handleQueuedAlerts}
          color="#7C5CFF"
        />
        <Button
          label="Complete Workflow"
          onPress={handleCompleteWorkflow}
          color="#111114"
        />
      </Section>

      {/* Result Display */}
      <View style={styles.resultBox}>
        <Text style={styles.resultLabel}>Last Result:</Text>
        <Text style={styles.resultText}>{result}</Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

/**
 * Section Component
 */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/**
 * Button Component
 */
function Button({
  label,
  onPress,
  color = '#111114',
}: {
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: color,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Main App - Wrapped with ThemedAlertProvider
 */
export default function App() {
  return (
    <ThemedAlertProvider
      // Optional: Pass custom theme
      // theme={defaultDarkTheme}
      // Or customize specific properties:
      // theme={{
      //   primaryButtonBg: '#7C5CFF',
      //   borderRadius: 28,
      //   backdropColor: 'rgba(0,0,0,0.7)',
      // }}
    >
      <TestScreen />
    </ThemedAlertProvider>
  );
}

/**
 * Styles
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8FA',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111114',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#55565C',
    fontWeight: '500',
  },
  section: {
    marginHorizontal: 12,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111114',
    marginBottom: 12,
  },
  button: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resultBox: {
    marginHorizontal: 12,
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#3A7BD5',
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#55565C',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111114',
  },
});
