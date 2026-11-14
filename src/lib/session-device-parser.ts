export interface ActiveUserSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  refreshedAt: string | null;
  notAfter: string | null;
  isCurrent: boolean;
}

export type SessionDeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export interface ParsedSessionDevice {
  browser: string;
  os: string;
  deviceType: SessionDeviceType;
  label: string;
}

function detectBrowserName(uaLower: string): string {
  if (
    uaLower.includes('edg/') ||
    uaLower.includes('edge/') ||
    uaLower.includes('edgios/') ||
    uaLower.includes('edga/')
  ) {
    return 'Edge';
  }
  if (uaLower.includes('opr/') || uaLower.includes('opera')) {
    return 'Opera';
  }
  if (uaLower.includes('vivaldi/')) {
    return 'Vivaldi';
  }
  if (uaLower.includes('duckduckgo/')) {
    return 'DuckDuckGo';
  }
  if (uaLower.includes('brave')) {
    return 'Brave';
  }
  if (uaLower.includes('samsungbrowser/')) {
    return 'Samsung Internet';
  }
  if (uaLower.includes('firefox/') || uaLower.includes('fxios/')) {
    return 'Firefox';
  }
  if (uaLower.includes('chrome/') || uaLower.includes('crios/')) {
    return 'Chrome';
  }
  if (uaLower.includes('safari/')) {
    return 'Safari';
  }
  return 'Browser session';
}

function detectPlatform(uaLower: string): { os: string; deviceType: SessionDeviceType } {
  if (uaLower.includes('ipad')) {
    return { os: 'iPadOS', deviceType: 'tablet' };
  }
  if (uaLower.includes('iphone') || uaLower.includes('ipod')) {
    return { os: 'iOS', deviceType: 'mobile' };
  }
  if (uaLower.includes('android')) {
    const isPhone = uaLower.includes('mobile') || uaLower.includes('phone');
    return { os: 'Android', deviceType: isPhone ? 'mobile' : 'tablet' };
  }
  if (uaLower.includes('cros')) {
    return { os: 'ChromeOS', deviceType: 'desktop' };
  }
  if (uaLower.includes('windows')) {
    return { os: 'Windows', deviceType: 'desktop' };
  }
  if (uaLower.includes('macintosh') || uaLower.includes('mac os x')) {
    return { os: 'macOS', deviceType: 'desktop' };
  }
  if (uaLower.includes('linux') || uaLower.includes('x11')) {
    return { os: 'Linux', deviceType: 'desktop' };
  }
  return { os: 'Unknown OS', deviceType: 'unknown' };
}

/**
 * Parses a browser User-Agent string into human-readable browser, OS, and device category metadata.
 */
export function parseSessionDevice(userAgent: string | null | undefined): ParsedSessionDevice {
  const trimmed = typeof userAgent === 'string' ? userAgent.trim() : '';
  if (!trimmed) {
    return {
      browser: 'Browser session',
      os: 'Unknown OS',
      deviceType: 'unknown',
      label: 'Browser session',
    };
  }

  const uaLower = trimmed.toLowerCase();
  const browser = detectBrowserName(uaLower);
  const { os, deviceType } = detectPlatform(uaLower);
  const label = os !== 'Unknown OS' ? `${browser} on ${os}` : browser;

  return {
    browser,
    os,
    deviceType,
    label,
  };
}

function isValidIpv4Octet(segment: string): boolean {
  if (!/^\d{1,3}$/.test(segment)) return false;
  const num = Number(segment);
  return num >= 0 && num <= 255;
}

function isValidHexGroup(segment: string): boolean {
  return /^[0-9a-f]{1,4}$/.test(segment);
}

function formatIpv6PrefixMask(address: string): string | null {
  if (address === '::x') {
    return '::x';
  }

  if (address.endsWith('::x')) {
    const prefix = address.slice(0, -3);
    const groups = prefix.length > 0 ? prefix.split(':') : [];
    if (groups.length <= 3 && groups.every(isValidHexGroup)) {
      return `${groups.map((g) => parseInt(g, 16).toString(16)).join(':')}::x`;
    }
    return null;
  }

  const doubleColonParts = address.split('::');
  if (doubleColonParts.length > 2) return null;

  let fullGroups: string[];
  if (doubleColonParts.length === 2) {
    const left = doubleColonParts[0] ? doubleColonParts[0].split(':') : [];
    const right = doubleColonParts[1] ? doubleColonParts[1].split(':') : [];
    if (!left.every(isValidHexGroup) || !right.every(isValidHexGroup)) return null;
    const missing = 8 - (left.length + right.length);
    if (missing < 1) return null;
    fullGroups = [...left, ...Array<string>(missing).fill('0'), ...right];
  } else {
    const groups = address.split(':');
    if (groups.length !== 8 || !groups.every(isValidHexGroup)) return null;
    fullGroups = groups;
  }

  const prefix48 = fullGroups.slice(0, 3).map((g) => parseInt(g, 16).toString(16));
  while (prefix48.length > 0 && prefix48[prefix48.length - 1] === '0') {
    prefix48.pop();
  }

  return prefix48.length > 0 ? `${prefix48.join(':')}::x` : '::x';
}

/**
 * Normalizes and masks a session IP address idempotently for display in Account Security.
 * Preserves loopback labels locally and masks public IPv4 (`203.0.113.x`) and IPv6 `/48` (`2001:db8:85a3::x`).
 */
export function formatSessionIpAddress(rawIp: string | null | undefined): string | null {
  const trimmed = typeof rawIp === 'string' ? rawIp.trim() : '';
  if (!trimmed) return null;

  const slashIdx = trimmed.indexOf('/');
  const withoutCidr = slashIdx >= 0 ? trimmed.slice(0, slashIdx).trim() : trimmed;
  if (!withoutCidr) return null;

  const lower = withoutCidr.toLowerCase();
  const normalized = lower.startsWith('::ffff:') ? lower.slice('::ffff:'.length) : lower;

  if (normalized === '127.0.0.1') {
    return '127.0.0.1 (Localhost)';
  }
  if (lower === '::1') {
    return '::1 (Localhost)';
  }

  const ipv4Parts = normalized.split('.');
  if (
    ipv4Parts.length === 4 &&
    isValidIpv4Octet(ipv4Parts[0]) &&
    isValidIpv4Octet(ipv4Parts[1]) &&
    isValidIpv4Octet(ipv4Parts[2]) &&
    (ipv4Parts[3] === 'x' || isValidIpv4Octet(ipv4Parts[3]))
  ) {
    return `${Number(ipv4Parts[0])}.${Number(ipv4Parts[1])}.${Number(ipv4Parts[2])}.x`;
  }

  if (lower.includes(':')) {
    return formatIpv6PrefixMask(lower);
  }

  return null;
}

/**
 * Formats an ISO session timestamp into a concise date/time label for the Security UI.
 */
export function formatSessionTimestamp(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return 'Unknown';
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}
