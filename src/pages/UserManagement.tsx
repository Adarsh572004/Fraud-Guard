import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';
import { Users, Shield, Edit, UserCheck, UserX, Lock } from 'lucide-react';
import type { UserProfile, UserRole } from '@/types';

const mockUsers: UserProfile[] = [
  { id: '1', email: 'alice@fraudguard.com', full_name: 'Alice Johnson', role: 'cardholder', mfa_enabled: true, failed_mfa_attempts: 0, account_locked: false, last_login: new Date(Date.now() - 3600000).toISOString(), created_at: '2025-01-15', updated_at: new Date().toISOString() },
  { id: '2', email: 'bob@fraudguard.com', full_name: 'Bob Martinez', role: 'fraud_analyst', mfa_enabled: true, failed_mfa_attempts: 0, account_locked: false, last_login: new Date(Date.now() - 1800000).toISOString(), created_at: '2025-02-20', updated_at: new Date().toISOString() },
  { id: '3', email: 'carol@fraudguard.com', full_name: 'Carol Chen', role: 'risk_manager', mfa_enabled: true, failed_mfa_attempts: 0, account_locked: false, last_login: new Date(Date.now() - 7200000).toISOString(), created_at: '2025-03-10', updated_at: new Date().toISOString() },
  { id: '4', email: 'david@fraudguard.com', full_name: 'David Smith', role: 'bank_admin', mfa_enabled: true, failed_mfa_attempts: 0, account_locked: false, last_login: new Date(Date.now() - 900000).toISOString(), created_at: '2025-01-01', updated_at: new Date().toISOString() },
  { id: '5', email: 'eva@fraudguard.com', full_name: 'Eva Williams', role: 'compliance_officer', mfa_enabled: false, failed_mfa_attempts: 0, account_locked: false, last_login: new Date(Date.now() - 14400000).toISOString(), created_at: '2025-04-05', updated_at: new Date().toISOString() },
  { id: '6', email: 'frank@fraudguard.com', full_name: 'Frank Brown', role: 'it_security_admin', mfa_enabled: true, failed_mfa_attempts: 3, account_locked: true, locked_at: new Date(Date.now() - 86400000).toISOString(), last_login: new Date(Date.now() - 86400000).toISOString(), created_at: '2025-01-10', updated_at: new Date().toISOString() },
];

// Validates US7: User Management with role changes
export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>(mockUsers);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('cardholder');

  const handleRoleChange = async () => {
    if (!selectedUser) return;
    setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, role: newRole } : u));
    try {
      await supabase.from('profiles').update({ role: newRole }).eq('id', selectedUser.id);
      // Validates US7: Admin role changes tracked in audit log
      await supabase.from('audit_log').insert({
        user_id: currentUser?.id, action: 'ROLE_CHANGE', entity_type: 'user', entity_id: selectedUser.id,
        details: JSON.stringify({ old_role: selectedUser.role, new_role: newRole }),
      });
    } catch { /* */ }
    setEditDialog(false);
  };

  const handleUnlock = async (userId: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, account_locked: false, failed_mfa_attempts: 0 } : u));
    try {
      await supabase.from('profiles').update({ account_locked: false, failed_mfa_attempts: 0, locked_at: null }).eq('id', userId);
      await supabase.from('audit_log').insert({
        user_id: currentUser?.id, action: 'ACCOUNT_UNLOCKED', entity_type: 'user', entity_id: userId,
      });
    } catch { /* */ }
  };

  const roleColors: Record<string, string> = {
    cardholder: 'bg-blue-500/15 text-blue-400', fraud_analyst: 'bg-amber-500/15 text-amber-400',
    risk_manager: 'bg-purple-500/15 text-purple-400', bank_admin: 'bg-emerald-500/15 text-emerald-400',
    compliance_officer: 'bg-cyan-500/15 text-cyan-400', it_security_admin: 'bg-red-500/15 text-red-400',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6 text-primary" /> User Management</h1>
        <p className="text-muted-foreground mt-1">Manage user roles, MFA status, and account locks</p>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-border/50">
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase">User</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase">Role</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">MFA</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase hidden lg:table-cell">Last Login</th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase">Actions</th>
              </tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                    <td className="p-4">
                      <div><p className="text-sm font-medium">{u.full_name}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
                    </td>
                    <td className="p-4"><span className={`text-xs px-2 py-1 rounded-full ${roleColors[u.role]}`}>{u.role.replace('_', ' ')}</span></td>
                    <td className="p-4 hidden md:table-cell">{u.mfa_enabled ? <Badge variant="success">Enabled</Badge> : <Badge variant="secondary">Disabled</Badge>}</td>
                    <td className="p-4 hidden lg:table-cell text-sm text-muted-foreground">{u.last_login ? formatDate(u.last_login) : 'Never'}</td>
                    <td className="p-4">{u.account_locked ? <Badge variant="destructive"><Lock className="w-3 h-3 mr-1" />Locked</Badge> : <Badge variant="success"><UserCheck className="w-3 h-3 mr-1" />Active</Badge>}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(u); setNewRole(u.role); setEditDialog(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                        {u.account_locked && <Button variant="outline" size="sm" onClick={() => handleUnlock(u.id)}>Unlock</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User Role</DialogTitle></DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div><p className="font-medium">{selectedUser.full_name}</p><p className="text-sm text-muted-foreground">{selectedUser.email}</p></div>
              <Select value={newRole} onValueChange={(v: UserRole) => setNewRole(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cardholder">Cardholder</SelectItem>
                  <SelectItem value="fraud_analyst">Fraud Analyst</SelectItem>
                  <SelectItem value="risk_manager">Risk Manager</SelectItem>
                  <SelectItem value="bank_admin">Bank Administrator</SelectItem>
                  <SelectItem value="compliance_officer">Compliance Officer</SelectItem>
                  <SelectItem value="it_security_admin">IT Security Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button><Button onClick={handleRoleChange}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
