import fs from 'fs';

const env = {};
if (fs.existsSync('.env')) {
  const lines = fs.readFileSync('.env', 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const [key, ...rest] = line.split('=');
    env[key.trim()] = rest.join('=').trim();
  }
}

const keys = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID'
];

const output = {};
for (const key of keys) {
  output[key] = env[key] || '';
}

const content = `window._env_ = ${JSON.stringify(output, null, 2)};\n`;
fs.writeFileSync('env.js', content);
console.log('env.js generated');
