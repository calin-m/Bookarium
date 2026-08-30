const { exec } = require('child_process');

const url = process.argv[2] || 'http://localhost:3000';
const delay = parseInt(process.argv[3], 10) || 1500;

console.log(`🌐 Waiting ${delay}ms before opening ${url} in your default browser...`);

setTimeout(() => {
  const start =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
      ? 'start'
      : 'xdg-open';

  exec(`${start} ${url}`);
}, delay);
