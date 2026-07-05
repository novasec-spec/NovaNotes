import { usePremium } from '../../contexts/PremiumContext';
import { useState } from 'react';
import { MpesaPaywall } from '../../components/MpesaPaywall';

// Add Premium to your config
const TAB_CONFIG = {
  // ... existing tabs
  Premium: { icon: 'diamond-outline', iconActive: 'diamond', color: '#D4AF37', label: '✨ Premium' },
};

export default function TabsLayout() {
  const { isPremium } = usePremium();
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);

  return (
    <>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} onPremiumPress={() => setIsPaywallOpen(true)} />}
        screenOptions={{ headerShown: false }}
      >
        {/* ... your existing screens ... */}
        
        {/* Only show the Premium tab if you want it visible, or keep it hidden and just use a button elsewhere */}
        <Tabs.Screen name="premium_placeholder" options={{ href: null }} /> 
      </Tabs>

      {/* The Paywall Modal */}
      <MpesaPaywall visible={isPaywallOpen} onClose={() => setIsPaywallOpen(false)} />
    </>
  );
}

// Update CustomTabBar to accept the callback
function CustomTabBar({ state, navigation, onPremiumPress }: any) {
  // ... existing animation logic ...

  return (
    <View style={[styles.tabBar, { paddingBottom: bottomPad }]}>
      {/* ... pill animation ... */}
      
      {state.routes.map((route: any, i: number) => {
        // ... existing mapping logic ...

        const onPress = () => {
          // 🚨 GATEKEEPING LOGIC 🚨
          if (route.name === 'premium_placeholder') {
             if (isPremium) {
               // If already premium, maybe go to a settings page or do nothing
               Alert.alert("You are already Premium! ✨");
             } else {
               onPremiumPress(); // Open the M-Pesa Paywall
             }
             return;
          }

          // Standard navigation for other tabs
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        // ... rest of your TouchableOpacity return ...
      })}
    </View>
  );
}
