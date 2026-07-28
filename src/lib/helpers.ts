export function generateTrackingCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const l1 = letters[Math.floor(Math.random() * letters.length)];
  const l2 = letters[Math.floor(Math.random() * letters.length)];
  const l3 = letters[Math.floor(Math.random() * letters.length)];
  const numbers = Math.floor(1000 + Math.random() * 9000);
  return `${l1}${l2}${l3}-${numbers}`;
}

export function generatePickupCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function formatTimestamp(ts?: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function normalizeTo11Digits(phone: string): string {
  if (!phone) return '';
  let clean = phone.replace(/[^0-9]/g, '');
  // If it starts with 234 and has 13 digits (e.g. 2348031234567), change to 08031234567
  if (clean.startsWith('234') && clean.length === 13) {
    clean = '0' + clean.slice(3);
  }
  // If it starts with 234 and has 12 digits (e.g. 234803123456), change to 08031234567
  else if (clean.startsWith('234') && clean.length === 12) {
    clean = '0' + clean.slice(3);
  }
  // If it has 10 digits and starts with 8, 7, 9, or 1, prepend 0 to make it 11 digits
  else if (clean.length === 10 && ['1', '7', '8', '9'].includes(clean[0])) {
    clean = '0' + clean;
  }
  return clean;
}
