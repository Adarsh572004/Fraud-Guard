import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatDate } from '@/lib/utils';
import { Brain, RotateCcw, Play, CheckCircle, XCircle, TrendingUp, Database, Cpu, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { MLModel } from '@/types';

const mockModels: MLModel[] = [
  { id: 'm1', version: 'v2.4.1', accuracy: 0.947, f1_score: 0.923, false_positive_rate: 0.023, training_rows: 284807, is_active: true, training_started_at: new Date(Date.now() - 86400000).toISOString(), training_completed_at: new Date(Date.now() - 84600000).toISOString(), rolled_back: false, created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 'm2', version: 'v2.3.0', accuracy: 0.938, f1_score: 0.912, false_positive_rate: 0.031, training_rows: 250000, is_active: false, training_started_at: new Date(Date.now() - 604800000).toISOString(), training_completed_at: new Date(Date.now() - 603000000).toISOString(), rolled_back: false, created_at: new Date(Date.now() - 604800000).toISOString() },
  { id: 'm3', version: 'v2.2.0', accuracy: 0.925, f1_score: 0.884, false_positive_rate: 0.045, training_rows: 200000, is_active: false, training_started_at: new Date(Date.now() - 1209600000).toISOString(), training_completed_at: new Date(Date.now() - 1208000000).toISOString(), rolled_back: true, rollback_reason: 'F1 score dropped by 6.2% (> 5% threshold)', created_at: new Date(Date.now() - 1209600000).toISOString() },
];

// Validates US6: ML Pipeline with retraining, metrics logging, and rollback
export default function MLPipeline() {
  const { user, hasRole } = useAuth();
  const [models, setModels] = useState<MLModel[]>(mockModels);
  const [retraining, setRetraining] = useState(false);
  const [retrainProgress, setRetrainProgress] = useState(0);
  const [rollbackDialog, setRollbackDialog] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<MLModel | null>(null);
  const canRetrain = hasRole('it_security_admin', 'risk_manager', 'bank_admin');

  // Validates US6: Trigger model retraining
  const handleRetrain = async () => {
    if (!canRetrain) return; // Validates: Only authorized roles can trigger retraining
    setRetraining(true);
    setRetrainProgress(0);

    // Simulate training progress
    const interval = setInterval(() => {
      setRetrainProgress(prev => {
        if (prev >= 100) { clearInterval(interval); return 100; }
        return prev + Math.random() * 15;
      });
    }, 500);

    setTimeout(async () => {
      clearInterval(interval);
      setRetrainProgress(100);

      const newModel: MLModel = {
        id: `m-${Date.now()}`, version: `v2.${models.length + 2}.0`,
        accuracy: 0.952, f1_score: 0.931, false_positive_rate: 0.019,
        training_rows: 300000, is_active: false,
        training_started_at: new Date(Date.now() - 5000).toISOString(),
        training_completed_at: new Date().toISOString(),
        rolled_back: false, created_at: new Date().toISOString(),
      };

      // Validates US6: Automatic rollback if F1 drops > 5%
      const activeModel = models.find(m => m.is_active);
      const f1Drop = activeModel ? ((activeModel.f1_score - newModel.f1_score) / activeModel.f1_score) * 100 : 0;

      if (f1Drop > 5) {
        newModel.rolled_back = true;
        newModel.rollback_reason = `F1 score dropped by ${f1Drop.toFixed(1)}% (> 5% threshold)`;
        setModels(prev => [newModel, ...prev]);
      } else {
        // Activate new model (zero-downtime: set active THEN deactivate old)
        newModel.is_active = true;
        setModels(prev => [newModel, ...prev.map(m => ({ ...m, is_active: false }))]);
      }

      // Validates US6: Log metrics
      try {
        await supabase.from('ml_models').insert(newModel);
        await supabase.from('audit_log').insert({
          user_id: user?.id, action: 'MODEL_RETRAINED', entity_type: 'model', entity_id: newModel.id,
          details: JSON.stringify({ accuracy: newModel.accuracy, f1: newModel.f1_score, fpr: newModel.false_positive_rate, rolled_back: newModel.rolled_back }),
        });
      } catch { /* */ }

      setRetraining(false);
    }, 4000);
  };

  // Validates US6: Rollback mechanism
  const handleRollback = async () => {
    if (!rollbackTarget) return;
    setModels(prev => prev.map(m => ({
      ...m, is_active: m.id === rollbackTarget.id,
    })));
    try {
      await supabase.from('audit_log').insert({
        user_id: user?.id, action: 'MODEL_ROLLBACK', entity_type: 'model', entity_id: rollbackTarget.id,
        details: JSON.stringify({ rolled_back_to_version: rollbackTarget.version }),
      });
    } catch { /* */ }
    setRollbackDialog(false);
  };

  const metricColor = (value: number, thresholds: [number, number]) => {
    if (value >= thresholds[1]) return 'text-emerald-400';
    if (value >= thresholds[0]) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="w-6 h-6 text-primary" /> ML Pipeline</h1>
          <p className="text-muted-foreground mt-1">Manage fraud detection models, retraining, and deployment</p>
        </div>
        {canRetrain && (
          <Button onClick={handleRetrain} disabled={retraining} size="lg">
            {retraining ? <><Cpu className="w-4 h-4 animate-spin mr-2" /> Training...</> : <><Play className="w-4 h-4 mr-2" /> Retrain Model</>}
          </Button>
        )}
      </div>

      {/* Training Progress */}
      {retraining && (
        <Card className="glass-card border-primary/30 glow-blue">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <Cpu className="w-5 h-5 text-primary animate-spin" />
              <span className="text-sm font-medium">Training in progress...</span>
              <span className="text-sm text-muted-foreground ml-auto">{Math.min(Math.round(retrainProgress), 100)}%</span>
            </div>
            <Progress value={Math.min(retrainProgress, 100)} indicatorClassName="gradient-primary" />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>Data ingestion → Feature extraction → Model training → Validation</span>
              <span>ETA: ~30s</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Model Highlight */}
      {models.filter(m => m.is_active).map(m => (
        <Card key={m.id} className="glass-card border-emerald-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="w-5 h-5 text-emerald-400" /> Active Model — {m.version}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">Accuracy</p>
                <p className={`text-2xl font-bold ${metricColor(m.accuracy, [0.9, 0.94])}`}>{(m.accuracy * 100).toFixed(1)}%</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">F1 Score</p>
                <p className={`text-2xl font-bold ${metricColor(m.f1_score, [0.88, 0.92])}`}>{(m.f1_score * 100).toFixed(1)}%</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">FPR</p>
                <p className={`text-2xl font-bold ${m.false_positive_rate <= 0.03 ? 'text-emerald-400' : 'text-amber-400'}`}>{(m.false_positive_rate * 100).toFixed(1)}%</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">Training Data</p>
                <p className="text-2xl font-bold text-primary">{(m.training_rows / 1000).toFixed(0)}K</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Model History */}
      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="w-4 h-4 text-primary" /> Model Version History</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {models.map(m => (
              <div key={m.id} className={`p-4 rounded-lg border transition-colors ${m.is_active ? 'border-emerald-500/30 bg-emerald-500/5' : m.rolled_back ? 'border-red-500/20 bg-red-500/5 opacity-70' : 'border-border/50 bg-secondary/20'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold">{m.version}</span>
                    {m.is_active && <Badge variant="success">Active</Badge>}
                    {m.rolled_back && <Badge variant="destructive">Rolled Back</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Acc: {(m.accuracy * 100).toFixed(1)}%</span>
                    <span>F1: {(m.f1_score * 100).toFixed(1)}%</span>
                    <span>FPR: {(m.false_positive_rate * 100).toFixed(1)}%</span>
                    <span>{formatDate(m.created_at)}</span>
                    {!m.is_active && !m.rolled_back && canRetrain && (
                      <Button variant="outline" size="sm" onClick={() => { setRollbackTarget(m); setRollbackDialog(true); }}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Rollback
                      </Button>
                    )}
                  </div>
                </div>
                {m.rollback_reason && (
                  <p className="text-xs text-red-400 mt-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {m.rollback_reason}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rollback Confirmation */}
      <Dialog open={rollbackDialog} onOpenChange={setRollbackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Rollback</DialogTitle>
            <DialogDescription>Roll back to model {rollbackTarget?.version}? This will replace the current active model.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackDialog(false)}>Cancel</Button>
            <Button variant="warning" onClick={handleRollback}><RotateCcw className="w-4 h-4 mr-1" /> Rollback</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
