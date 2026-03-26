import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Headphones, Search, MessageSquare, Clock, User, Send, FileText } from 'lucide-react';
import type { FraudCase, CaseNote } from '@/types';

const mockCases: FraudCase[] = [
  { id: 'FG-20260325-0042', transaction_id: 't1', reported_by: 'u1', assigned_to: 'u2', status: 'investigating', priority: 'high', created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date().toISOString(), notes: [
    { id: 'n1', case_id: 'FG-20260325-0042', user_id: 'u2', note: 'Investigating the wire transfer origin. Pattern matches known fraud ring in Eastern Europe.', is_customer_visible: false, created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 'n2', case_id: 'FG-20260325-0042', user_id: 'u2', note: 'We are investigating this transaction. You will be notified of our findings.', is_customer_visible: true, created_at: new Date(Date.now() - 7200000).toISOString() },
  ]},
  { id: 'FG-20260324-0018', transaction_id: 't2', reported_by: 'u3', status: 'open', priority: 'medium', created_at: new Date(Date.now() - 172800000).toISOString(), updated_at: new Date().toISOString(), notes: [] },
  { id: 'FG-20260323-0007', transaction_id: 't3', reported_by: 'u4', assigned_to: 'u2', status: 'resolved_fraud', priority: 'critical', resolution: 'Confirmed fraudulent transaction. Card blocked and refund processed.', created_at: new Date(Date.now() - 259200000).toISOString(), updated_at: new Date().toISOString(), notes: [] },
];

