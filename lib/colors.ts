export const colors = {
  primary: '#C9A84C',
  primaryDark: '#a8893e',
  accent: '#C9A84C',
  success: '#16a34a',
  danger: '#dc2626',
  warning: '#d97706',
  bg: '#0a0f1a',
  bgCard: '#111827',
  bgCardAlt: '#1a2235',
  border: '#1e2d40',
  text: '#f0f4f8',
  textMuted: '#a8c4d8',
  textDim: '#6a8aaa',
  white: '#ffffff',
};

export const statusColors: Record<string, string> = {
  pending: '#f59e0b',
  picked_up: '#C9A84C',
  in_transit: '#C9A84C',
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
