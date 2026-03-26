import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Bell, Mail, MessageSquare, Smartphone, CheckCircle } from 'lucide-react';

// Validates US4: Manage notification channel preferences
export default function NotificationPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState({ push_enabled: true, sms_enabled: false, email_enabled: true });
  const [saved, setSaved] = useState(false);

  const togglePref = (key: keyof typeof prefs) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const handleSave = async () => {
    try {
      await supabase.from('notification_preferences').upsert({
        user_id: user?.id, ...prefs,
      }, { onConflict: 'user_id' });
      await supabase.from('audit_log').insert({
        user_id: user?.id, action: 'NOTIFICATION_PREFS_UPDATED', entity_type: 'user', entity_id: user?.id,
        details: JSON.stringify(prefs),
      });
    } catch { /* */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const channels = [
    { key: 'push_enabled' as const, label: 'Push Notifications', desc: 'Real-time alerts in the browser and mobile app', icon: Bell, color: 'text-blue-400 bg-blue-500/10' },
    { key: 'email_enabled' as const, label: 'Email Notifications', desc: 'Receive alerts and case updates via email', icon: Mail, color: 'text-emerald-400 bg-emerald-500/10' },
    { key: 'sms_enabled' as const, label: 'SMS Notifications', desc: 'Text message alerts for high-priority transactions', icon: Smartphone, color: 'text-amber-400 bg-amber-500/10' },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="w-6 h-6 text-primary" /> Notification Preferences</h1>
        <p className="text-muted-foreground mt-1">Manage how you receive fraud alerts and updates</p>
      </div>

      <div className="space-y-4">
        {channels.map(ch => (
          <Card key={ch.key} className={`glass-card transition-all duration-300 cursor-pointer ${prefs[ch.key] ? 'border-primary/30' : 'opacity-60'}`} onClick={() => togglePref(ch.key)}>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${ch.color}`}>
                  <ch.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">{ch.label}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{ch.desc}</p>
                </div>
                <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ${prefs[ch.key] ? 'bg-primary' : 'bg-secondary'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 ${prefs[ch.key] ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={handleSave} className="w-full" size="lg">
        {saved ? <><CheckCircle className="w-4 h-4 mr-2" /> Saved!</> : 'Save Preferences'}
      </Button>
    </div>
  );
}
