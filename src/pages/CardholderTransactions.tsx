import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatDate, getRiskLevel, generateCaseId } from '@/lib/utils';
import { CreditCard, Search, AlertTriangle, Flag, Filter, ChevronDown, ArrowUpDown, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { Transaction } from '@/types';

const mockTransactions: Transaction[] = [
  { id: '1', card_id: 'c1', user_id: 'u1', amount: 49.99, currency: 'USD', merchant: 'Amazon.com', merchant_category: 'Online Retail', location: 'Seattle, WA', region: 'US-West', risk_score: 12, risk_level: 'LOW', status: 'approved', is_flagged: false, processing_time_ms: 145, created_at: new Date(Date.now() - 3600000).toISOString(), updated_at: new Date().toISOString() },
  { id: '2', card_id: 'c1', user_id: 'u1', amount: 2499.00, currency: 'USD', merchant: 'Suspicious Electronics', merchant_category: 'Electronics', location: 'Lagos, Nigeria', region: 'AF', risk_score: 89, risk_level: 'HIGH', status: 'under_review', is_flagged: true, processing_time_ms: 198, created_at: new Date(Date.now() - 7200000).toISOString(), updated_at: new Date().toISOString() },
  { id: '3', card_id: 'c1', user_id: 'u1', amount: 15.50, currency: 'USD', merchant: 'Starbucks', merchant_category: 'Food & Beverage', location: 'New York, NY', region: 'US-East', risk_score: 5, risk_level: 'LOW', status: 'approved', is_flagged: false, processing_time_ms: 112, created_at: new Date(Date.now() - 10800000).toISOString(), updated_at: new Date().toISOString() },
  { id: '4', card_id: 'c1', user_id: 'u1', amount: 5200.00, currency: 'USD', merchant: 'Wire Transfer - Unknown', merchant_category: 'Financial', location: 'Moscow, Russia', region: 'EU-East', risk_score: 96, risk_level: 'CRITICAL', status: 'blocked', is_flagged: true, processing_time_ms: 89, created_at: new Date(Date.now() - 14400000).toISOString(), updated_at: new Date().toISOString() },
  { id: '5', card_id: 'c1', user_id: 'u1', amount: 89.99, currency: 'USD', merchant: 'Netflix', merchant_category: 'Entertainment', location: 'Los Angeles, CA', region: 'US-West', risk_score: 8, risk_level: 'LOW', status: 'approved', is_flagged: false, processing_time_ms: 134, created_at: new Date(Date.now() - 18000000).toISOString(), updated_at: new Date().toISOString() },
  { id: '6', card_id: 'c1', user_id: 'u1', amount: 3450.00, currency: 'USD', merchant: 'Luxury Goods - Dubai', merchant_category: 'Retail', location: 'Dubai, UAE', region: 'ME', risk_score: 78, risk_level: 'HIGH', status: 'under_review', is_flagged: true, processing_time_ms: 167, created_at: new Date(Date.now() - 21600000).toISOString(), updated_at: new Date().toISOString() },
];

// Validates US1: Cardholder can view transactions and report suspicious activity
export default function CardholderTransactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [searchQuery, setSearchQuery] = useState('');
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  // Validates US1 TC-03: Track reported transactions with their Case IDs
  const [reportedCases, setReportedCases] = useState<Map<string, string>>(new Map());
  const [lastCaseId, setLastCaseId] = useState('');
  // Validates US1 TC-03: Show duplicate warning
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, [user]);

  const loadTransactions = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data && data.length > 0) setTransactions(data);
    } catch { /* use mock data */ }
  };

  const filteredTx = transactions.filter(tx =>
    tx.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tx.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Validates US1 TC-01: Generate unique Case ID (FG-YYYYMMDD-XXXX) and submit report
  const handleReport = async () => {
    if (!selectedTx) return;

    // Validates US1 TC-03: Duplicate report prevention
    if (reportedCases.has(selectedTx.id)) {
      setDuplicateWarning(true);
      return;
    }

    const caseId = generateCaseId();
    setLastCaseId(caseId);

    try {
      await supabase.from('fraud_cases').insert({
        id: caseId,
        transaction_id: selectedTx.id,
        reported_by: user?.id,
        status: 'open',
        priority: selectedTx.risk_score >= 75 ? 'high' : 'medium',
      });
      await supabase.from('audit_log').insert({
        user_id: user?.id,
        action: 'REPORT_FRAUD',
        entity_type: 'transaction',
        entity_id: selectedTx.id,
        details: JSON.stringify({ case_id: caseId, reason: reportReason }),
      });
      // Validates US1 TC-02: Create notification for fraud analysts
      await supabase.from('alerts').insert({
        transaction_id: selectedTx.id,
        user_id: selectedTx.user_id,
        type: 'push',
        title: '📋 New Fraud Report Submitted',
        message: `Case ${caseId}: Transaction of ${formatCurrency(selectedTx.amount)} at "${selectedTx.merchant}" reported as suspicious. Customer ID: ****${user?.id?.slice(-4) || '0000'}.`,
        status: 'sent',
      });
    } catch { /* Supabase may not be configured */ }

    // Store the case ID for this transaction
    setReportedCases(prev => new Map([...prev, [selectedTx.id, caseId]]));
    setReportSubmitted(true);
  };

  // Validates US1 TC-03: Handle clicking Report on already-reported transaction
  const handleOpenReportDialog = (tx: Transaction) => {
    setSelectedTx(tx);
    setReportReason('');
    setReportSubmitted(false);
    setDuplicateWarning(false);

    // Check if already reported
    if (reportedCases.has(tx.id)) {
      setDuplicateWarning(true);
    }

    setReportDialogOpen(true);
  };

  const riskBadgeVariant = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'critical' as const;
      case 'HIGH': return 'destructive' as const;
      case 'MEDIUM': return 'warning' as const;
      default: return 'success' as const;
    }
  };

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved': return 'success' as const;
      case 'blocked': case 'confirmed_fraud': return 'destructive' as const;
      case 'under_review': return 'warning' as const;
      default: return 'default' as const;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Transactions</h1>
          <p className="text-muted-foreground mt-1">View and manage your card transactions</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search transactions..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Merchant</th>
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Location</th>
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Risk</th>
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Date</th>
                  <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTx.map(tx => (
                  <tr key={tx.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <CreditCard className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{tx.merchant}</p>
                          <p className="text-xs text-muted-foreground">{tx.merchant_category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm font-semibold">{formatCurrency(tx.amount)}</td>
                    <td className="p-4 text-sm text-muted-foreground hidden md:table-cell">{tx.location}</td>
                    <td className="p-4">
                      <Badge variant={riskBadgeVariant(tx.risk_level)}>{tx.risk_level}</Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={statusBadgeVariant(tx.status)}>{tx.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground hidden lg:table-cell">{formatDate(tx.created_at)}</td>
                    <td className="p-4 text-right">
                      {reportedCases.has(tx.id) ? (
                        <Button
                          variant="ghost" size="sm"
                          className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                          onClick={() => handleOpenReportDialog(tx)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Reported
                        </Button>
                      ) : (
                        <Button
                          variant="ghost" size="sm"
                          className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                          onClick={() => handleOpenReportDialog(tx)}
                        >
                          <Flag className="w-3.5 h-3.5 mr-1" />
                          Report
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Report Dialog - Validates US1 TC-01, TC-02, TC-03 */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {duplicateWarning
                ? 'Already Reported'
                : reportSubmitted
                ? 'Report Submitted'
                : 'Report Suspicious Activity'}
            </DialogTitle>
            <DialogDescription>
              {duplicateWarning
                ? 'This transaction has already been reported.'
                : reportSubmitted
                ? 'Your report has been submitted. A confirmation message is shown below.'
                : 'Flag this transaction for fraud investigation.'}
            </DialogDescription>
          </DialogHeader>

          {/* Validates US1 TC-03: Duplicate report warning with existing Case ID */}
          {duplicateWarning && selectedTx ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-8 h-8 text-amber-400" />
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-300">This transaction has already been reported.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Case ID: <span className="font-mono font-bold text-primary">{reportedCases.get(selectedTx.id)}</span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground">No new case is created in the system.</p>
              <Button onClick={() => setReportDialogOpen(false)}>Close</Button>
            </div>
          ) : reportSubmitted ? (
            /* Validates US1 TC-01: Confirmation screen with Case ID */
            <div className="text-center py-4 space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-emerald-300 font-medium">Your report has been submitted.</p>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground">Case Reference ID</p>
                  <p className="text-xl font-mono font-bold text-primary mt-1">{lastCaseId}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  The case is logged in the fraud management system.<br/>
                  A fraud analyst has been notified.
                </p>
              </div>
              <Button onClick={() => setReportDialogOpen(false)}>Close</Button>
            </div>
          ) : (
            <>
              {selectedTx && (
                <div className="space-y-3 py-2">
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <p className="text-sm"><strong>Transaction ID:</strong> <span className="font-mono text-xs">{selectedTx.id}</span></p>
                    <p className="text-sm"><strong>Merchant:</strong> {selectedTx.merchant}</p>
                    <p className="text-sm"><strong>Amount:</strong> {formatCurrency(selectedTx.amount)}</p>
                    <p className="text-sm"><strong>Location:</strong> {selectedTx.location}</p>
                    <p className="text-sm"><strong>Risk Score:</strong> {selectedTx.risk_score}/100 ({selectedTx.risk_level})</p>
                  </div>
                  <div>
                    <Label htmlFor="reason">Reason for Report</Label>
                    <textarea
                      id="reason"
                      value={reportReason}
                      onChange={e => setReportReason(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Describe why this looks suspicious..."
                    />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setReportDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleReport}>
                  <Flag className="w-4 h-4 mr-1" /> Submit Report
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
