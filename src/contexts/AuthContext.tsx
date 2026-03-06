import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  company_id: string | null;
  company_card_id: string | null;
  tag: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: 'admin' | 'employee' | null;
  password_set: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  requiresIdSetup: boolean; // True if employee hasn't set company_card_id
  clearPasswordRecovery: () => void;
  refreshProfile: () => Promise<void>; // Refresh profile after password set
  signUp: (email: string, password: string, fullName: string, role?: 'admin' | 'employee') => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithMagicLink: (email: string) => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingAuth, setProcessingAuth] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
    // Proveri sessionStorage pri inicijalizaciji
    return sessionStorage.getItem('isPasswordRecovery') === 'true';
  });

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
    sessionStorage.removeItem('isPasswordRecovery');
  }, []);

  useEffect(() => {
    // Check if we have auth parameters (from email verification, magic link, or invite)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const queryParams = new URLSearchParams(window.location.search);
    
    // PKCE flow uses ?code= query param, implicit flow uses #access_token hash
    const hasHashParams = hashParams.has('access_token') || hashParams.has('type');
    const hasCodeParam = queryParams.has('code');
    const hasAuthParams = hasHashParams || hasCodeParam;
    
    if (hasAuthParams) {
      if (import.meta.env.DEV) {
        console.log('[AuthContext] Processing auth parameters...', { hasHashParams, hasCodeParam });
      }
      setProcessingAuth(true);
    }

    // Handle PKCE code exchange (for invite links and magic links)
    const handleCodeExchange = async () => {
      const code = queryParams.get('code');
      if (code) {
        if (import.meta.env.DEV) {
          console.log('[AuthContext] Exchanging code for session...');
        }
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (import.meta.env.DEV) {
              console.error('[AuthContext] Code exchange error:', error);
            }
          } else {
            if (import.meta.env.DEV) {
              console.log('[AuthContext] Code exchange successful:', data.user?.email);
            }
          }
          // Clean up URL after exchange
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        } catch (err) {
          if (import.meta.env.DEV) {
            console.error('[AuthContext] Unexpected code exchange error:', err);
          }
        }
      }
    };

    // Execute code exchange if needed (before setting up listener)
    if (hasCodeParam) {
      handleCodeExchange();
    }

    // Helper function to fetch user profile AND tag setting in parallel
    const fetchUserProfile = async (userId: string) => {
      try {
        if (import.meta.env.DEV) {
          console.log('[AuthContext] Fetching profile + tag setting for user:', userId);
        }
        
        const [profileResult, roleResult, tagSettingResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, user_id, company_id, company_card_id, tag, full_name, email, phone, role, password_set, created_at, updated_at')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('user_roles' as any)
            .select('role')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('app_settings' as any)
            .select('value')
            .eq('key', 'tag_selection_visible')
            .maybeSingle()
        ]);

        const { data: profileData, error: profileError } = profileResult;
        const { data: roleData, error: roleError } = roleResult;
        
        // Process tag setting
        if (tagSettingResult.data) {
          const val = (tagSettingResult.data as any).value;
          const anyVisible = typeof val === 'object' && val !== null && Object.values(val).some(v => v === true);
          setTagSelectionVisible(anyVisible);
        }
        setTagSettingLoaded(true);
        
        if (profileError) {
          if (import.meta.env.DEV) {
            console.error('[AuthContext] Error fetching profile:', profileError);
          }
          setLoading(false);
          setProcessingAuth(false);
          return;
        }
        
        let userRole: 'admin' | 'employee' = 'employee';
        
        if (profileData) {
          if (roleError) {
            if (import.meta.env.DEV) {
              console.error('[AuthContext] Error fetching role:', roleError);
            }
            userRole = (profileData.role as 'admin' | 'employee') || 'employee';
          } else if (roleData) {
            const typedRoleData = roleData as unknown as { role: 'admin' | 'employee' };
            userRole = typedRoleData.role;
          } else {
            userRole = (profileData.role as 'admin' | 'employee') || 'employee';
          }
        }
        
        if (import.meta.env.DEV) {
          console.log('[AuthContext] Profile loaded successfully:', { userId, role: userRole });
        }
        setProfile(profileData ? { ...profileData, role: userRole } : null);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[AuthContext] Unexpected error fetching profile:', error);
        }
      } finally {
        setProcessingAuth(false);
        setLoading(false);
      }
    };

    // Set up auth state listener - SYNCHRONOUS callback
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (import.meta.env.DEV) {
          console.log('[AuthContext] Auth state changed:', event, session?.user?.email);
        }
        
        // Detektuj PASSWORD_RECOVERY event - najpouzdaniji način
        if (event === 'PASSWORD_RECOVERY') {
          if (import.meta.env.DEV) {
            console.log('[AuthContext] PASSWORD_RECOVERY event detected');
          }
          setIsPasswordRecovery(true);
          sessionStorage.setItem('isPasswordRecovery', 'true');
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Use setTimeout(0) to defer async Supabase calls and prevent deadlock
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setProcessingAuth(false);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (import.meta.env.DEV) {
        console.log('[AuthContext] Initial session check:', session?.user?.email);
      }
      // Don't set state here - let onAuthStateChange handle it to avoid race condition
      if (!session && !hasAuthParams) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string, role: 'admin' | 'employee' = 'employee') => {
    // First check if user with this email already exists using secure function
    const { data: emailExists } = await supabase
      .rpc('email_exists', { check_email: email });

    if (emailExists) {
      return { 
        error: { 
          message: 'User already registered',
          status: 409
        } 
      };
    }

    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          role: role
        }
      }
    });
    return { error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (import.meta.env.DEV) {
        console.log('Attempting to sign out...');
      }
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        if (import.meta.env.DEV) {
          console.error('Sign out error:', error);
        }
        // Even if there's an error, clear local state
        setSession(null);
        setUser(null);
        setProfile(null);
      } else {
        if (import.meta.env.DEV) {
          console.log('Sign out successful');
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Unexpected sign out error:', error);
      }
      // Clear local state even on unexpected errors
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`
      }
    });
    return { error };
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`
      }
    });
    return { error };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?recovery=true`
    });
    return { error };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    return { error };
  }, []);

  // Fetch tag_selection_visible setting
  const [tagSelectionVisible, setTagSelectionVisible] = useState(false);
  const [tagSettingLoaded, setTagSettingLoaded] = useState(false);
  
  // Tag setting is now fetched inside fetchUserProfile in parallel with profile+role
  // This useEffect only handles the case when session changes (e.g. sign out → sign in again)
  useEffect(() => {
    if (!session) {
      setTagSettingLoaded(false);
      setTagSelectionVisible(false);
    }
  }, [session]);

  // Computed property: employee needs to set company_card_id (and tag if visible)
  const requiresIdSetup = profile !== null && profile.role === 'employee' && 
    (!profile.company_card_id || (tagSelectionVisible && !profile.tag));

  // Function to refresh profile (after password is set)
  const refreshProfile = useCallback(async () => {
    if (user) {
      const [profileResult, roleResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, user_id, company_id, company_card_id, tag, full_name, email, phone, role, password_set, created_at, updated_at')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('user_roles' as any)
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle()
      ]);

      const { data: profileData } = profileResult;
      const { data: roleData } = roleResult;

      if (profileData) {
        let userRole: 'admin' | 'employee' = 'employee';
        if (roleData) {
          const typedRoleData = roleData as unknown as { role: 'admin' | 'employee' };
          userRole = typedRoleData.role;
        } else {
          userRole = (profileData.role as 'admin' | 'employee') || 'employee';
        }
        setProfile({ ...profileData, role: userRole });
      }
    }
  }, [user]);

  const value = useMemo(() => ({
    user,
    session,
    profile,
    loading: loading || processingAuth || (!!session && !tagSettingLoaded),
    isPasswordRecovery,
    requiresIdSetup,
    clearPasswordRecovery,
    refreshProfile,
    signUp,
    signIn,
    signOut,
    signInWithGoogle,
    signInWithMagicLink,
    resetPassword,
    updatePassword
  }), [
    user, session, profile, loading, processingAuth,
    isPasswordRecovery, requiresIdSetup,
    clearPasswordRecovery, refreshProfile, signUp, signIn,
    signOut, signInWithGoogle, signInWithMagicLink,
    resetPassword, updatePassword
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook for consuming auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
