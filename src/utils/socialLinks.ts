const DANGEROUS_SCHEME_RE = /^(javascript|data|vbscript|file):/i;

export function sanitizeExternalUrl(rawUrl: string): string | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;

  // Block dangerous schemes
  if (DANGEROUS_SCHEME_RE.test(trimmed)) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function getCustomerInstagramUrl(rawInput: string): string | null {
  const trimmed = (rawInput || '').trim();
  if (!trimmed || DANGEROUS_SCHEME_RE.test(trimmed)) return null;

  if (/instagram\.com|instagr\.am/i.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
    return sanitizeExternalUrl(trimmed);
  }

  const handle = trimmed.replace(/^@+/, '').replace(/\s+/g, '');
  if (!handle) return null;
  return `https://www.instagram.com/${encodeURIComponent(handle)}/`;
}

export function getCustomerFacebookUrl(rawInput: string): string | null {
  const trimmed = (rawInput || '').trim();
  if (!trimmed || DANGEROUS_SCHEME_RE.test(trimmed)) return null;

  if (/facebook\.com|fb\.com|fb\.me/i.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
    return sanitizeExternalUrl(trimmed);
  }

  if (trimmed.includes(' ')) {
    return `https://www.facebook.com/search/top/?q=${encodeURIComponent(trimmed)}`;
  }

  const slug = trimmed.replace(/^@+/, '');
  if (!slug) return null;
  return `https://www.facebook.com/${encodeURIComponent(slug)}`;
}

export function getCustomerWebsiteUrl(rawInput: string): string | null {
  return sanitizeExternalUrl(rawInput);
}

export function formatSocialDisplayLabel(
  rawInput: string,
  kind: 'facebook' | 'instagram' | 'website'
): string {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return '';

  if (kind === 'instagram') {
    if (!trimmed.includes('/') && !trimmed.includes('.')) {
      return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
    }
    const url = getCustomerInstagramUrl(trimmed);
    if (url) {
      try {
        const pathPart = new URL(url).pathname.replace(/^\/+|\/+$/g, '');
        if (pathPart && !pathPart.includes('/')) return `@${pathPart}`;
      } catch {
        // fallback below
      }
    }
    return trimmed.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '');
  }

  if (kind === 'facebook') {
    if (!trimmed.includes('/') && !trimmed.includes('.')) {
      return trimmed;
    }
    return trimmed.replace(/^https?:\/\/(www\.|m\.)?/i, '').replace(/\/+$/, '');
  }

  return trimmed.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '');
}
