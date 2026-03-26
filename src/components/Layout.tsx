import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  LayoutDashboard, Shield, AlertTriangle, CreditCard, Users, BarChart3,
  FileText, Settings, LogOut, Menu, X, Bell, Search, Brain, Eye,
  ChevronLeft, Activity, ShieldAlert, Headphones, ScrollText,
} from 'lucide-react';
import type { UserRole } from '@/types';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['cardholder', 'fraud_analyst', 'risk_manager', 'bank_admin', 'compliance_officer', 'it_security_admin'] },
  { label: 'My Transactions', path: '/transactions', icon: CreditCard, roles: ['cardholder'] },
  { label: 'My Alerts', path: '/alerts', icon: Bell, roles: ['cardholder'] },
  { label: 'Analyst Queue', path: '/analyst', icon: ShieldAlert, roles: ['fraud_analyst'] },
  { label: 'Case Management', path: '/cases', icon: Search, roles: ['fraud_analyst', 'risk_manager'] },
  { label: 'Support Center', path: '/support', icon: Headphones, roles: ['fraud_analyst', 'risk_manager', 'bank_admin'] },
  { label: 'KPI Dashboard', path: '/kpi', icon: BarChart3, roles: ['bank_admin', 'risk_manager', 'fraud_analyst', 'compliance_officer'] },
  { label: 'Reports', path: '/reports', icon: FileText, roles: ['bank_admin', 'risk_manager'] },
  { label: 'ML Pipeline', path: '/ml', icon: Brain, roles: ['it_security_admin', 'risk_manager', 'bank_admin'] },
  { label: 'User Management', path: '/users', icon: Users, roles: ['bank_admin', 'it_security_admin'] },
  { label: 'Audit Log', path: '/audit', icon: ScrollText, roles: ['compliance_officer', 'it_security_admin'] },
  { label: 'Notification Prefs', path: '/notifications', icon: Settings, roles: ['cardholder'] },
];

export function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile, signOut, hasRole } = useAuth();
  const navigate = useNavigate();

  const filteredNav = navItems.filter(item =>
    profile && item.roles.includes(profile.role)
  );

  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const roleBadgeColor: Record<string, string> = {
    cardholder: 'bg-blue-500/20 text-blue-400',
    fraud_analyst: 'bg-amber-500/20 text-amber-400',
    risk_manager: 'bg-purple-500/20 text-purple-400',
    bank_admin: 'bg-emerald-500/20 text-emerald-400',
    compliance_officer: 'bg-cyan-500/20 text-cyan-400',
    it_security_admin: 'bg-red-500/20 text-red-400',
  };

  const roleLabels: Record<string, string> = {
    cardholder: 'Cardholder',
    fraud_analyst: 'Fraud Analyst',
    risk_manager: 'Risk Manager',
    bank_admin: 'Bank Admin',
    compliance_officer: 'Compliance Officer',
    it_security_admin: 'IT Security',
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 py-5 border-b border-border/50', collapsed && 'justify-center')}>
        <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="text-lg font-bold text-gradient">FraudGuard</h1>
            <p className="text-[10px] text-muted-foreground tracking-wider uppercase">Detection System</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3">
        <nav className="px-3 space-y-1">
          {filteredNav.map(item => (
            <TooltipProvider key={item.path} delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                      isActive
                        ? 'bg-primary/15 text-primary shadow-sm glow-blue'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80',
                      collapsed && 'justify-center px-2',
                    )}
                  >
                    <item.icon className={cn('w-5 h-5 shrink-0 transition-transform group-hover:scale-110')} />
                    {!collapsed && <span className="animate-fade-in">{item.label}</span>}
                  </NavLink>
                </TooltipTrigger>
                {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
              </Tooltip>
            </TooltipProvider>
          ))}
        </nav>
      </ScrollArea>

      {/* User Profile */}
      <div className="border-t border-border/50 p-3">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <Avatar className="h-9 w-9 border-2 border-primary/30">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0 animate-fade-in">
              <p className="text-sm font-medium truncate">{profile?.full_name}</p>
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', roleBadgeColor[profile?.role || ''])}>
                {roleLabels[profile?.role || '']}
              </span>
            </div>
          )}
          {!collapsed && (
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="shrink-0 text-muted-foreground hover:text-red-400">
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className={cn(
        'hidden lg:flex flex-col border-r border-border/50 bg-sidebar transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-64',
      )}>
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute left-[calc(var(--sidebar-width)-12px)] top-6 z-10 hidden lg:flex h-6 w-6 items-center justify-center rounded-full border bg-card text-muted-foreground hover:text-foreground transition-colors"
          style={{ '--sidebar-width': collapsed ? '72px' : '256px' } as React.CSSProperties}
        >
          <ChevronLeft className={cn('h-3 w-3 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-border/50 animate-slide-in-right z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 border-b border-border/50 flex items-center justify-between px-4 lg:px-6 bg-card/50 backdrop-blur-sm">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 ml-auto">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 text-muted-foreground text-sm">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>System Online</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
