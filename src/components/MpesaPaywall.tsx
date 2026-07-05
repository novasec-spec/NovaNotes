import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Paystack } from 'react-native-paystack-webview';
import { usePremium } from '../contexts/PremiumContext';
import { useColors } from '../hooks/useColors'; // Assuming you have this hook

export function MpesaPaywall({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { setIsPremium } = usePremium();
  const { PINK, WHITE, TEXT_SOFT } = useColors();
  const [paystackVisible, setPaystackVisible] = useState(false);

  // This function is called when Paystack successfully processes the payment
  const handleSuccess = (response: any) => {
    console.log('Payment Success:', response);
    setIsPremium(true); // Unlock the app!
    setPaystackVisible(false);
    onClose();
    Alert.alert("Success!", "Welcome to Premium! 🎉");
  };

  const handleClose = () => {
    setPaystackVisible(false);
    onClose();
  };

  return (
    <>
      <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.card, { backgroundColor: WHITE }]}>
            <Text style={[styles.title, { color: '#111' }]}>Unlock Premium</Text>
            <Text style={[styles.subtitle, { color: TEXT_SOFT }]}>
              Support the app and unlock exclusive features via M-Pesa.
            </Text>
            
            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: PINK }]} 
              onPress={() => setPaystackVisible(true)}
            >
              <Text style={styles.btnText}>Pay KES 500 via M-Pesa</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={{ marginTop: 20 }}>
              <Text style={{ color: TEXT_SOFT }}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

        {/* The Actual Paystack Webview that triggers STK Push */}
        {paystackVisible && (
          <Paystack
            paystackKey="pk_test_6266d4d449ca1aebef7155117a05a7941a561e99" // 👈 PUT YOUR KEY HERE
            amount={500}
            billingEmail="user@example.com" // You can get this from user input if needed
            activityIndicatorColor={PINK}
            onSuccess={handleSuccess}
            onCancel={handleClose}
            autoStart={true}
          />
        )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', borderRadius: 24, padding: 30, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 10 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 25 },
  btn: { width: '100%', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
