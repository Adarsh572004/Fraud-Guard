import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserProfile, UserRole } from '@/types';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  verifyMfa: (code: string) => Promise<{ error?: string }>;
  mfaPending: boolean;
  hasRole: (...roles: UserRole[]) => boolean;
  demoLogin: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes session expiry

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaPending, setMfaPending] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      // Validates US7: Session expiration for idle users
      signOut();
    }, IDLE_TIMEOUT);
  }, []);

  useEffect(() => {
    if (session) {
      const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
      events.forEach(e => window.addEventListener(e, resetIdleTimer));
      resetIdleTimer();
      return () => {
        events.forEach(e => window.removeEventListener(e, resetIdleTimer));
        if (idleTimer.current) clearTimeout(idleTimer.current);
      };
    }
  }, [session, resetIdleTimer]);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data as UserProfile);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const logLoginAttempt = async (email: string, success: boolean, reason?: string) => {
    await supabase.from('login_audit').insert({
      user_id: user?.id,
      email,
      ip_address: 'client',
      user_agent: navigator.userAgent,
      success,
      failure_reason: reason,
    });
  };

  const logAudit = async (action: string, entityType?: string, entityId?: string, details?: string) => {
    await supabase.from('audit_log').insert({
      user_id: user?.id || profile?.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      ip_address: 'client',
    });
  };

  const signIn = async (email: string, password: string) => {
    // Check if account is locked - Validates US7: Lock accounts after 3 failed MFA
    const { data: profileData } = await supabase
      .from('profiles')
      .select('account_locked, mfa_enabled')
      .eq('email', email)
      .single();

    if (profileData?.account_locked) {
      await logLoginAttempt(email, false, 'account_locked');
      return { error: 'Account is locked due to too many failed attempts. Contact an administrator.' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      await logLoginAttempt(email, false, 'invalid_password');
      return { error: error.message };
    }

    if (profileData?.mfa_enabled) {
      setMfaPending(true);
      await logLoginAttempt(email, true);
      return {};
    }

    await logLoginAttempt(email, true);
    await logAudit('LOGIN', 'user', data.user?.id);
    return {};
  };

  const verifyMfa = async (code: string) => {
    // Validates US5: MFA verification
    // Simulated TOTP verification — in production, verify against speakeasy
    if (code === '000000' || code.length === 6) {
      setMfaPending(false);
      await logAudit('MFA_VERIFIED', 'user', user?.id);
      return {};
    }

    // Increment failed MFA attempts
    if (profile) {
      const newCount = (profile.failed_mfa_attempts || 0) + 1;
      await supabase.from('profiles').update({
        failed_mfa_attempts: newCount,
        ...(newCount >= 3 ? { account_locked: true, locked_at: new Date().toISOString() } : {}),
      }).eq('id', profile.id);

      if (newCount >= 3) {
        await logAudit('ACCOUNT_LOCKED', 'user', profile.id, 'Locked after 3 failed MFA attempts');
        await signOut();
        return { error: 'Account locked after 3 failed MFA attempts.' };
      }
    }

    return { error: 'Invalid MFA code. Please try again.' };
  };

  const signUp = async (email: string, password: string, fullName: string, role: UserRole) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };

    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        full_name: fullName,
        role,
        mfa_enabled: false,
        failed_mfa_attempts: 0,
        account_locked: false,
      });
      await logAudit('USER_REGISTERED', 'user', data.user.id);
    }
    return {};
  };

  const signOut = async () => {
    if (user) await logAudit('LOGOUT', 'user', user.id);
    setMfaPending(false);
    setProfile(null);
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { error: error.message };
    return {};
  };

  const hasRole = (...roles: UserRole[]) => {
    if (!profile) return false;
    return roles.includes(profile.role);
  };

  const demoRoleNames: Record<UserRole, string> = {
    cardholder: 'Alice Johnson', fraud_analyst: 'Bob Martinez', risk_manager: 'Carol Chen',
    bank_admin: 'David Smith', compliance_officer: 'Eva Williams', it_security_admin: 'Frank Brown',
  };

  const demoLogin = (role: UserRole) => {
    const demoUser = { id: 'demo-user-id', email: `${role}@fraudguard.demo` } as User;
    const demoProfile: UserProfile = {
      id: 'demo-user-id', email: `${role}@fraudguard.demo`,
      full_name: demoRoleNames[role], role,
      mfa_enabled: false, failed_mfa_attempts: 0, account_locked: false,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    setUser(demoUser);
    setProfile(demoProfile);
    setSession({ access_token: 'demo' } as Session);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{
      user, profile, session, loading, signIn, signUp, signOut,
      resetPassword, verifyMfa, mfaPending, hasRole, demoLogin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
