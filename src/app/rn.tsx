// App.tsx — drop this in a fresh `npx create-expo-app` project.
// Install first: npm install rn-themed-alert
import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedAlertProvider, useAlert, Toast, Loading } from 'rn-themed-alert';

export default function App() {
  return (
    <ThemedAlertProvider>
      <TestScreen />
    </ThemedAlertProvider>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.buttonWrap}>{children}</View>
    </View>
  );
}

function Btn({ label, onPress, color }: { label: string; onPress: () => void; color?: string }) {
  return (
    <TouchableOpacity
      style={[styles.btn, color ? { backgroundColor: color } : null]}
      onPress={onPress}
    >
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function TestScreen() {
  // Hook-based access — same objects as the direct Toast/Loading imports.
  const { alert, confirm, prompt, toast, loading } = useAlert();
  const [log, setLog] = useState<string[]>([]);

  const pushLog = (line: string) => setLog((prev) => [line, ...prev].slice(0, 6));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Text style={styles.header}>rn-themed-alert test screen</Text>

        {/* ---------- Blocking dialogs ---------- */}
        <Section title="alert()">
          <Btn label="Default" onPress={() => alert({ title: 'Hello', message: 'A default alert.' })} />
          <Btn
            label="Success"
            onPress={() => alert({ title: 'Saved!', variant: 'success', message: 'Your changes were saved.' })}
          />
          <Btn
            label="Error"
            color="#E5484D"
            onPress={() => alert({ title: 'Something went wrong', variant: 'error', message: 'Try again later.' })}
          />
        </Section>

        <Section title="confirm()">
          <Btn
            label="Basic confirm"
            onPress={async () => {
              const ok = await confirm({ title: 'Are you sure?', message: 'This is a normal confirm.' });
              pushLog(`confirm -> ${ok}`);
            }}
          />
          <Btn
            label="Destructive confirm"
            color="#E5484D"
            onPress={async () => {
              const ok = await confirm({
                title: 'Delete item?',
                message: 'This cannot be undone.',
                variant: 'error',
                destructive: true,
                confirmText: 'Delete',
              });
              pushLog(`delete confirm -> ${ok}`);
            }}
          />
        </Section>

        <Section title="prompt()">
          <Btn
            label="Basic prompt"
            onPress={async () => {
              const name = await prompt({ title: 'Rename chat', placeholder: 'Chat name' });
              pushLog(`prompt -> ${name === null ? 'cancelled' : name}`);
            }}
          />
          <Btn
            label="Prompt with validation"
            onPress={async () => {
              const val = await prompt({
                title: 'Enter email',
                keyboardType: 'email-address',
                validate: (v) => (v.includes('@') ? null : 'Enter a valid email'),
              });
              pushLog(`email prompt -> ${val === null ? 'cancelled' : val}`);
            }}
          />
        </Section>

        <Section title="Queue test (fire 3 at once)">
          <Btn
            label="Queue 3 alerts"
            onPress={() => {
              alert({ title: 'First' });
              alert({ title: 'Second' });
              alert({ title: 'Third' });
            }}
          />
        </Section>

        {/* ---------- Toasts, hook-based ---------- */}
        <Section title="Toast — via useAlert().toast">
          <Btn label="Success" color="#1E9E5A" onPress={() => toast.success('Saved!')} />
          <Btn label="Error" color="#E5484D" onPress={() => toast.error('Upload failed', 'Check your connection.')} />
          <Btn label="Warning" color="#D48806" onPress={() => toast.warning('Low storage', '200MB left.')} />
          <Btn label="Info" color="#3A7BD5" onPress={() => toast.info('New message from Alex')} />
        </Section>

        {/* ---------- Toasts, imperative import ---------- */}
        <Section title="Toast — via direct import (Toast.success...)">
          <Btn label="Success (imperative)" color="#1E9E5A" onPress={() => Toast.success('Imperative success!')} />
          <Btn
            label="Bottom position"
            onPress={() => Toast.info('Down here', undefined, { position: 'bottom' })}
          />
          <Btn
            label="With action (Undo)"
            onPress={() =>
              Toast.show({
                title: 'Message deleted',
                variant: 'info',
                action: { text: 'Undo', onPress: () => pushLog('Undo pressed') },
              })
            }
          />
          <Btn
            label="Long duration (8s)"
            onPress={() => Toast.info('Sticks around for 8s', undefined, { duration: 8000 })}
          />
          <Btn
            label="Manual dismiss only"
            onPress={() => Toast.warning('Swipe or tap me to dismiss', undefined, { duration: 0 })}
          />
          <Btn
            label="Stack 3 toasts"
            onPress={() => {
              Toast.success('First');
              Toast.info('Second');
              Toast.warning('Third');
            }}
          />
        </Section>

        {/* ---------- Loading / progress ---------- */}
        <Section title="Loading — indeterminate spinner">
          <Btn
            label="Show for 2s then hide"
            onPress={() => {
              const id = Loading.show({ title: 'Signing in…' });
              setTimeout(() => Loading.hide(id), 2000);
            }}
          />
          <Btn
            label="Cancellable"
            onPress={() => {
              Loading.show({
                title: 'Uploading…',
                cancellable: true,
                onCancel: () => pushLog('Loading cancelled'),
              });
            }}
          />
        </Section>

        <Section title="Loading — determinate progress bar">
          <Btn
            label="Simulate upload progress"
            onPress={() => {
              const id = Loading.show({ title: 'Uploading video…' });
              let pct = 0;
              const interval = setInterval(() => {
                pct += 10;
                Loading.update(id, pct);
                if (pct >= 100) {
                  clearInterval(interval);
                  setTimeout(() => Loading.hide(id), 400);
                }
              }, 300);
            }}
          />
        </Section>

        <Section title="Loading — via hook (useAlert().loading)">
          <Btn
            label="Show via hook"
            onPress={() => {
              const id = loading.show({ title: 'Loading via hook…' });
              setTimeout(() => loading.hide(id), 1500);
            }}
          />
        </Section>

        {/* ---------- Log ---------- */}
        <Section title="Result log">
          {log.length === 0 ? (
            <Text style={styles.logEmpty}>Results from confirm/prompt/actions show here.</Text>
          ) : (
            log.map((line, i) => (
              <Text key={i} style={styles.logLine}>
                {line}
              </Text>
            ))
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F9' },
  header: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: '#111114' },
  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#7A7B82', marginBottom: 8, textTransform: 'uppercase' },
  buttonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    backgroundColor: '#111114',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  btnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  logEmpty: { color: '#9A9BA1', fontSize: 13, fontStyle: 'italic' },
  logLine: { color: '#111114', fontSize: 13, marginBottom: 4 },
});
