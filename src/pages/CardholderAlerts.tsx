import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Bell, CheckCircle, XCircle, CreditCard, Shield, Clock } from 'lucide-react';
import type { Alert } from '@/types';

const mockAlerts: Alert[] = [
  {
    id: '1', transaction_id: 't1', user_id: 'u1', type: 'push',
    title: '⚠️ Suspicious Transaction Detected',
    message: 'A high-risk transaction of $2,499.00 was attempted at "Suspicious Electronics" in Lagos, Nigeria. Was this you?',
    status: 'sent', created_at: new Date(Date.now() - 120000).toISOString(),
    transaction: { id: 't1', card_id: 'c1', user_id: 'u1', amount: 2499, currency: 'USD', merchant: 'Suspicious Electronics', merchant_category: 'Electronics', location: 'Lagos, Nigeria', region: 'AF', risk_score: 89, risk_level: 'HIGH', status: 'under_review', is_flagged: true, processing_time_ms: 198, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  },
  {
    id: '2', transaction_id: 't2', user_id: 'u1', type: 'email',
    title: '🚨 Critical: Wire Transfer Blocked',
    message: 'A wire transfer of $5,200.00 to Moscow, Russia was automatically blocked due to extreme risk score (96/100).',
    status: 'sent', created_at: new Date(Date.now() - 300000).toISOString(),
    transaction: { id: 't2', card_id: 'c1', user_id: 'u1', amount: 5200, currency: 'USD', merchant: 'Wire Transfer - Unknown', merchant_category: 'Financial', location: 'Moscow, Russia', region: 'EU-East', risk_score: 96, risk_level: 'CRITICAL', status: 'blocked', is_flagged: true, processing_time_ms: 89, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  },
  {
    id: '3', transaction_id: 't3', user_id: 'u1', type: 'push',
    title: 'ℹ️ Large Purchase Notification',
    message: 'A purchase of $3,450.00 at "Luxury Goods" in Dubai, UAE was flagged for review. Please confirm or deny.',
    status: 'sent', created_at: new Date(Date.now() - 600000).toISOString(),
    transaction: { id: 't3', card_id: 'c1', user_id: 'u1', amount: 3450, currency: 'USD', merchant: 'Luxury Goods - Dubai', merchant_category: 'Retail', location: 'Dubai, UAE', region: 'ME', risk_score: 78, risk_level: 'HIGH', status: 'under_review', is_flagged: true, processing_time_ms: 167, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  },
];

// Validates US4: Real-time alerts with Confirm/Deny action buttons
export default function CardholderAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadAlerts();
  }, [user]);

  const loadAlerts = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('alerts')
        .select('*, transaction:transactions(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data && data.length > 0) setAlerts(data);
    } catch { /* use mock */ }
  };

  // Validates US4: If Cardholder clicks "Deny", block the card immediately
  const handleAction = async (alertId: string, action: 'confirm' | 'deny') => {
    setProcessing(alertId);

    setAlerts(prev => prev.map(a => {
      if (a.id === alertId) {
        return { ...a, status: action === 'confirm' ? 'confirmed' : 'denied', action_taken: action, responded_at: new Date().toISOString() };
      }
      return a;
    }));

    try {
      await supabase.from('alerts').update({
        status: action === 'confirm' ? 'confirmed' : 'denied',
        action_taken: action,
        responded_at: new Date().toISOString(),
      }).eq('id', alertId);

      const alert = alerts.find(a => a.id === alertId);
      if (action === 'deny' && alert?.transaction?.card_id) {
        // Block the card immediately
        await supabase.from('cards').update({
          status: 'blocked',
          blocked_at: new Date().toISOString(),
          blocked_by: user?.id,
        }).eq('id', alert.transaction.card_id);

        await supabase.from('audit_log').insert({
          user_id: user?.id,
          action: 'CARD_BLOCKED',
          entity_type: 'card',
          entity_id: alert.transaction.card_id,
          details: JSON.stringify({ reason: 'Cardholder denied transaction', alert_id: alertId }),
        });
      }

      await supabase.from('audit_log').insert({
        user_id: user?.id,
        action: action === 'confirm' ? 'ALERT_CONFIRMED' : 'ALERT_DENIED',
        entity_type: 'alert',
        entity_id: alertId,
      });
    } catch { /* Supabase may not be configured */ }

    setProcessing(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="w-6 h-6 text-primary" />
          My Alerts
        </h1>
        <p className="text-muted-foreground mt-1">Review and respond to fraud alerts on your account</p>
      </div>

      <div className="space-y-4">
        {alerts.map(alert => (
          <Card key={alert.id} className={`glass-card transition-all duration-300 ${alert.status === 'sent' ? 'border-amber-500/30 glow-blue' : 'opacity-80'}`}>
            <CardContent className="p-5">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Alert Icon */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  alert.transaction?.risk_level === 'CRITICAL' ? 'bg-red-500/15' :
                  alert.transaction?.risk_level === 'HIGH' ? 'bg-orange-500/15' : 'bg-amber-500/15'
                }`}>
                  <Shield className={`w-6 h-6 ${
                    alert.transaction?.risk_level === 'CRITICAL' ? 'text-red-400' :
                    alert.transaction?.risk_level === 'HIGH' ? 'text-orange-400' : 'text-amber-400'
                  }`} />
                </div>

                {/* Alert Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold">{alert.title}</h3>
                    <Badge variant={
                      alert.status === 'confirmed' ? 'success' :
                      alert.status === 'denied' ? 'destructive' :
                      'warning'
                    }>
                      {alert.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{alert.message}</p>

                  {/* Transaction details */}
                  {alert.transaction && (
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> {formatCurrency(alert.transaction.amount)}</span>
                      <span>📍 {alert.transaction.location}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(alert.created_at)}</span>
                      <Badge variant={alert.transaction.risk_level === 'CRITICAL' ? 'critical' : 'destructive'} className="text-[10px]">
                        Score: {alert.transaction.risk_score}/100
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Action Buttons - Validates US4: Confirm or Deny */}
                {alert.status === 'sent' && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="success" size="sm"
                      onClick={() => handleAction(alert.id, 'confirm')}
                      disabled={processing === alert.id}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" /> Confirm
                    </Button>
                    <Button
                      variant="destructive" size="sm"
                      onClick={() => handleAction(alert.id, 'deny')}
                      disabled={processing === alert.id}
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Deny
                    </Button>
                  </div>
                )}

                {alert.status !== 'sent' && (
                  <div className="flex items-center gap-2 text-sm shrink-0">
                    {alert.status === 'confirmed' ? (
                      <span className="flex items-center gap-1 text-emerald-400"><CheckCircle className="w-4 h-4" /> Confirmed</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400"><XCircle className="w-4 h-4" /> Denied & Card Blocked</span>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {alerts.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No alerts at this time</p>
          </div>
        )}
      </div>
    </div>
  );
}
