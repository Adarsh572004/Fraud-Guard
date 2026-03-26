import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ShieldAlert, CheckCircle, XCircle, ArrowDown, Clock, AlertTriangle, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { Transaction } from '@/types';

const mockQueue: (Transaction & { card_number?: string })[] = [
  { id: 't1', card_id: 'c1', user_id: 'u1', amount: 5200, currency: 'USD', merchant: 'Wire Transfer - Unknown', merchant_category: 'Financial', location: 'Moscow, Russia', region: 'EU-East', risk_score: 96, risk_level: 'CRITICAL', status: 'under_review', is_flagged: true, processing_time_ms: 89, created_at: new Date(Date.now() - 600000).toISOString(), updated_at: new Date().toISOString(), card_number: '****1234' },
  { id: 't2', card_id: 'c2', user_id: 'u2', amount: 2499, currency: 'USD', merchant: 'Suspicious Electronics', merchant_category: 'Electronics', location: 'Lagos, Nigeria', region: 'AF', risk_score: 89, risk_level: 'HIGH', status: 'under_review', is_flagged: true, processing_time_ms: 198, created_at: new Date(Date.now() - 1200000).toISOString(), updated_at: new Date().toISOString(), card_number: '****5678' },
  { id: 't3', card_id: 'c3', user_id: 'u3', amount: 3450, currency: 'USD', merchant: 'Luxury Goods - Dubai', merchant_category: 'Retail', location: 'Dubai, UAE', region: 'ME', risk_score: 78, risk_level: 'HIGH', status: 'under_review', is_flagged: true, processing_time_ms: 167, created_at: new Date(Date.now() - 1800000).toISOString(), updated_at: new Date().toISOString(), card_number: '****9012' },
  { id: 't4', card_id: 'c4', user_id: 'u4', amount: 1850, currency: 'USD', merchant: 'Crypto Exchange', merchant_category: 'Financial', location: 'Cayman Islands', region: 'CARIB', risk_score: 76, risk_level: 'HIGH', status: 'under_review', is_flagged: true, processing_time_ms: 145, created_at: new Date(Date.now() - 2400000).toISOString(), updated_at: new Date().toISOString(), card_number: '****3456' },
  { id: 't5', card_id: 'c5', user_id: 'u5', amount: 950, currency: 'USD', merchant: 'Online Gambling Site', merchant_category: 'Gaming', location: 'Malta', region: 'EU', risk_score: 68, risk_level: 'MEDIUM', status: 'under_review', is_flagged: true, processing_time_ms: 201, created_at: new Date(Date.now() - 3000000).toISOString(), updated_at: new Date().toISOString(), card_number: '****7890' },
];

