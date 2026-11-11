const fs = require('fs');
const path = require('path');

const box = path.join(__dirname, '..', 'data', 'smsbox');
const configFile = path.join(__dirname, '..', 'data', 'sms.local.json');

function smsConfig() {
  if (!fs.existsSync(configFile)) return null;
  try {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    if (!config.url || !config.user || !config.pass) return null;
    return config;
  } catch (_) {
    return null;
  }
}

async function sendVerification({ to, code }) {
  const text = `時光仙境驗證碼 ${code}，30 分鐘內有效。`;
  const config = smsConfig();
  if (config) {
    const body = new URLSearchParams({
      username: config.user,
      password: config.pass,
      dstaddr: to,
      smbody: text
    });
    const response = await fetch(config.url, { method: 'POST', body });
    return response.ok;
  }
  fs.mkdirSync(box, { recursive: true });
  fs.writeFileSync(path.join(box, `${Date.now()}-${to}.json`), JSON.stringify({
    to, text, code, createdAt: new Date().toISOString()
  }, null, 2));
  return false;
}

module.exports = { sendVerification };
