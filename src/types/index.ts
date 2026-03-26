export type UserRole = 
  | 'cardholder'
  | 'fraud_analyst'
  | 'risk_manager'
  | 'bank_admin'
  | 'compliance_officer'
  | 'it_security_admin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  mfa_enabled: boolean;
  mfa_secret?: string;
  failed_mfa_attempts: number;
  account_locked: boolean;
  locked_at?: string;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: string;
  user_id: string;
  card_number: string;
  card_type: 'visa' | 'mastercard' | 'amex' | 'discover';
  status: 'active' | 'blocked' | 'expired';
  blocked_at?: string;
  blocked_by?: string;
  region: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  card_id: string;
  user_id: string;
  amount: number;
  currency: string;
  merchant: string;
  merchant_category: string;
  location: string;
  region: string;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'pending' | 'approved' | 'blocked' | 'under_review' | 'confirmed_fraud';
  is_flagged: boolean;
  features?: Record<string, number>;
  processing_time_ms: number;
  created_at: string;
  updated_at: string;
  card?: Card;
}

export interface FraudCase {
  id: string; // FG-YYYYMMDD-XXXX
  transaction_id: string;
  reported_by: string;
  assigned_to?: string;
  status: 'open' | 'investigating' | 'resolved_fraud' | 'resolved_legitimate' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  resolution?: string;
  created_at: string;
  updated_at: string;
  transaction?: Transaction;
  reporter?: UserProfile;
  notes?: CaseNote[];
}

export interface CaseNote {
  id: string;
  case_id: string;
  user_id: string;
  note: string;
  is_customer_visible: boolean;
  created_at: string;
  user?: UserProfile;
}

export interface Alert {
  id: string;
  transaction_id: string;
  user_id: string;
  type: 'push' | 'sms' | 'email';
  title: string;
  message: string;
  status: 'sent' | 'read' | 'confirmed' | 'denied';
  action_taken?: string;
  responded_at?: string;
  created_at: string;
  transaction?: Transaction;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  push_enabled: boolean;
  sms_enabled: boolean;
  email_enabled: boolean;
}

export interface MLModel {
  id: string;
  version: string;
  model_data?: string;
  accuracy: number;
  f1_score: number;
  false_positive_rate: number;
  training_rows: number;
  is_active: boolean;
  trained_by?: string;
  training_started_at?: string;
  training_completed_at?: string;
  rolled_back: boolean;
  rollback_reason?: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  user_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
  ip_address?: string;
  created_at: string;
  user?: UserProfile;
}

export interface LoginAuditEntry {
  id: string;
  user_id?: string;
  email: string;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  failure_reason?: string;
  created_at: string;
}

export interface KPIData {
  total_transactions: number;
  fraud_detection_rate: number;
  false_positive_rate: number;
  alerts_generated: number;
  total_fraud_cases: number;
  avg_risk_score: number;
  blocked_cards: number;
  avg_processing_time_ms: number;
}

export interface DatasetUpload {
  id: string;
  user_id: string;
  file_name: string;
  row_count: number;
  feature_count: number;
  fraud_count: number;
  normal_count: number;
  fraud_rate: number;
  created_at: string;
}
