import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type PremiumContextType = {
  isPremium: boolean;
  setIsPremium: (val: boolean) => void;
};

const PremiumContext = createContext<PremiumContextType>({
  isPremium: false,
  setIsPremium: () => {},
});

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremiumState] = useState(false);

  // Check if user is already premium on app start
  useEffect(() => {
    const checkStatus = async () => {
      const status = await AsyncStorage.getItem('is_premium');
      if (status === 'true') setIsPremiumState(true);
    };
    checkStatus();
  }, []);

  const setIsPremium = async (val: boolean) => {
    setIsPremiumState(val);
    await AsyncStorage.setItem('is_premium', val ? 'true' : 'false');
  };

  return (
    <PremiumContext.Provider value={{ isPremium, setIsPremium }}>
      {children}
    </PremiumContext.Provider>
  );
}

export const usePremium = () => useContext(PremiumContext);