// Validates US2: Analyst Dashboard with queue sorted by risk score (descending)
export default function AnalystDashboard() {
  const { user } = useAuth();
  const [queue, setQueue] = useState(mockQueue);
  const [reviewDialog, setReviewDialog] = useState(false);
  const [selectedTx, setSelectedTx] = useState<(typeof mockQueue)[0] | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => { loadQueue(); }, []);

  const loadQueue = async () => {
    try {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('is_flagged', true)
        .in('status', ['under_review', 'pending'])
        .order('risk_score', { ascending: false }); // Validates US2: sorted by risk score DESC
      if (data && data.length > 0) setQueue(data);
    } catch { /* use mock */ }
  };

  // Validates US2: Allow Analysts to "Approve" or "Block" transactions
  const handleDecision = async (decision: 'approved' | 'blocked') => {
    if (!selectedTx) return;
    setProcessing(true);

    setQueue(prev => prev.map(t =>
      t.id === selectedTx.id ? { ...t, status: decision } : t
    ));

    try {
      await supabase.from('transactions').update({ status: decision, updated_at: new Date().toISOString() }).eq('id', selectedTx.id);

      // Validates US2: If analyst confirms fraud, block the card and notify cardholder
      if (decision === 'blocked') {
        await supabase.from('cards').update({
          status: 'blocked', blocked_at: new Date().toISOString(), blocked_by: user?.id,
        }).eq('id', selectedTx.card_id);

        await supabase.from('alerts').insert({
          transaction_id: selectedTx.id, user_id: selectedTx.user_id, type: 'push',
          title: '🚨 Card Blocked — Fraud Confirmed',
          message: `Your card ending in ${selectedTx.card_number?.slice(-4) || '****'} has been blocked after a fraud analyst confirmed suspicious activity on a ${formatCurrency(selectedTx.amount)} transaction.`,
          status: 'sent',
        });
      }

      // Validates US2: Logging decisions in audit trail is mandatory
      await supabase.from('audit_log').insert({
        user_id: user?.id, action: decision === 'approved' ? 'APPROVE_TRANSACTION' : 'BLOCK_TRANSACTION',
        entity_type: 'transaction', entity_id: selectedTx.id,
        details: JSON.stringify({ decision, notes: reviewNotes, risk_score: selectedTx.risk_score }),
      });
    } catch { /* Supabase may not be configured */ }

    setProcessing(false);
    setReviewDialog(false);
    setReviewNotes('');
  };

  const pendingCount = queue.filter(t => t.status === 'under_review' || t.status === 'pending').length;
  const riskIcon = (level: string) => {
    const colors: Record<string, string> = { CRITICAL: 'text-red-400 bg-red-500/15', HIGH: 'text-orange-400 bg-orange-500/15', MEDIUM: 'text-amber-400 bg-amber-500/15' };
    return colors[level] || 'text-gray-400 bg-gray-500/15';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-400" /> Analyst Review Queue
          </h1>
          <p className="text-muted-foreground mt-1">{pendingCount} flagged transactions pending review</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowDown className="w-4 h-4" /> Sorted by risk score (highest first)
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Pending Review</p>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{queue.filter(t => t.risk_level === 'CRITICAL').length}</p>
          <p className="text-xs text-muted-foreground mt-1">Critical Risk</p>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{queue.filter(t => t.status === 'approved').length}</p>
          <p className="text-xs text-muted-foreground mt-1">Approved Today</p>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{queue.filter(t => t.status === 'blocked').length}</p>
          <p className="text-xs text-muted-foreground mt-1">Blocked Today</p>
        </CardContent></Card>
      </div>

      {/* Queue */}
      <div className="space-y-3">
        {queue.map((tx, i) => (
          <Card key={tx.id} className={`glass-card transition-all duration-300 hover:border-primary/20 ${tx.status !== 'under_review' && tx.status !== 'pending' ? 'opacity-60' : ''}`} style={{ animationDelay: `${i * 50}ms` }}>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Risk Score Circle */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center ${riskIcon(tx.risk_level)}`}>
                    <span className="text-lg font-bold">{tx.risk_score}</span>
                    <span className="text-[9px] uppercase tracking-wider opacity-70">Risk</span>
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Merchant</p>
                    <p className="text-sm font-medium truncate">{tx.merchant}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="text-sm font-semibold">{formatCurrency(tx.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm truncate">{tx.location}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Card / Time</p>
                    <p className="text-sm">{tx.card_number} • {formatDate(tx.created_at)}</p>
                  </div>
                </div>

                {/* Status / Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {tx.status === 'under_review' || tx.status === 'pending' ? (
                    <Button size="sm" onClick={() => { setSelectedTx(tx); setReviewDialog(true); setReviewNotes(''); }}>
                      <Eye className="w-4 h-4 mr-1" /> Review
                    </Button>
                  ) : (
                    <Badge variant={tx.status === 'approved' ? 'success' : 'destructive'}>
                      {tx.status === 'approved' ? <><CheckCircle className="w-3 h-3 mr-1" /> Approved</> : <><XCircle className="w-3 h-3 mr-1" /> Blocked</>}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Transaction</DialogTitle>
            <DialogDescription>Examine the details and make a decision</DialogDescription>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-secondary/30">
                  <p className="text-xs text-muted-foreground">Risk Score</p>
                  <p className="text-2xl font-bold">{selectedTx.risk_score}<span className="text-sm text-muted-foreground">/100</span></p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30">
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-2xl font-bold">{formatCurrency(selectedTx.amount)}</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30 space-y-1 text-sm">
                <p><strong>Merchant:</strong> {selectedTx.merchant} ({selectedTx.merchant_category})</p>
                <p><strong>Location:</strong> {selectedTx.location}</p>
                <p><strong>Region:</strong> {selectedTx.region}</p>
                <p><strong>Card:</strong> {selectedTx.card_number}</p>
                <p><strong>Processing Time:</strong> {selectedTx.processing_time_ms}ms</p>
              </div>
              <div>
                <Label htmlFor="notes">Review Notes</Label>
                <textarea
                  id="notes" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Add review notes..."
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="success" onClick={() => handleDecision('approved')} disabled={processing}>
              <CheckCircle className="w-4 h-4 mr-1" /> Approve
            </Button>
            <Button variant="destructive" onClick={() => handleDecision('blocked')} disabled={processing}>
              <XCircle className="w-4 h-4 mr-1" /> Block & Flag Fraud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
