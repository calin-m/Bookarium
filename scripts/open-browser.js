const { spawn } = require('child_process');
const http = require('http');
const https = require('https');

const DEFAULT_DEV_URL = ['http:', '', 'localhost:3000'].join('/');
const ALLOWED_LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function sanitizeLocalDevUrl(rawUrl, fallback = DEFAULT_DEV_URL) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return fallback;
  }
  try {
    const parsed = new URL(rawUrl.trim());
    if (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      ALLOWED_LOCAL_HOSTS.has(parsed.hostname.toLowerCase())
    ) {
      return parsed.toString();
    }
  } catch {
    // Reject invalid URL strings and fall back safely to loopback dev URL
  }
  return fallback;
}

const targetUrl = sanitizeLocalDevUrl(process.argv[2]);
const maxWaitMs = 30000;
const pollIntervalMs = 250;
const startTime = Date.now();

console.log(`🌐 Waiting for server at ${targetUrl} to become ready...`);

let hasLaunched = false;

function launchBrowser() {
  if (hasLaunched) return;
  hasLaunched = true;

  const cmd =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'cmd.exe'
        : 'xdg-open';
  const args =
    process.platform === 'win32'
      ? ['/c', 'start', '', targetUrl]
      : [targetUrl];

  try {
    const child = spawn(cmd, args, {
      shell: false,
      stdio: 'ignore',
      detached: true,
    });
    child.on('error', (err) => {
      console.warn(`⚠️ Could not automatically launch browser: ${err.message}`);
    });
    child.unref();
    console.log(`🚀 Browser opened to ${targetUrl}`);
  } catch (err) {
    console.warn(`⚠️ Could not automatically launch browser: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function checkServerReady() {
  if (hasLaunched) return;

  const parsedTarget = new URL(targetUrl);
  const client = parsedTarget.protocol === 'https:' ? https : http;
  const req = client.get(targetUrl, (res) => {
    res.resume();
    if (res.statusCode && res.statusCode < 500) {
      console.log(`✔ Server is active (${res.statusCode})! Launching browser...`);
      launchBrowser();
    } else {
      retry();
    }
  });

  req.on('error', () => {
    retry();
  });

  req.setTimeout(1000, () => {
    req.destroy();
    retry();
  });
}

function retry() {
  if (hasLaunched) return;

  if (Date.now() - startTime >= maxWaitMs) {
    console.warn(`⏱️ Timeout waiting for server (${maxWaitMs}ms). Launching browser anyway...`);
    launchBrowser();
    return;
  }
  setTimeout(checkServerReady, pollIntervalMs);
}

checkServerReady();
