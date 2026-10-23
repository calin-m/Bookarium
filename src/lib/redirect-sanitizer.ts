/**
 * Sanitizes and validates internal redirect paths to prevent Open Redirect vulnerabilities.
 * Ensures the destination starts with a single leading slash and contains no protocol-relative
 * double slashes (//) or backslashes (/\).
 */
export function sanitizeRedirectPath(path: string | null): string {
  if (!path) return '/';
  const trimmed = path.trim();
  // Must start with a single slash and not double slashes (//) or backslashes (/\ or \)
  if (/^\/[^\/\\]/.test(trimmed) || trimmed === '/') {
    return trimmed;
  }
  return '/';
}

