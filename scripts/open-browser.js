const { exec } = require('child_process');
const http = require('http');
const https = require('https');

const targetUrl = process.argv[2] || 'http://localhost:3000';
const maxWaitMs = 30000;
const pollIntervalMs = 250;
const startTime = Date.now();

console.log(`🌐 Waiting for server at ${targetUrl} to become ready...`);

let hasLaunched = false;

function launchBrowser() {
  if (hasLaunched) return;
  hasLaunched = true;

  const start =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
      ? 'start'
      : 'xdg-open';

  exec(`${start} ${targetUrl}`, (err) => {
    if (err) {
      console.warn(`⚠️ Could not automatically launch browser: ${err.message}`);
    } else {
      console.log(`🚀 Browser opened to ${targetUrl}`);
    }
  });
}

function checkServerReady() {
  if (hasLaunched) return;

  const client = targetUrl.startsWith('https') ? https : http;
  const req = client.get(targetUrl, (res) => {
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
