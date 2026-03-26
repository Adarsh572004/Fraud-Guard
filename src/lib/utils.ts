import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(date));
}

export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(date));
}

export function generateCaseId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `FG-${dateStr}-${seq}`;
}

export function getRiskColor(level: string): string {
  switch (level?.toUpperCase()) {
    case 'CRITICAL': return 'text-red-400 bg-red-500/10 border-red-500/20';
    case 'HIGH': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    case 'MEDIUM': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    case 'LOW': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  }
}

export function getRiskLevel(score: number): string {
  if (score >= 90) return 'CRITICAL';
  if (score >= 75) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

export function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'active': case 'approved': case 'confirmed': case 'resolved_legitimate': return 'text-emerald-400 bg-emerald-500/10';
    case 'blocked': case 'denied': case 'confirmed_fraud': return 'text-red-400 bg-red-500/10';
    case 'pending': case 'open': case 'investigating': return 'text-amber-400 bg-amber-500/10';
    case 'under_review': return 'text-blue-400 bg-blue-500/10';
    default: return 'text-gray-400 bg-gray-500/10';
  }
}

export function maskCardNumber(num: string): string {
  if (!num) return '****';
  const last4 = num.slice(-4);
  return `•••• •••• •••• ${last4}`;
}
