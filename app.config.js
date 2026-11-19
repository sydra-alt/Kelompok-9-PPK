const fs = require('node:fs');
const path = require('node:path');

function loadLocalEnvironment() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;

    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    process.env[match[1]] = value;
  }
}

loadLocalEnvironment();

module.exports = ({ config }) => {
  const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!mapsApiKey) {
    throw new Error(
      'GOOGLE_MAPS_API_KEY belum diatur. Tambahkan ke .env.local atau environment build sebelum menjalankan Expo.',
    );
  }

  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      [
        'react-native-maps',
        {
          androidGoogleMapsApiKey: mapsApiKey,
        },
      ],
    ],
  };
};
