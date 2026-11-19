export function normalizePhoneForWhatsApp(rawPhone: string): string | null {
  const trimmed = (rawPhone || '').trim();
  if (!trimmed) return null;

  const hasPlusPrefix = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');
  if (digits.length < 6) return null;

  if (hasPlusPrefix) {
    if (digits.startsWith('2120') && digits.length === 13) {
      digits = `212${digits.slice(4)}`;
    }
    return digits;
  }

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
    if (digits.startsWith('2120') && digits.length === 13) {
      digits = `212${digits.slice(4)}`;
    }
    return digits.length >= 6 ? digits : null;
  }

  if (digits.startsWith('2120') && digits.length === 13) {
    return `212${digits.slice(4)}`;
  }

  // Local Moroccan format e.g. 0612345678, 0712345678, 0535123456
  if (digits.startsWith('0') && (digits.length === 10 || digits.length === 9)) {
    return `212${digits.slice(1)}`;
  }

  // 9-digit Moroccan mobile/landline without leading zero
  if (digits.length === 9 && /^[567]/.test(digits)) {
    return `212${digits}`;
  }

  return digits;
}

export function getCustomerWhatsAppUrl(rawPhone: string, prefillText?: string): string | null {
  const normalized = normalizePhoneForWhatsApp(rawPhone);
  if (!normalized) return null;
  if (prefillText && prefillText.trim()) {
    return `https://wa.me/${normalized}?text=${encodeURIComponent(prefillText.trim())}`;
  }
  return `https://wa.me/${normalized}`;
}

export function getPhoneTelHref(rawPhone: string): string {
  const sanitized = (rawPhone || '').replace(/[^\d+]/g, '');
  return `tel:${sanitized || rawPhone.trim()}`;
}
