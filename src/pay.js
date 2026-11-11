const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const configFile = path.join(__dirname, '..', 'data', 'pay.local.json');
const STAGE = {
  merchantId: '3002607',
  hashKey: 'pwFHCqoQZGmho4w6',
  hashIv: 'EkRm7iFT261dpevs',
  checkout: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5'
};

function payConfig() {
  const base = { ...STAGE, mode: 'stage' };
  if (!fs.existsSync(configFile)) return base;
  try {
    const saved = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    return { ...base, ...saved };
  } catch (_) {
    return base;
  }
}

function taipeiStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);
  const pick = (type) => parts.find((item) => item.type === type).value;
  return `${pick('year')}/${pick('month')}/${pick('day')} ${pick('hour')}:${pick('minute')}:${pick('second')}`;
}

function tradeNo() {
  return `H${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`.slice(0, 20).toUpperCase();
}

function cleanText(value, max) {
  return String(value || '').replace(/[&%=#<>]/g, '').slice(0, max);
}

function ecpayEncode(value) {
  return encodeURIComponent(value)
    .replace(/%20/gi, '+')
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2a')
    .toLowerCase()
    .replace(/%2d/g, '-')
    .replace(/%5f/g, '_')
    .replace(/%2e/g, '.')
    .replace(/%21/g, '!')
    .replace(/%2a/g, '*')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')');
}

function checkMac(params, key, iv) {
  const raw = Object.keys(params)
    .filter((name) => name !== 'CheckMacValue' && params[name] !== undefined && params[name] !== null && params[name] !== '')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map((name) => `${name}=${params[name]}`)
    .join('&');
  return crypto.createHash('sha256').update(ecpayEncode(`HashKey=${key}&${raw}&HashIV=${iv}`)).digest('hex').toUpperCase();
}

function checkoutFields({ checkout, origin, cycle }) {
  const config = payConfig();
  const fields = {
    MerchantID: config.merchantId,
    MerchantTradeNo: checkout.merchant_trade_no,
    MerchantTradeDate: taipeiStamp(),
    PaymentType: 'aio',
    TotalAmount: String(checkout.amount),
    TradeDesc: cleanText(checkout.item_label, 200),
    ItemName: cleanText(checkout.item_label, 200),
    ReturnURL: `${origin}/pay/ecpay/notify`,
    OrderResultURL: `${origin}/pay/ecpay/result`,
    ChoosePayment: checkout.category === 'plan' ? 'Credit' : 'ALL',
    EncryptType: '1',
    NeedExtraPaidInfo: 'N'
  };
  if (checkout.category === 'plan') {
    fields.PeriodAmount = String(checkout.amount);
    fields.PeriodType = cycle === 'year' ? 'Y' : 'M';
    fields.Frequency = '1';
    fields.ExecTimes = cycle === 'year' ? '5' : '12';
    fields.PeriodReturnURL = `${origin}/pay/ecpay/period`;
  }
  fields.CheckMacValue = checkMac(fields, config.hashKey, config.hashIv);
  return { action: config.checkout, fields, testCard: '4311-9522-2222-2222' };
}

function verifiedReturn(body) {
  const config = payConfig();
  const given = String(body.CheckMacValue || '');
  const expect = checkMac(body, config.hashKey, config.hashIv);
  if (!given || given.toUpperCase() !== expect) return null;
  return body;
}

module.exports = { payConfig, tradeNo, checkoutFields, verifiedReturn };
