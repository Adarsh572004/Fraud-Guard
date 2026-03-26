-- FraudGuard Database Schema
-- Supabase Migration: Create all tables for the fraud detection system
-- Run this in your Supabase SQL Editor

-- =============================================================================
-- 1. PROFILES (extends Supabase auth.users)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cardholder' CHECK (role IN (
    'cardholder', 'fraud_analyst', 'risk_manager',
    'bank_admin', 'compliance_officer', 'it_security_admin'
  )),
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret TEXT,
  failed_mfa_attempts INTEGER DEFAULT 0,
  account_locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('bank_admin', 'it_security_admin'))
);
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('bank_admin', 'it_security_admin'))
);
CREATE POLICY "Anyone can insert profile on signup" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'), 'cardholder');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 2. CARDS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  card_number TEXT NOT NULL,
  card_type TEXT NOT NULL CHECK (card_type IN ('visa', 'mastercard', 'amex', 'discover')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'expired')),
  blocked_at TIMESTAMPTZ,
  blocked_by UUID REFERENCES auth.users(id),
  region TEXT DEFAULT 'US',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own cards" ON public.cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Analysts can view cards" ON public.cards FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('fraud_analyst', 'risk_manager', 'bank_admin'))
);
CREATE POLICY "Cards can be updated by analysts" ON public.cards FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('fraud_analyst', 'risk_manager', 'bank_admin'))
);

-- =============================================================================
-- 3. TRANSACTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES public.cards(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  merchant TEXT,
  merchant_category TEXT,
  location TEXT,
  region TEXT,
  risk_score NUMERIC,
  risk_level TEXT CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'blocked', 'under_review', 'confirmed_fraud'
  )),
  is_flagged BOOLEAN DEFAULT FALSE,
  features JSONB,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Analysts can view all transactions" ON public.transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('fraud_analyst', 'risk_manager', 'bank_admin', 'compliance_officer'))
);
CREATE POLICY "Analysts can update transactions" ON public.transactions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('fraud_analyst', 'risk_manager', 'bank_admin'))
);
CREATE POLICY "System can insert transactions" ON public.transactions FOR INSERT WITH CHECK (TRUE);

-- =============================================================================
-- 4. FRAUD CASES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fraud_cases (
  id TEXT PRIMARY KEY, -- Format: FG-YYYYMMDD-XXXX
  transaction_id UUID NOT NULL REFERENCES public.transactions(id),
  reported_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'open' CHECK (status IN (
    'open', 'investigating', 'resolved_fraud', 'resolved_legitimate', 'closed'
  )),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (transaction_id, reported_by)
);

ALTER TABLE public.fraud_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reporters see own cases" ON public.fraud_cases FOR SELECT USING (auth.uid() = reported_by);
CREATE POLICY "Analysts can view all cases" ON public.fraud_cases FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('fraud_analyst', 'risk_manager', 'bank_admin'))
);
CREATE POLICY "Users can report" ON public.fraud_cases FOR INSERT WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Analysts can update cases" ON public.fraud_cases FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('fraud_analyst', 'risk_manager', 'bank_admin'))
);

-- =============================================================================
-- 5. CASE NOTES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.case_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT NOT NULL REFERENCES public.fraud_cases(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  note TEXT NOT NULL,
  is_customer_visible BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Note authors and analysts can read" ON public.case_notes FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('fraud_analyst', 'risk_manager', 'bank_admin'))
);
CREATE POLICY "Analysts can add notes" ON public.case_notes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('fraud_analyst', 'risk_manager', 'bank_admin'))
);

-- =============================================================================
-- 6. ALERTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL CHECK (type IN ('push', 'sms', 'email')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'read', 'confirmed', 'denied')),
  action_taken TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own alerts" ON public.alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert alerts" ON public.alerts FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Users can update own alerts" ON public.alerts FOR UPDATE USING (auth.uid() = user_id);

-- =============================================================================
-- 7. NOTIFICATION PREFERENCES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id),
  push_enabled BOOLEAN DEFAULT TRUE,
  sms_enabled BOOLEAN DEFAULT FALSE,
  email_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prefs" ON public.notification_preferences FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- 8. ML MODELS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ml_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  model_data TEXT,
  accuracy NUMERIC,
  f1_score NUMERIC,
  false_positive_rate NUMERIC,
  training_rows INTEGER,
  is_active BOOLEAN DEFAULT FALSE,
  trained_by UUID REFERENCES auth.users(id),
  training_started_at TIMESTAMPTZ,
  training_completed_at TIMESTAMPTZ,
  rolled_back BOOLEAN DEFAULT FALSE,
  rollback_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ml_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "IT/Risk can manage models" ON public.ml_models FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('it_security_admin', 'risk_manager', 'bank_admin'))
);
CREATE POLICY "Anyone can read active model" ON public.ml_models FOR SELECT USING (is_active = TRUE);

-- =============================================================================
-- 9. DATASET UPLOADS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.dataset_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  row_count INTEGER,
  feature_count INTEGER,
  fraud_count INTEGER,
  normal_count INTEGER,
  fraud_rate NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dataset_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own uploads" ON public.dataset_uploads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upload" ON public.dataset_uploads FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 10. LOGIN AUDIT
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.login_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.login_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read login audit" ON public.login_audit FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('compliance_officer', 'it_security_admin', 'bank_admin'))
);
CREATE POLICY "Anyone can insert login audit" ON public.login_audit FOR INSERT WITH CHECK (TRUE);

-- =============================================================================
-- 11. SYSTEM AUDIT LOG (IMMUTABLE)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
-- Immutable: INSERT only, no UPDATE or DELETE policies
CREATE POLICY "Anyone can insert audit" ON public.audit_log FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Compliance/IT can read audit" ON public.audit_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('compliance_officer', 'it_security_admin', 'bank_admin'))
);

-- =============================================================================
-- INDEXES for performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_flagged ON public.transactions(is_flagged) WHERE is_flagged = TRUE;
CREATE INDEX IF NOT EXISTS idx_transactions_risk ON public.transactions(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON public.alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_status ON public.fraud_cases(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_audit_email ON public.login_audit(email);
