export const colors = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  accent: '#f59e0b',
  success: '#16a34a',
  danger: '#dc2626',
  warning: '#d97706',
  bg: '#0f172a',
  bgCard: '#1e293b',
  bgCardAlt: '#263347',
  border: '#334155',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  white: '#ffffff',
};

export const statusColors: Record<string, string> = {
  pending: '#f59e0b',
  picked_up: '#2563eb',
  in_transit: '#2563eb',
  out_for_delivery: '#7c3aed',
  delivered: '#16a34a',
  delayed: '#d97706',
  exception: '#dc2626',
};

export const carrierStatusColors: Record<string, string> = {
  unassigned: '#64748b',
  pending: '#f59e0b',
  accepted: '#16a34a',
  rejected: '#dc2626',
};
