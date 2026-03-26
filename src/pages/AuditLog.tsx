import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import { ScrollText, Search, Filter, Shield, User, CreditCard, Brain, Bell, Lock, FileText } from 'lucide-react';
import type { AuditLogEntry } from '@/types';

const mockAuditLog: AuditLogEntry[] = [
  { id: '1', user_id: 'u1', action: 'LOGIN', entity_type: 'user', entity_id: 'u1', details: '{"method":"password+mfa"}', ip_address: '192.168.1.10', created_at: new Date(Date.now() - 300000).toISOString() },
  { id: '2', user_id: 'u2', action: 'APPROVE_TRANSACTION', entity_type: 'transaction', entity_id: 't5', details: '{"decision":"approved","risk_score":45}', ip_address: '10.0.0.5', created_at: new Date(Date.now() - 600000).toISOString() },
  { id: '3', user_id: 'u2', action: 'BLOCK_TRANSACTION', entity_type: 'transaction', entity_id: 't2', details: '{"decision":"blocked","risk_score":89}', ip_address: '10.0.0.5', created_at: new Date(Date.now() - 900000).toISOString() },
  { id: '4', user_id: 'u4', action: 'ROLE_CHANGE', entity_type: 'user', entity_id: 'u3', details: '{"old_role":"fraud_analyst","new_role":"risk_manager"}', ip_address: '10.0.0.1', created_at: new Date(Date.now() - 1200000).toISOString() },
  { id: '5', user_id: 'u1', action: 'REPORT_FRAUD', entity_type: 'transaction', entity_id: 't4', details: '{"case_id":"FG-20260325-0042"}', ip_address: '192.168.1.10', created_at: new Date(Date.now() - 1800000).toISOString() },
  { id: '6', user_id: 'u6', action: 'MODEL_RETRAINED', entity_type: 'model', entity_id: 'm1', details: '{"accuracy":0.947,"f1":0.923,"fpr":0.023}', ip_address: '10.0.0.2', created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: '7', user_id: 'u4', action: 'ACCOUNT_LOCKED', entity_type: 'user', entity_id: 'u6', details: '{"reason":"3 failed MFA attempts"}', ip_address: '10.0.0.1', created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: '8', user_id: 'u1', action: 'CARD_BLOCKED', entity_type: 'card', entity_id: 'c1', details: '{"reason":"Cardholder denied transaction"}', ip_address: '192.168.1.10', created_at: new Date(Date.now() - 10800000).toISOString() },
  { id: '9', user_id: 'u2', action: 'CASE_STATUS_UPDATED', entity_type: 'case', entity_id: 'FG-20260323-0007', details: '{"new_status":"resolved_fraud"}', ip_address: '10.0.0.5', created_at: new Date(Date.now() - 14400000).toISOString() },
  { id: '10', user_id: 'u5', action: 'LOGOUT', entity_type: 'user', entity_id: 'u5', ip_address: '10.0.0.3', created_at: new Date(Date.now() - 18000000).toISOString() },
];

const actionIcons: Record<string, React.ElementType> = {
  LOGIN: User, LOGOUT: User, APPROVE_TRANSACTION: CreditCard, BLOCK_TRANSACTION: Shield,
  ROLE_CHANGE: Lock, REPORT_FRAUD: FileText, MODEL_RETRAINED: Brain, ACCOUNT_LOCKED: Lock,
  CARD_BLOCKED: CreditCard, MFA_VERIFIED: Shield, CASE_STATUS_UPDATED: FileText, CASE_NOTE_ADDED: FileText,
  ALERT_CONFIRMED: Bell, ALERT_DENIED: Bell, ACCOUNT_UNLOCKED: Lock, USER_REGISTERED: User, MODEL_ROLLBACK: Brain,
};

const actionColors: Record<string, string> = {
  LOGIN: 'text-emerald-400 bg-emerald-500/10', LOGOUT: 'text-gray-400 bg-gray-500/10',
  APPROVE_TRANSACTION: 'text-emerald-400 bg-emerald-500/10', BLOCK_TRANSACTION: 'text-red-400 bg-red-500/10',
  ROLE_CHANGE: 'text-purple-400 bg-purple-500/10', REPORT_FRAUD: 'text-amber-400 bg-amber-500/10',
  MODEL_RETRAINED: 'text-blue-400 bg-blue-500/10', ACCOUNT_LOCKED: 'text-red-400 bg-red-500/10',
  CARD_BLOCKED: 'text-red-400 bg-red-500/10', CASE_STATUS_UPDATED: 'text-cyan-400 bg-cyan-500/10',
  ALERT_DENIED: 'text-red-400 bg-red-500/10', ALERT_CONFIRMED: 'text-emerald-400 bg-emerald-500/10',
  ACCOUNT_UNLOCKED: 'text-emerald-400 bg-emerald-500/10', MODEL_ROLLBACK: 'text-amber-400 bg-amber-500/10',
};

// Validates US7: Immutable system audit log
export default function AuditLog() {
  const [logs, setLogs] = useState(mockAuditLog);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const { data } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100);
      if (data && data.length > 0) setLogs(data);
    } catch { /* use mock */ }
  };

  const uniqueActions = [...new Set(logs.map(l => l.action))];

  const filteredLogs = logs.filter(l => {
    if (actionFilter !== 'all' && l.action !== actionFilter) return false;
    if (search && !l.action.toLowerCase().includes(search.toLowerCase()) && !l.entity_id?.toLowerCase().includes(search.toLowerCase()) && !l.details?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ScrollText className="w-6 h-6 text-primary" /> Audit Log</h1>
        <p className="text-muted-foreground mt-1">Immutable record of all system actions — read only</p>
      </div>

      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search actions, entities..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-48"><Filter className="w-3.5 h-3.5 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map(a => <SelectItem key={a} value={a}>{a.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="p-0">
          <div className="divide-y divide-border/30">
            {filteredLogs.map((log, i) => {
              const Icon = actionIcons[log.action] || Shield;
              const color = actionColors[log.action] || 'text-gray-400 bg-gray-500/10';
              let details: Record<string, any> = {};
              try { details = JSON.parse(log.details || '{}'); } catch {}

              return (
                <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-secondary/20 transition-colors" style={{ animationDelay: `${i * 30}ms` }}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{log.action.replace(/_/g, ' ')}</span>
                      {log.entity_type && <Badge variant="secondary" className="text-[10px]">{log.entity_type}</Badge>}
                      {log.entity_id && <span className="text-xs text-muted-foreground font-mono">{log.entity_id}</span>}
                    </div>
                    {Object.keys(details).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono truncate">{JSON.stringify(details)}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{formatDate(log.created_at)}</span>
                      {log.ip_address && <span>IP: {log.ip_address}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
