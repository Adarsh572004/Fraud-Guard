import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Mail, Lock, User, Eye, EyeOff, ArrowRight, AlertTriangle, KeyRound } from 'lucide-react';
import type { UserRole } from '@/types';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('cardholder');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, mfaPending, verifyMfa, demoLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (mfaPending) {
      // Validates US5: MFA verification at login
      const { error } = await verifyMfa(mfaCode);
      if (error) setError(error);
      else navigate('/');
      setLoading(false);
      return;
    }

    if (isSignUp) {
      const { error } = await signUp(email, password, fullName, role);
      if (error) setError(error);
      else navigate('/');
    } else {
      // Validates US5: Secure Login
      const { error } = await signIn(email, password);
      if (error) setError(error);
      else if (!mfaPending) navigate('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/[0.02] rounded-full blur-3xl" />
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-lg shadow-primary/30 mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gradient">FraudGuard</h1>
          <p className="text-muted-foreground mt-1">Credit Card Fraud Detection System</p>
        </div>

        <Card className="glass-card">
          <CardHeader className="text-center">
            <CardTitle>{mfaPending ? 'MFA Verification' : isSignUp ? 'Create Account' : 'Welcome Back'}</CardTitle>
            <CardDescription>
              {mfaPending
                ? 'Enter the 6-digit code from your authenticator app'
                : isSignUp ? 'Set up your FraudGuard account' : 'Sign in to your account'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {mfaPending ? (
                // Validates US5: MFA enforcement
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <KeyRound className="w-8 h-8 text-primary" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="mfa-code">Authentication Code</Label>
                    <Input
                      id="mfa-code"
                      value={mfaCode}
                      onChange={e => setMfaCode(e.target.value)}
                      placeholder="000000"
                      maxLength={6}
                      className="text-center text-2xl tracking-[0.5em] mt-1.5"
                      autoFocus
                    />
                  </div>
                </div>
              ) : (
                <>
                  {isSignUp && (
                    <div>
                      <Label htmlFor="fullName">Full Name</Label>
                      <div className="relative mt-1.5">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Doe" className="pl-10" required />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative mt-1.5">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="pl-10" required />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      {!isSignUp && (
                        <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                          Forgot password?
                        </Link>
                      )}
                    </div>
                    <div className="relative mt-1.5">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password" type={showPassword ? 'text' : 'password'}
                        value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••" className="pl-10 pr-10" required minLength={6}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isSignUp && (
                    <div>
                      <Label htmlFor="role">Role</Label>
                      <Select value={role} onValueChange={(v: UserRole) => setRole(v)}>
                        <SelectTrigger className="mt-1.5" id="role">
                          <SelectValue />
                        </SelectTrigger>
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
                </>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {mfaPending ? 'Verify Code' : isSignUp ? 'Create Account' : 'Sign In'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            {!mfaPending && (
              <div className="mt-6 text-center">
                <button onClick={() => { setIsSignUp(!isSignUp); setError(''); }} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Protected by FraudGuard Security • v2.0
        </p>
      </div>
    </div>
  );
}
