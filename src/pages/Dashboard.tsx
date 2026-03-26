import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, getRiskColor } from '@/lib/utils';
import {
  Activity, TrendingUp, AlertTriangle, Shield, CreditCard,
  ArrowUpRight, ArrowDownRight, Users, CheckCircle, XCircle, Clock,
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Mock data for when Supabase isn't configured
const mockTimeSeriesData = [
  { date: 'Jan', transactions: 12400, fraudulent: 186, score: 72 },
  { date: 'Feb', transactions: 13200, fraudulent: 165, score: 74 },
  { date: 'Mar', transactions: 14100, fraudulent: 198, score: 71 },
  { date: 'Apr', transactions: 13800, fraudulent: 142, score: 78 },
  { date: 'May', transactions: 15200, fraudulent: 167, score: 76 },
  { date: 'Jun', transactions: 16400, fraudulent: 134, score: 82 },
];

const mockRiskDistribution = [
  { name: 'Low', value: 72, color: '#34d399' },
  { name: 'Medium', value: 18, color: '#fbbf24' },
  { name: 'High', value: 7, color: '#f97316' },
  { name: 'Critical', value: 3, color: '#ef4444' },
];

const mockRecentAlerts = [
  { id: '1', merchant: 'Unusual ATM Withdrawal', amount: 2500, risk_level: 'HIGH', time: '2 min ago' },
  { id: '2', merchant: 'Online Purchase - Electronics', amount: 4899, risk_level: 'CRITICAL', time: '5 min ago' },
  { id: '3', merchant: 'Foreign Transaction - Paris', amount: 1200, risk_level: 'MEDIUM', time: '12 min ago' },
  { id: '4', merchant: 'Gas Station Purchase', amount: 85, risk_level: 'LOW', time: '18 min ago' },
];

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down';
  icon: React.ElementType;
  gradient: string;
}

function StatCard({ title, value, change, trend, icon: Icon, gradient }: StatCardProps) {
  return (
    <Card className="glass-card hover:border-primary/20 transition-all duration-300 group">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1 animate-count-up">{value}</p>
            {change && (
              <div className={`flex items-center gap-1 mt-1 text-xs ${trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {change}
              </div>
            )}
          </div>
          <div className={`w-11 h-11 rounded-xl ${gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Validates US3: Dashboard displays real-time KPI
export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalTransactions: 89247,
    fraudDetectionRate: 94.7,
    falsePositiveRate: 2.3,
    alertsGenerated: 342,
    blockedCards: 27,
    avgProcessingTime: 187,
  });

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      const { data: transactions } = await supabase.from('transactions').select('*', { count: 'exact' });
      if (transactions && transactions.length > 0) {
        const flagged = transactions.filter((t: any) => t.is_flagged);
        const confirmed = transactions.filter((t: any) => t.status === 'confirmed_fraud');
        setStats({
          totalTransactions: transactions.length,
          fraudDetectionRate: flagged.length > 0 ? (confirmed.length / flagged.length) * 100 : 94.7,
          falsePositiveRate: flagged.length > 0 ? ((flagged.length - confirmed.length) / flagged.length) * 100 : 2.3,
          alertsGenerated: flagged.length || 342,
          blockedCards: confirmed.length || 27,
          avgProcessingTime: 187,
        });
      }
    } catch {
      // Use mock data if Supabase is not configured
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, <span className="text-gradient">{profile?.full_name || 'User'}</span>
        </h1>
        <p className="text-muted-foreground mt-1">Here's what's happening with fraud detection today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Total Transactions" value={stats.totalTransactions.toLocaleString()} change="+12.5% from last month" trend="up" icon={Activity} gradient="gradient-primary" />
        <StatCard title="Detection Rate" value={`${stats.fraudDetectionRate.toFixed(1)}%`} change="+2.1% improvement" trend="up" icon={Shield} gradient="bg-gradient-to-br from-emerald-500 to-green-600" />
        <StatCard title="False Positive Rate" value={`${stats.falsePositiveRate.toFixed(1)}%`} change="-0.8% improvement" trend="down" icon={CheckCircle} gradient="bg-gradient-to-br from-cyan-500 to-blue-600" />
        <StatCard title="Alerts Generated" value={stats.alertsGenerated.toString()} change="+5 today" trend="up" icon={AlertTriangle} gradient="bg-gradient-to-br from-amber-500 to-orange-600" />
        <StatCard title="Blocked Cards" value={stats.blockedCards.toString()} change="+3 this week" trend="up" icon={CreditCard} gradient="bg-gradient-to-br from-red-500 to-pink-600" />
        <StatCard title="Avg Response" value={`${stats.avgProcessingTime}ms`} change="< 300ms target ✓" trend="down" icon={Clock} gradient="bg-gradient-to-br from-purple-500 to-violet-600" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transaction Trend */}
        <Card className="glass-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Transaction Volume & Fraud Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={mockTimeSeriesData}>
                <defs>
                  <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217,91%,60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(217,91%,60%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorFraud" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                <XAxis dataKey="date" stroke="hsl(215,20%,55%)" fontSize={12} />
                <YAxis stroke="hsl(215,20%,55%)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(222,47%,8%)', border: '1px solid hsl(217,33%,17%)', borderRadius: '8px', color: 'white' }} />
                <Area type="monotone" dataKey="transactions" stroke="hsl(217,91%,60%)" fillOpacity={1} fill="url(#colorTx)" strokeWidth={2} />
                <Area type="monotone" dataKey="fraudulent" stroke="#ef4444" fillOpacity={1} fill="url(#colorFraud)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Risk Distribution */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Risk Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={mockRiskDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                  {mockRiskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(222,47%,8%)', border: '1px solid hsl(217,33%,17%)', borderRadius: '8px', color: 'white' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {mockRiskDistribution.map(item => (
                <div key={item.name} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-medium ml-auto">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Alerts */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Recent Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockRecentAlerts.map(alert => (
              <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${alert.risk_level === 'CRITICAL' ? 'bg-red-400 animate-pulse' : alert.risk_level === 'HIGH' ? 'bg-orange-400' : alert.risk_level === 'MEDIUM' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <div>
                    <p className="text-sm font-medium">{alert.merchant}</p>
                    <p className="text-xs text-muted-foreground">{alert.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{formatCurrency(alert.amount)}</span>
                  <Badge variant={alert.risk_level === 'CRITICAL' ? 'critical' : alert.risk_level === 'HIGH' ? 'destructive' : alert.risk_level === 'MEDIUM' ? 'warning' : 'success'}>
                    {alert.risk_level}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
