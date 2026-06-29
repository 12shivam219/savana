import React, { createContext, useContext, useEffect, useState } from 'react';
import { isInvalidRefreshTokenError, supabase } from '../lib/supabase';
import type { User } from '../types';
import { useCartStore } from '../stores';

/**
 * Trailing-edge debounce: returns a function that delays invoking `fn`
 * until `delay` ms have elapsed since the last call. Used to coalesce
 * bursts of realtime/focus events that would otherwise trigger
 * overlapping pullCart calls.
 */
function debounceTrailing<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<User>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let authTimeout: ReturnType<typeof setTimeout> | undefined;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        window.location.href = '/reset-password';
        return;
      }
      if (session?.user) {
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          // Offload fetchProfile to a setTimeout to prevent blocking/deadlock in the Supabase client
          if (authTimeout) {
            clearTimeout(authTimeout);
          }
          authTimeout = setTimeout(() => {
            if (mounted) {
              fetchProfile(session.user.id);
              useCartStore.getState().mergeCart(session.user.id);
            }
          }, 0);
        } else {
          if (mounted) {
            setIsLoading(false);
          }
        }
      } else {
        if (mounted) {
          setUser(null);
          setIsLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      if (authTimeout) {
        clearTimeout(authTimeout);
      }
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    // The denormalize_cart_items migration added user_id to cart_items,
    // so we can filter the realtime stream by user_id. Even so, RLS is
    // the authoritative gate — the realtime filter is best-effort.
    const channel = supabase
      .channel(`public:cart_items:user_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cart_items',
          filter: `user_id=eq.${user.id}`,
        },
        // Debounce: realtime events often arrive in bursts (e.g. one
        // DELETE + one INSERT for an UPSERT). Without debouncing we
        // race multiple pullCart calls and thrash the UI.
        debounceTrailing(() => {
          useCartStore.getState().pullCart(user.id);
        }, 300),
      )
      .subscribe();

    // Window focus pulls are a UX nicety but must NOT clobber pending
    // local changes. pullCart now merges with current items, so this is
    // safe; we still debounce to coalesce bursts of focus events.
    const handleFocus = debounceTrailing(() => {
      useCartStore.getState().pullCart(user.id);
    }, 500);
    window.addEventListener('focus', handleFocus);

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUser(data as User);
    } catch (error) {
      console.error('Error fetching profile:', error);
      if (isInvalidRefreshTokenError(error)) {
        await supabase.auth.signOut();
      }
      setUser(null);
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function signUp(email: string, password: string, fullName: string, phone?: string) {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone || null,
          },
        },
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async function signOut() {
    useCartStore.getState().clearLocalCart();
    await supabase.auth.signOut();
    setUser(null);
  }

  async function resetPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async function updatePassword(password: string) {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async function updateProfile(updates: Partial<User>) {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      setUser(data as User);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async function refreshProfile() {
    if (user) {
      await fetchProfile(user.id);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
