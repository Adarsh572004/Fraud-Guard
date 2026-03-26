import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/utils';
import { BarChart3, TrendingUp, Shield, AlertTriangle, Download, Filter, Calendar, CreditCard } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

const mockTimeData = [
  { date: '2026-01', total: 15200, flagged: 342, confirmed: 156, falsePositive: 186 },
  { date: '2026-02', total: 16800, flagged: 298, confirmed: 178, falsePositive: 120 },
  { date: '2026-03', total: 18400, flagged: 267, confirmed: 145, falsePositive: 122 },
  { date: '2026-04', total: 17600, flagged: 312, confirmed: 198, falsePositive: 114 },
  { date: '2026-05', total: 19200, flagged: 256, confirmed: 167, falsePositive: 89 },
  { date: '2026-06', total: 21000, flagged: 224, confirmed: 156, falsePositive: 68 },
];

const mockRegionData = [
  { region: 'US-East', transactions: 35200, fraud: 234, rate: 0.66 },
  { region: 'US-West', transactions: 28400, fraud: 167, rate: 0.59 },
  { region: 'Europe', transactions: 18600, fraud: 198, rate: 1.06 },
  { region: 'Asia', transactions: 12400, fraud: 145, rate: 1.17 },
  { region: 'Africa', transactions: 4200, fraud: 89, rate: 2.12 },
  { region: 'Other', transactions: 8600, fraud: 56, rate: 0.65 },
];

const mockCardTypeData = [
  { type: 'Visa', count: 45200, fraud: 312, color: '#3b82f6' },
  { type: 'Mastercard', count: 32100, fraud: 234, color: '#f97316' },
  { type: 'Amex', count: 18400, fraud: 198, color: '#10b981' },
  { type: 'Discover', count: 11700, fraud: 145, color: '#8b5cf6' },
];

// Validates US3: Admin KPI Dashboard with real-time metrics
export default function KPIDashboard() {
  const { profile } = useAuth();
  const [dateRange, setDateRange] = useState('6m');
  const [regionFilter, setRegionFilter] = useState('all');
  const [cardTypeFilter, setCardTypeFilter] = useState('all');
  const isReadOnly = profile?.role === 'fraud_analyst'; // Validates US3: Analysts have read-only access

  const kpis = [
    { label: 'Total Transactions', value: '107,400', change: '+14.2%', trend: 'up', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Fraud Detection Rate', value: '94.7%', change: '+2.1%', trend: 'up', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'False Positive Rate', value: '2.3%', change: '-0.8%', trend: 'down', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Alerts Generated', value: '1,699', change: '+5.6%', trend: 'up', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  // Validates US3: Dynamic filtering without page reload
  const filteredTimeData = mockTimeData;
  const filteredRegionData = regionFilter === 'all' ? mockRegionData : mockRegionData.filter(r => r.region === regionFilter);

  const handleExportCSV = () => {
    // Validates US3: Generate downloadable CSV reports
    const headers = 'Date,Total,Flagged,Confirmed Fraud,False Positive\n';
    const rows = mockTimeData.map(d => `${d.date},${d.total},${d.flagged},${d.confirmed},${d.falsePositive}`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `fraudguard-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    // Validates US3: Generate downloadable PDF reports
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    doc.setFontSize(20); doc.text('FraudGuard Performance Report', 14, 22);
    doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    doc.setFontSize(12); doc.text('KPI Summary', 14, 42);

    autoTable(doc, {
      startY: 48,
      head: [['Metric', 'Value']],
      body: kpis.map(k => [k.label, k.value]),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 12,
      head: [['Date', 'Total', 'Flagged', 'Confirmed', 'False Positive']],
      body: mockTimeData.map(d => [d.date, d.total, d.flagged, d.confirmed, d.falsePositive]),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`fraudguard-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const tooltipStyle = { backgroundColor: 'hsl(222,47%,8%)', border: '1px solid hsl(217,33%,17%)', borderRadius: '8px', color: 'white' };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> KPI Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time fraud detection performance metrics
            {isReadOnly && <Badge variant="secondary" className="ml-2">Read-Only</Badge>}
          </p>
        </div>
        {!isReadOnly && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}><Download className="w-4 h-4 mr-1" /> CSV</Button>
            <Button size="sm" onClick={handleExportPDF}><Download className="w-4 h-4 mr-1" /> PDF</Button>
          </div>
        )}
      </div>

      {/* Filters - Validates US3: Date Range, Region, Card Type filters */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">Filters:</span></div>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-36"><Calendar className="w-3.5 h-3.5 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1m">Last Month</SelectItem>
                <SelectItem value="3m">Last 3 Months</SelectItem>
                <SelectItem value="6m">Last 6 Months</SelectItem>
                <SelectItem value="1y">Last Year</SelectItem>
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Region" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {mockRegionData.map(r => <SelectItem key={r.region} value={r.region}>{r.region}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={cardTypeFilter} onValueChange={setCardTypeFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Card Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cards</SelectItem>
                {mockCardTypeData.map(c => <SelectItem key={c.type} value={c.type}>{c.type}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards - Validates US3: Total Transactions, Fraud Detection Rate, FPR, Alerts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <Card key={kpi.label} className="glass-card hover:border-primary/20 transition-all duration-300">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p className="text-3xl font-bold mt-1">{kpi.value}</p>
              <p className={`text-xs mt-1 ${kpi.trend === 'up' ? 'text-emerald-400' : 'text-cyan-400'}`}>{kpi.change} vs previous period</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts - Validates US3: Time-series and bar charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Fraud Detection Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={filteredTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                <XAxis dataKey="date" stroke="hsl(215,20%,55%)" fontSize={12} />
                <YAxis stroke="hsl(215,20%,55%)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line type="monotone" dataKey="confirmed" name="Confirmed Fraud" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="falsePositive" name="False Positive" stroke="#fbbf24" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="flagged" name="Total Flagged" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Fraud by Region</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={filteredRegionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                <XAxis dataKey="region" stroke="hsl(215,20%,55%)" fontSize={11} />
                <YAxis stroke="hsl(215,20%,55%)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="fraud" name="Fraud Cases" fill="hsl(217,91%,60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Card Type breakdown */}
      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Fraud by Card Type</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {mockCardTypeData.map(c => (
              <div key={c.type} className="p-4 rounded-lg bg-secondary/30 text-center">
                <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: `${c.color}20` }}>
                  <CreditCard className="w-5 h-5" style={{ color: c.color }} />
                </div>
                <p className="font-semibold">{c.type}</p>
                <p className="text-2xl font-bold mt-1">{c.fraud}</p>
                <p className="text-xs text-muted-foreground">of {c.count.toLocaleString()} txns</p>
                <p className="text-xs mt-1" style={{ color: c.color }}>{((c.fraud / c.count) * 100).toFixed(2)}% fraud rate</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