// Validates FraudCaseHandling: Support Dashboard for case management
export default function SupportDashboard() {
  const { user } = useAuth();
  const [cases, setCases] = useState<FraudCase[]>(mockCases);
  const [searchId, setSearchId] = useState('');
  const [selectedCase, setSelectedCase] = useState<FraudCase | null>(null);
  const [newNote, setNewNote] = useState('');
  const [noteVisible, setNoteVisible] = useState(true);
  const [statusUpdate, setStatusUpdate] = useState('');

  const handleSearch = () => {
    const found = cases.find(c => c.id.toLowerCase().includes(searchId.toLowerCase()));
    setSelectedCase(found || null);
  };

  const handleAddNote = async () => {
    if (!selectedCase || !newNote.trim()) return;
    const note: CaseNote = {
      id: `n-${Date.now()}`, case_id: selectedCase.id, user_id: user?.id || '',
      note: newNote, is_customer_visible: noteVisible, created_at: new Date().toISOString(),
    };
    const updatedCase = { ...selectedCase, notes: [...(selectedCase.notes || []), note] };
    setSelectedCase(updatedCase);
    setCases(prev => prev.map(c => c.id === selectedCase.id ? updatedCase : c));
    setNewNote('');

    try {
      await supabase.from('case_notes').insert({
        case_id: selectedCase.id, user_id: user?.id, note: newNote, is_customer_visible: noteVisible,
      });
      // Validates FraudCaseHandling: Status update triggers automated email
      await supabase.from('audit_log').insert({
        user_id: user?.id, action: 'CASE_NOTE_ADDED', entity_type: 'case', entity_id: selectedCase.id,
        details: JSON.stringify({ visible_to_customer: noteVisible }),
      });
    } catch { /* Supabase may not be configured */ }
  };

  // Validates FraudCaseHandling: Update case status (triggers automated email)
  const handleStatusUpdate = async () => {
    if (!selectedCase || !statusUpdate) return;
    const updated = { ...selectedCase, status: statusUpdate as FraudCase['status'], updated_at: new Date().toISOString() };
    setSelectedCase(updated);
    setCases(prev => prev.map(c => c.id === selectedCase.id ? updated : c));
    try {
      await supabase.from('fraud_cases').update({ status: statusUpdate, updated_at: new Date().toISOString() }).eq('id', selectedCase.id);
      await supabase.from('audit_log').insert({
        user_id: user?.id, action: 'CASE_STATUS_UPDATED', entity_type: 'case', entity_id: selectedCase.id,
        details: JSON.stringify({ new_status: statusUpdate }),
      });
    } catch { /* */ }
  };

  const priorityVariant = (p: string) => {
    switch (p) { case 'critical': return 'critical' as const; case 'high': return 'destructive' as const; case 'medium': return 'warning' as const; default: return 'default' as const; }
  };
  const statusVariant = (s: string) => {
    switch (s) { case 'resolved_fraud': case 'resolved_legitimate': case 'closed': return 'success' as const; case 'investigating': return 'warning' as const; default: return 'default' as const; }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Headphones className="w-6 h-6 text-primary" /> Support Center</h1>
        <p className="text-muted-foreground mt-1">Look up fraud cases and manage customer communications</p>
      </div>

      {/* Search */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by Case ID (e.g., FG-20260325-0042)" value={searchId} onChange={e => setSearchId(e.target.value)} className="pl-10" onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
            <Button onClick={handleSearch}><Search className="w-4 h-4 mr-1" /> Search</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Case List */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">All Cases</h2>
          {cases.map(c => (
            <Card key={c.id} className={`glass-card cursor-pointer hover:border-primary/30 transition-all ${selectedCase?.id === c.id ? 'border-primary/50 glow-blue' : ''}`} onClick={() => { setSelectedCase(c); setStatusUpdate(c.status); }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-mono font-bold text-primary">{c.id}</span>
                  <Badge variant={priorityVariant(c.priority)}>{c.priority}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant={statusVariant(c.status)} className="text-xs">{c.status.replace('_', ' ')}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(c.created_at)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Case Details */}
        <div className="lg:col-span-2">
          {selectedCase ? (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="font-mono">{selectedCase.id}</span>
                  <div className="flex gap-2">
                    <Badge variant={priorityVariant(selectedCase.priority)}>{selectedCase.priority}</Badge>
                    <Badge variant={statusVariant(selectedCase.status)}>{selectedCase.status.replace('_', ' ')}</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Created:</span> {formatDate(selectedCase.created_at)}</div>
                  <div><span className="text-muted-foreground">Updated:</span> {formatDate(selectedCase.updated_at)}</div>
                  {selectedCase.resolution && <div className="col-span-2"><span className="text-muted-foreground">Resolution:</span> {selectedCase.resolution}</div>}
                </div>

                {/* Status Update */}
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Label>Update Status</Label>
                    <Select value={statusUpdate} onValueChange={setStatusUpdate}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="investigating">Investigating</SelectItem>
                        <SelectItem value="resolved_fraud">Resolved - Fraud</SelectItem>
                        <SelectItem value="resolved_legitimate">Resolved - Legitimate</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleStatusUpdate} size="sm">Update</Button>
                </div>

                {/* Case Notes / History */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Case History</h3>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {(selectedCase.notes || []).map(note => (
                      <div key={note.id} className="p-3 rounded-lg bg-secondary/30">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Agent</span>
                            {note.is_customer_visible && <Badge variant="default" className="text-[9px]">Visible to customer</Badge>}
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDate(note.created_at)}</span>
                        </div>
                        <p className="text-sm">{note.note}</p>
                      </div>
                    ))}
                    {(selectedCase.notes || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>}
                  </div>
                </div>

                {/* Add Note */}
                <div className="space-y-2 border-t border-border/50 pt-4">
                  <Label>Add Note</Label>
                  <textarea value={newNote} onChange={e => setNewNote(e.target.value)} className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Type your response..." />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={noteVisible} onChange={e => setNoteVisible(e.target.checked)} className="rounded" />
                      Visible to customer (sends email)
                    </label>
                    <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim()}><Send className="w-4 h-4 mr-1" /> Send</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <FileText className="w-12 h-12 mb-3 opacity-30" />
              <p>Select a case or search by Case ID</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
