// src/contexts/AuthContext.tsx

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { useRouter } from "expo-router";

import { supabase } from '../config/supabase';

type AuthContextType = {
  user: any | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type Props = {
  children: ReactNode;
};

export function AuthProvider({ children }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;


const loadUser = async () => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      if (mounted) {
        setUser(null);
        setLoading(false);
      }

      router.replace("/(tabs)/chat/welcome"); // or your correct login route
       return;
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("Auth getUser error:", error);
    }

    if (mounted) {
      setUser(user ?? null);
    }
  } catch (err) {
    console.error("Failed to load user:", err);

    if (mounted) {
      setUser(null);
    }
  } finally {
    if (mounted) {
      setLoading(false);
    }
  }
};

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    console.error('useAuth called outside AuthProvider');

    return {
      user: null,
      loading: true,
    };
  }

  return ctx;
}
