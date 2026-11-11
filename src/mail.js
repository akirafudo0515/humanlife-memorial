const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const outbox = path.join(__dirname, '..', 'data', 'outbox');
const configFile = path.join(__dirname, '..', 'data', 'mail.local.json');

function mailConfig() {
  if (!fs.existsSync(configFile)) return null;
  try {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    if (!config.host || !config.user || !config.pass) return null;
    return config;
  } catch (_) {
    return null;
  }
}

async function sendVerification({ to, name, code }) {
  const subject = '請確認您的信箱｜時光仙境';
  const text = `${name} 您好\n\n您的驗證碼是 ${code}\n請回到網站填入。驗證碼於 30 分鐘後失效。\n\n時光仙境`;
  const config = mailConfig();
  if (config) {
    const transport = nodemailer.createTransport({
      host: config.host,
      port: Number(config.port || 587),
      secure: Boolean(config.secure),
      auth: { user: config.user, pass: config.pass }
    });
    await transport.sendMail({
      from: config.from || config.user,
      to,
      subject,
      text
    });
    return true;
  }
  fs.mkdirSync(outbox, { recursive: true });
  fs.writeFileSync(path.join(outbox, `${Date.now()}-${to.replace(/[^\w.@-]/g, '_')}.json`), JSON.stringify({
    to, subject, text, code, createdAt: new Date().toISOString()
  }, null, 2));
  return false;
}

module.exports = { sendVerification };
