import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';
import Dashboard from '@/pages/Dashboard';
import CardholderTransactions from '@/pages/CardholderTransactions';
import CardholderAlerts from '@/pages/CardholderAlerts';
import AnalystDashboard from '@/pages/AnalystDashboard';
import KPIDashboard from '@/pages/KPIDashboard';
import SupportDashboard from '@/pages/SupportDashboard';
import MLPipeline from '@/pages/MLPipeline';
import UserManagement from '@/pages/UserManagement';
import AuditLog from '@/pages/AuditLog';
import NotificationPreferences from '@/pages/NotificationPreferences';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
  },
});

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading FraudGuard...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Protected routes with role-based layout */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        {/* Dashboard — accessible to all roles */}
        <Route index element={<Dashboard />} />

        {/* Cardholder routes - Validates US1, US4 */}
        <Route path="transactions" element={
          <ProtectedRoute roles={['cardholder']}><CardholderTransactions /></ProtectedRoute>
        } />
        <Route path="alerts" element={
          <ProtectedRoute roles={['cardholder']}><CardholderAlerts /></ProtectedRoute>
        } />
        <Route path="notifications" element={
          <ProtectedRoute roles={['cardholder']}><NotificationPreferences /></ProtectedRoute>
        } />

        {/* Analyst routes - Validates US2, FraudCaseHandling */}
        <Route path="analyst" element={
          <ProtectedRoute roles={['fraud_analyst']}><AnalystDashboard /></ProtectedRoute>
        } />

        {/* Case management - Validates FraudCaseHandling */}
        <Route path="cases" element={
          <ProtectedRoute roles={['fraud_analyst', 'risk_manager']}><SupportDashboard /></ProtectedRoute>
        } />

        {/* Support - shared access */}
        <Route path="support" element={
          <ProtectedRoute roles={['fraud_analyst', 'risk_manager', 'bank_admin']}><SupportDashboard /></ProtectedRoute>
        } />

        {/* KPI Dashboard - Validates US3 */}
        <Route path="kpi" element={
          <ProtectedRoute roles={['bank_admin', 'risk_manager', 'fraud_analyst', 'compliance_officer']}><KPIDashboard /></ProtectedRoute>
        } />

        {/* Reports (reuses KPI for filtering + export) - Validates US3 */}
        <Route path="reports" element={
          <ProtectedRoute roles={['bank_admin', 'risk_manager']}><KPIDashboard /></ProtectedRoute>
        } />

        {/* ML Pipeline - Validates US6, US8 */}
        <Route path="ml" element={
          <ProtectedRoute roles={['it_security_admin', 'risk_manager', 'bank_admin']}><MLPipeline /></ProtectedRoute>
        } />

        {/* User Management - Validates US7 */}
        <Route path="users" element={
          <ProtectedRoute roles={['bank_admin', 'it_security_admin']}><UserManagement /></ProtectedRoute>
        } />

        {/* Audit Log - Validates US5, US7 */}
        <Route path="audit" element={
          <ProtectedRoute roles={['compliance_officer', 'it_security_admin']}><AuditLog /></ProtectedRoute>
        } />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
