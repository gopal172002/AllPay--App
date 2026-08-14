export function maskVpa(vpa: string): string {
  const at = vpa.indexOf('@');
  if (at < 1) {
    return '••••';
  }
  const local = vpa.slice(0, at);
  const handle = vpa.slice(at);
  if (local.length <= 2) {
    return `${local[0] ?? ''}•${handle}`;
  }
  return `${local.slice(0, 2)}••••${handle}`;
}

export function maskRef(value: string | undefined): string {
  if (!value) {
    return '—';
  }
  if (value.length <= 4) {
    return `••••${value}`;
  }
  return `••••${value.slice(-4)}`;
}

export function sanitizeDisplayText(value: string, max = 80): string {
  return value.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
}
