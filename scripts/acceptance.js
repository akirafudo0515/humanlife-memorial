const fs = require('fs');
const path = require('path');

const base = 'http://127.0.0.1:3000';
const failures = [];

function assert(name, condition) {
  if (!condition) failures.push(name);
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`);
}

function client() {
  let cookie = '';
  return {
    async fetch(url, options = {}) {
      const headers = new Headers(options.headers || {});
      if (cookie) headers.set('cookie', cookie);
      const response = await fetch(new URL(url, base), { ...options, headers, redirect: 'manual' });
      const setCookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
      setCookies.forEach((item) => {
        const pair = item.split(';')[0];
        if (pair.startsWith('sid=')) cookie = pair;
      });
      return response;
    }
  };
}

async function textOf(response) {
  return response.text();
}

async function follow(actor, response) {
  if (response.status >= 300 && response.status < 400) {
    return actor.fetch(response.headers.get('location'));
  }
  return response;
}

function form(fields) {
  return new URLSearchParams(fields);
}

(async () => {
  const health = await fetch(`${base}/health`);
  assert('health', (await health.json()).ok === true);

  const home = await textOf(await fetch(`${base}/`));
  assert('home introduces the house', home.includes('關於人本') && home.includes('為一位家人'));
  assert('home has no rehearsal language', !home.includes('測試') && !home.includes('示範') && !home.includes('八步'));

  const about = await textOf(await fetch(`${base}/about`));
  assert('about explains the site', about.includes('一處可以回來的靈堂') && about.includes('給家屬') && about.includes('給親友'));

  const login = await textOf(await fetch(`${base}/login`));
  assert('login page', login.includes('登入') && !login.includes('重寄確認信'));
  const register = await textOf(await fetch(`${base}/register`));
  assert('register page', register.includes('註冊') && register.includes('信箱'));

  const blank = await fetch(`${base}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ name: '', email: '', phone: '', relation: '子女', password: '', confirm: '' })
  });
  assert('blank register rejected', blank.status === 400);

  const email = `chen.${Date.now()}@example.com`;
  const family = client();
  let response = await family.fetch('/register', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({
      name: '陳家屬',
      email,
      phone: '0912000111',
      relation: '子女',
      password: 'memorial1',
      confirm: 'memorial1'
    })
  });
  response = await follow(family, response);
  const verifyPage = await textOf(response);
  assert('verification code page', verifyPage.includes('填寫驗證碼') && verifyPage.includes(email) && !verifyPage.includes('name="email" type="email"'));

  response = await family.fetch('/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ email, password: 'memorial1' })
  });
  response = await follow(family, response);
  assert('login waits for code', (await textOf(response)).includes('請填入驗證碼'));

  const outbox = path.join(__dirname, '..', 'data', 'outbox');
  const letter = fs.readdirSync(outbox).filter((name) => name.endsWith('.json')).sort().at(-1);
  const code = JSON.parse(fs.readFileSync(path.join(outbox, letter), 'utf8')).code;
  response = await follow(family, await family.fetch('/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ email, code })
  }));
  assert('email verified', (await textOf(response)).includes('信箱已確認'));

  response = await family.fetch('/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ email, password: 'memorial1' })
  });
  response = await follow(family, response);
  let page = await textOf(response);
  assert('service home after login', page.includes('會員專區') && page.includes('陳家屬'));

  response = await family.fetch('/memorials', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ deceasedName: '陳奶奶', birthDate: '1934-01-08', deathDate: '2026-02-14', title: '慈愛長存', story: '一生照看孫輩，喜歡清晨散步。' })
  });
  response = await follow(family, response);
  page = await textOf(response);
  assert('memorial created', page.includes('陳奶奶') && page.includes('邀請親友'));
  const invite = page.match(/id="invite-link" readonly value="([^"]+)"/);
  assert('invite link exists', Boolean(invite));
  const hallPath = new URL(invite[1]).pathname;

  const guest = await textOf(await fetch(`${base}${hallPath}`));
  assert('guest hall is a memorial', guest.includes('陳奶奶') && guest.includes('生平事略') && !guest.includes('整理此靈堂'));
  assert('capsule sealed', guest.includes('尚未開啟'));

  response = await fetch(`${base}${hallPath}/rituals`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ type: 'light' }),
    redirect: 'manual'
  });
  const hall = await textOf(await fetch(new URL(response.headers.get('location'), base)));
  assert('light recorded', hall.includes('已為先人點燈') && hall.includes('>1<'));

  const password = fs.readFileSync(path.join(__dirname, '..', 'data', 'admin.local.txt'), 'utf8').match(/password=(.+)/)[1].trim();
  const admin = client();
  response = await admin.fetch('/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ username: 'admin', password })
  });
  response = await follow(admin, response);
  assert('admin overview', (await textOf(response)).includes('概況'));
  const members = await textOf(await follow(admin, await admin.fetch('/admin/members')));
  assert('admin sees member', members.includes('陳家屬') && members.includes(email));

  const productsPage = await textOf(await follow(admin, await admin.fetch('/admin/products')));
  const productId = productsPage.match(/\/admin\/products\/([0-9a-f-]+)/)[1];
  response = await admin.fetch(`/admin/products/${productId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ name: '追思花禮', summary: '獻於靈堂的一份花禮。', price: '300', shelf: 'off' })
  });
  await follow(admin, response);
  const services = await textOf(await fetch(`${base}/services`));
  assert('unlisted product leaves the shop', !services.includes('追思花禮') && services.includes('祈福燈座'));

  response = await admin.fetch('/admin/settings', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({
      sitePhone: '02-1234-5678',
      siteEmail: 'hello@example.com',
      siteAddress: '台北市',
      aboutLead: '人本生命禮儀為家人預備一處線上靈堂。'
    })
  });
  await follow(admin, response);
  const homeAfter = await textOf(await fetch(`${base}/`));
  assert('settings reach the homepage', homeAfter.includes('02-1234-5678'));

  if (failures.length) {
    console.log(failures.join('\n'));
    process.exit(1);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
