/**
 * @module src/app/api/books/content/url-validator
 * @scope Zero-trust anti-SSRF upstream URL validator and canonical Gutenberg mirror normalizer for `/api/books/content`.
 * @invariant Allowlist strictly official Project Gutenberg domains (`ALLOWED_HOSTS`), rejecting custom ports, embedded credentials (`@` / `user:pass`), directory traversal (`..`), RFC1918/loopback IPs, and non-HTTP(S) schemes across both initial and `Location` redirect targets.
 * @invariant Constrain URL pathnames to strict alphanumeric/punctuation characters (`^/[a-zA-Z0-9/_.-]+$`) before server-side `fetch` executes.
 * @rationale Enforcing strict host allowlisting and redirect re-validation eliminates SSRF (`CWE-918`) and internal metadata-service probing from client-supplied `url` query parameters.
 * @adr ADR-016, ADR-022, ADR-034, ADR-073
 */

const ALLOWED_HOSTS = new Set([
  'www.gutenberg.org',
  'gutenberg.org',
  'aleph.gutenberg.org',
  'gutenberg.pglaf.org',
  'gutenberg.readingroo.ms',
]);

export function isSafeUpstreamUrl(rawUrl: string, baseUrl?: string): boolean {
  try {
    if (!rawUrl || rawUrl.includes('..') || rawUrl.includes('@')) return false;
    const parsed = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (parsed.username || parsed.password || parsed.port) return false;
    const hostname = parsed.hostname.toLowerCase();
    if (!ALLOWED_HOSTS.has(hostname)) return false;
    // Reject internal hostnames and IP addresses
    if (/^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(hostname)) {
      return false;
    }
    // Reject paths containing invalid characters
    if (!/^\/[a-zA-Z0-9/_\-\.]+$/.test(parsed.pathname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function sanitizeUpstreamUrl(rawUrl: string): string | null {
  if (!isSafeUpstreamUrl(rawUrl)) return null;
  try {
    const parsed = new URL(rawUrl);
    const numericId =
      parsed.pathname.match(/\/(\d{1,8})(?:[./-]|$)/)?.[1] ||
      parsed.pathname.match(/pg(\d{1,8})\.txt/)?.[1];
    if (!numericId) return null;

    if (parsed.pathname.includes(`/files/${numericId}/${numericId}-0.txt`)) {
      return `https://gutenberg.org/files/${numericId}/${numericId}-0.txt`;
    }
    if (parsed.pathname.includes(`/files/${numericId}/${numericId}.txt`)) {
      return `https://gutenberg.org/files/${numericId}/${numericId}.txt`;
    }
    return `https://www.gutenberg.org/cache/epub/${numericId}/pg${numericId}.txt`;
  } catch {
    return null;
  }
}

