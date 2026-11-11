const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const db = require('./db');
const view = require('./view');
const mail = require('./mail');
const sms = require('./sms');
const plans = require('./plans');

const app = express();
const port = Number(process.env.PORT || 3000);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, db.uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
    }
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'].includes(file.mimetype);
    cb(ok ? null : new Error('bad-file'), ok);
  }
});

const NOTICES = {
  registered: '驗證碼已寄出，請在下方填入。',
  verified: '信箱與手機都已確認，請登入。',
  partial: '這一組已確認。請再填另一組驗證碼。',
  'bad-code': '驗證碼不正確。',
  'code-expired': '驗證碼已失效，請重新寄送。',
  'too-many': '驗證碼錯誤次數過多，請重新寄送。',
  unverified: '請填入驗證碼。',
  'bad-login': '信箱、帳號或密碼不正確。',
  resent: '驗證碼已再次寄出。',
  'mail-off': '驗證碼暫時無法寄出，請與禮儀人員聯絡。',
  'phone-off': '信箱驗證碼已寄出。手機驗證碼暫時無法寄出，請與禮儀人員聯絡。',
  suspended: '此帳號已停用，請與我們聯絡。',
  saved: '已儲存。',
  created: '靈堂已建立。',
  uploaded: '已收到，確認後會出現在靈堂。',
  lit: '已為先人點燈。',
  flowered: '已獻上鮮花。',
  prayed: '已為先人祈福。',
  noted: '話已留在靈堂。',
  offered: '已奉入靈堂，位置可以再調整。',
  framed: '相框已換上。',
  opened: '時光膠囊已開啟。',
  ordered: '已託付，完成後奉入靈堂。',
  inquiry: '已收到，我們會與您聯絡。',
  'need-login': '請先登入。',
  'already-open': '時光膠囊已經開啟。',
  'off-shelf': '此項目目前未提供。',
  'no-file': '請先選擇檔案。',
  'bad-file': '檔案格式或大小不符合。',
  logout: '已登出。',
  published: '已公開。',
  'media-hidden': '已隱藏。',
  delivered: '已奉入靈堂。',
  'member-updated': '已更新。',
  'hall-limit': '目前的方案名額已滿。',
  'family-full': '這一間家族靈堂最多六位。',
  quota: '目前的方案空間或張數已滿。',
  'no-video': '目前的方案不能自行上傳影片。',
  'pay-done': '付款已完成。',
  'pay-fail': '這筆付款沒有完成。',
  'visit-asked': '已向家屬提出，請等候同意。',
  'visit-allowed': '已同意進入。',
  'visit-refused': '已婉拒。',
  'need-visit': '請先經家屬同意，再進入這一位的靈堂。',
  'plan-later': '更換方案請與禮儀人員聯絡。',
  'plan-set': '方案已更新。',
  'bad-mail': '無效帳號，請重新填入。',
  'trust-self': '不能指定自己代管。',
  'trust-set': '已送出代管邀請，等候對方同意。',
  'trust-clear': '已取消代管。',
  'trust-accepted': '已同意代管。',
  'trust-refused': '已婉拒代管。',
  'trust-full': '目前的代管名額已滿，無法再接下。',
  'share-accepted': '已接受時光膠囊分享。',
  'share-refused': '已婉拒時光膠囊分享。',
  'notice-missing': '找不到這則通知。',
  'converted': '已切換為身後，無法再改回生前。',
  'capsule-made': '已封存。開啟日之前不能查看，也不能再改。',
  'capsule-shared': '已加入共享。',
  'capsule-full': '共享人數已滿。',
  'capsule-limit': '目前的方案不能再建立時光膠囊。',
  'capsule-year': '目前的方案不能選擇這個年限。',
  'capsule-locked': '還沒到開啟日期。',
  'capsule-frozen': '開啟日已到，內容不能再改。',
  'replied': '已回覆。'
};

function noticeText(code) {
  return NOTICES[code] || '';
}

function redirectNotice(res, url, code) {
  const join = url.includes('?') ? '&' : '?';
  res.redirect(303, `${url}${join}notice=${encodeURIComponent(code)}`);
}

function originOf(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function cookieToken(req) {
  const header = req.headers.cookie || '';
  const found = header.split(';').map((item) => item.trim()).find((item) => item.startsWith('sid='));
  return found ? decodeURIComponent(found.slice(4)) : '';
}

function setSession(res, token) {
  res.setHeader('Set-Cookie', `sid=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=1209600`);
}

function clearSession(res) {
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}

function textField(value, max) {
  const text = String(value ?? '').trim();
  if (text.length > max) return { value: '', error: true };
  return { value: text, error: false };
}

function emailOk(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function phoneOk(value) {
  return /^09\d{8}$/.test(value);
}

const codeAttempts = new Map();

function attemptBlocked(email) {
  const row = codeAttempts.get(email.toLowerCase());
  if (!row) return false;
  if (Date.now() - row.at > 30 * 60 * 1000) {
    codeAttempts.delete(email.toLowerCase());
    return false;
  }
  return row.n >= 8;
}

function noteAttempt(email) {
  const key = email.toLowerCase();
  const row = codeAttempts.get(key) || { n: 0, at: Date.now() };
  row.n += 1;
  row.at = Date.now();
  codeAttempts.set(key, row);
}

function clearAttempt(email) {
  codeAttempts.delete(email.toLowerCase());
}

app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '40kb' }));
app.use('/assets', express.static(path.join(db.root, 'public')));

app.use((req, res, next) => {
  req.settings = db.getSettings();
  const session = db.readSession(cookieToken(req));
  req.sessionToken = session ? session.token : '';
  req.member = session && session.subject_type === 'member' ? db.getMember(session.subject_id) : null;
  if (req.member && req.member.status !== 'active') req.member = null;
  if (req.member) req.member.noticeCount = db.pendingNoticeCount(req.member.id);
  req.adminId = session && session.subject_type === 'admin' ? session.subject_id : '';
  next();
});

function requireMember(req, res, next) {
  if (!req.member) {
    redirectNotice(res, '/login', 'need-login');
    return;
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.adminId) {
    res.redirect(303, '/admin/login');
    return;
  }
  next();
}

function page(res, html, status) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.status(status || 200).type('html').send(html);
}

function safeNext(value) {
  const text = String(value || '').trim();
  if (!text.startsWith('/') || text.startsWith('//') || text.includes('\\') || text.includes('://')) return '';
  return text.slice(0, 200);
}

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  page(res, view.home({
    settings: req.settings,
    member: req.member,
    notice: noticeText(req.query.notice)
  }));
});

app.get('/about', (req, res) => {
  page(res, view.about({ settings: req.settings, member: req.member, notice: noticeText(req.query.notice) }));
});

app.get('/services', (req, res) => {
  page(res, view.services({
    settings: req.settings,
    products: db.listProducts('on'),
    member: req.member,
    notice: noticeText(req.query.notice)
  }));
});

app.get('/login', (req, res) => {
  const next = safeNext(req.query.next);
  if (req.member) {
    res.redirect(303, next || '/account');
    return;
  }
  page(res, view.authPage({
    settings: req.settings,
    mode: 'login',
    notice: noticeText(req.query.notice),
    errors: [],
    email: '',
    next
  }));
});

app.post('/login', (req, res) => {
  const email = textField(req.body.email, 120);
  const password = textField(req.body.password, 72);
  const next = safeNext(req.body.next);
  const admin = email.value && password.value ? db.verifyAdmin(email.value, password.value) : null;
  if (admin) {
    if (req.sessionToken) db.deleteSession(req.sessionToken);
    setSession(res, db.createSession('admin', admin.id));
    res.redirect(303, '/admin');
    return;
  }
  const member = email.value ? db.getMemberByEmail(email.value) : null;
  if (!member || !password.value || !db.verifyPassword(password.value, member.password_hash)) {
    page(res, view.authPage({
      settings: req.settings,
      mode: 'login',
      notice: '',
      errors: [NOTICES['bad-login']],
      email: email.value,
      next
    }), 400);
    return;
  }
  if (member.status === 'pending') {
    redirectNotice(res, `/verify?email=${encodeURIComponent(member.email)}`, 'unverified');
    return;
  }
  if (member.status === 'suspended') {
    redirectNotice(res, '/login', 'suspended');
    return;
  }
  if (req.sessionToken) db.deleteSession(req.sessionToken);
  setSession(res, db.createSession('member', member.id));
  res.redirect(303, next || '/account');
});

app.post('/logout', (req, res) => {
  db.deleteSession(req.sessionToken);
  clearSession(res);
  redirectNotice(res, '/', 'logout');
});

app.get('/register', (req, res) => {
  const next = safeNext(req.query.next);
  if (req.member) {
    res.redirect(303, next || '/account');
    return;
  }
  page(res, view.authPage({
    settings: req.settings,
    mode: 'register',
    notice: noticeText(req.query.notice),
    errors: [],
    email: '',
    next
  }));
});

app.post('/register', async (req, res) => {
  const name = textField(req.body.name, 40);
  const email = textField(req.body.email, 120);
  const phone = textField(req.body.phone, 40);
  const password = textField(req.body.password, 72);
  const confirm = textField(req.body.confirm, 72);
  const next = safeNext(req.body.next);
  const errors = [];
  if (!name.value) errors.push('請填寫姓名。');
  if (!email.value || !emailOk(email.value)) errors.push('請填寫有效的信箱。');
  if (!phone.value || !phoneOk(phone.value)) errors.push('請填寫 09 開頭的 10 碼手機。');
  if (!password.value || password.value.length < 8) errors.push('密碼至少 8 碼。');
  if (password.value !== confirm.value) errors.push('兩次密碼不一致。');
  if (email.value && db.getMemberByEmail(email.value)) errors.push('這個信箱已經註冊。若尚未確認，請用這個信箱登入並填寫驗證碼。');
  if (phone.value && db.memberByPhone(phone.value)) errors.push('這個手機已經註冊。');
  if (errors.length) {
    page(res, view.authPage({
      settings: req.settings,
      mode: 'register',
      notice: '',
      errors,
      email: email.value,
      next
    }), 400);
    return;
  }
  const member = db.createMember({
    name: name.value,
    email: email.value,
    phone: phone.value,
    password: password.value,
    relation: ''
  });
  const emailCode = db.issueVerifyCode(member.id);
  const phoneCode = db.issuePhoneCode(member.id);
  const sentMail = await mail.sendVerification({ to: member.email, name: member.name, code: emailCode });
  const sentSms = await sms.sendVerification({ to: member.phone, code: phoneCode });
  const notice = sentMail && sentSms ? 'registered' : sentMail ? 'phone-off' : 'mail-off';
  redirectNotice(res, `/verify?email=${encodeURIComponent(member.email)}`, notice);
});

app.get('/verify', (req, res) => {
  if (req.member) {
    res.redirect(303, '/account');
    return;
  }
  const email = textField(req.query.email, 120);
  const member = emailOk(email.value) ? db.getMemberByEmail(email.value) : null;
  page(res, view.verifyPage({
    settings: req.settings,
    email: member ? member.email : '',
    emailVerified: Boolean(member && member.email_verified),
    phoneVerified: Boolean(member && member.phone_verified),
    notice: noticeText(req.query.notice),
    errors: []
  }));
});

app.post('/verify', (req, res) => {
  const email = textField(req.body.email, 120);
  const back = `/verify?email=${encodeURIComponent(email.value)}`;
  const member = emailOk(email.value) ? db.getMemberByEmail(email.value) : null;
  if (!member || member.status === 'suspended') {
    redirectNotice(res, back, 'bad-code');
    return;
  }
  if (member.status === 'active') {
    redirectNotice(res, '/login', 'verified');
    return;
  }
  if (attemptBlocked(email.value)) {
    redirectNotice(res, back, 'too-many');
    return;
  }
  let result = 'partial';
  if (!member.email_verified) {
    const emailCode = textField(req.body.emailCode, 6);
    result = /^\d{6}$/.test(emailCode.value) ? db.consumeVerifyCode(email.value, emailCode.value, 'email') : 'bad';
  }
  const current = db.getMemberByEmail(email.value);
  if (current && current.status !== 'active' && !current.phone_verified && result !== 'bad' && result !== 'expired' && result !== 'missing') {
    const phoneCode = textField(req.body.phoneCode, 6);
    result = /^\d{6}$/.test(phoneCode.value) ? db.consumeVerifyCode(email.value, phoneCode.value, 'phone') : 'bad';
  }
  if (result === 'bad') noteAttempt(email.value);
  if (result === 'verified' || result === 'active') clearAttempt(email.value);
  const notice = result === 'verified' || result === 'active' ? 'verified' : result === 'partial' ? 'partial' : result === 'expired' ? 'code-expired' : 'bad-code';
  redirectNotice(res, result === 'verified' || result === 'active' ? '/login' : back, notice);
});

app.post('/resend', async (req, res) => {
  const email = textField(req.body.email, 120);
  const back = `/verify?email=${encodeURIComponent(email.value)}`;
  const member = emailOk(email.value) ? db.getMemberByEmail(email.value) : null;
  if (member && member.status === 'active') {
    redirectNotice(res, '/login', 'verified');
    return;
  }
  if (member && member.status === 'pending') {
    clearAttempt(member.email);
    let sentMail = true;
    let sentSms = true;
    if (!member.email_verified) {
      const code = db.issueVerifyCode(member.id);
      sentMail = await mail.sendVerification({ to: member.email, name: member.name, code });
    }
    if (!member.phone_verified) {
      const code = db.issuePhoneCode(member.id);
      sentSms = await sms.sendVerification({ to: member.phone, code });
    }
    redirectNotice(res, back, sentMail && sentSms ? 'resent' : sentMail ? 'phone-off' : 'mail-off');
    return;
  }
  redirectNotice(res, emailOk(email.value) ? back : '/login', 'resent');
});

app.get('/consult', (req, res) => {
  page(res, view.consult({
    settings: req.settings,
    notice: noticeText(req.query.notice),
    errors: []
  }));
});

app.post('/consult', (req, res) => {
  const name = textField(req.body.leadName, 40);
  const contact = textField(req.body.leadContact, 80);
  const need = textField(req.body.need, 400);
  const errors = [];
  if (!name.value) errors.push('請填寫姓名。');
  if (!contact.value) errors.push('請填寫聯絡方式。');
  if (need.error) errors.push('內容過長。');
  if (errors.length) {
    page(res, view.consult({ settings: req.settings, notice: '', errors }), 400);
    return;
  }
  db.addInquiry({ name: name.value, contact: contact.value, need: need.value });
  redirectNotice(res, '/consult', 'inquiry');
});

app.get('/account', requireMember, (req, res) => {
  const allowance = db.hallAllowance(req.member.id);
  page(res, view.account({
    settings: req.settings,
    member: req.member,
    memorials: db.listMemorialsByMember(req.member.id),
    trustPages: db.listMemorialsAsTrustee(req.member.id),
    capsules: db.listCapsulesByMember(req.member.id),
    sharedCapsules: db.listCapsulesSharedWith(req.member.id),
    plan: allowance.plan,
    usage: allowance.usage,
    canCreate: allowance.canCreate,
    canCreateFamily: allowance.canCreateFamily,
    notice: noticeText(req.query.notice)
  }));
});

app.get('/account/usage', requireMember, (req, res) => {
  page(res, view.usagePage({
    settings: req.settings,
    member: req.member,
    plan: db.memberPlan(req.member.id),
    usage: db.memberUsageDetail(req.member.id),
    notice: noticeText(req.query.notice)
  }));
});

app.get('/plans', (req, res) => {
  page(res, view.plansPage({
    settings: req.settings,
    member: req.member,
    plans: plans.PLANS,
    current: req.member ? db.memberPlan(req.member.id) : null,
    notice: noticeText(req.query.notice)
  }));
});

app.post('/plans', requireMember, (req, res) => {
  redirectNotice(res, '/plans', 'plan-later');
});

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function lifeDates(birth, death) {
  const one = (value) => {
    const [year, month, day] = value.split('-').map(Number);
    return `${year}年${month}月${day}日`;
  };
  if (birth && death) return `${one(birth)}生　${one(death)}往生`;
  if (death) return `${one(death)}往生`;
  if (birth) return `${one(birth)}生`;
  return '';
}

function memorialFields(body, mode) {
  const deceasedName = textField(body.deceasedName, 40);
  const birthDate = textField(body.birthDate, 10);
  const deathDate = textField(body.deathDate, 10);
  const title = textField(body.title, 80);
  const story = textField(body.story, 4000);
  const living = mode === 'living';
  const errors = [];
  if (!deceasedName.value) errors.push(living ? '請填寫姓名。' : '請填寫名諱。');
  if (!living && !validDate(birthDate.value)) errors.push('請選擇出生日期。');
  if (living && birthDate.value && !validDate(birthDate.value)) errors.push('請選擇出生日期。');
  if (!living && !validDate(deathDate.value)) errors.push('請選擇往生日期。');
  if (validDate(birthDate.value) && validDate(deathDate.value) && birthDate.value > deathDate.value) errors.push('往生日期應晚於出生日期。');
  if (!story.value) errors.push(living ? '請寫下想留下的話。' : '請填寫生平事略。');
  if (title.error || story.error) errors.push('有欄位過長。');
  const birth = validDate(birthDate.value) ? birthDate.value : '';
  const death = living ? '' : (validDate(deathDate.value) ? deathDate.value : '');
  return {
    deceasedName: deceasedName.value,
    birthDate: birth,
    deathDate: death,
    years: lifeDates(birth, death),
    title: title.value,
    story: story.value,
    errors
  };
}

function activeByEmail(email) {
  const member = email && emailOk(email) ? db.getMemberByEmail(email) : null;
  if (!member || member.status !== 'active') return null;
  return member;
}

app.get('/memorials/new', requireMember, (req, res) => {
  const family = req.query.kind === 'family';
  const allowance = db.hallAllowance(req.member.id);
  if (family ? !allowance.canCreateFamily : !allowance.canCreate) {
    redirectNotice(res, '/account', 'hall-limit');
    return;
  }
  page(res, view.editor({
    settings: req.settings,
    member: req.member,
    memorial: null,
    family,
    products: db.listProducts('on'),
    allowance,
    notice: noticeText(req.query.notice),
    errors: []
  }));
});

app.post('/memorials', requireMember, (req, res) => {
  const family = req.body.kind === 'family';
  const fields = memorialFields(req.body, family ? 'deceased' : 'living');
  const allowance = db.hallAllowance(req.member.id);
  if (fields.errors.length) {
    page(res, view.editor({
      settings: req.settings,
      member: req.member,
      family,
      memorial: {
        deceased_name: fields.deceasedName,
        years: fields.years,
        birth_date: fields.birthDate,
        death_date: fields.deathDate,
        title: fields.title,
        story: fields.story,
        life_state: family ? 'deceased' : 'living',
        hall_kind: family ? 'family' : 'single'
      },
      products: db.listProducts('on'),
      allowance,
      notice: '',
      errors: fields.errors
    }), 400);
    return;
  }
  if (family ? !allowance.canCreateFamily : !allowance.canCreate) {
    redirectNotice(res, '/account', 'hall-limit');
    return;
  }
  const memorial = db.createMemorial({
    memberId: req.member.id,
    ...fields,
    lifeState: family ? 'deceased' : 'living',
    hallKind: family ? 'family' : 'single'
  });
  if (family) {
    db.addHallPerson({
      memorialId: memorial.id,
      name: fields.deceasedName,
      birthDate: fields.birthDate,
      deathDate: fields.deathDate,
      title: fields.title,
      story: fields.story
    });
  }
  redirectNotice(res, `/memorials/${memorial.id}`, 'created');
});

function ownMemorial(req, res) {
  const memorial = db.getMemorial(req.params.id);
  if (!memorial || memorial.member_id !== req.member.id) {
    page(res, view.missing(req.settings), 404);
    return null;
  }
  return memorial;
}

function editorPage(req, res, memorial, status, errors, extra) {
  const trustee = memorial.trustee_member_id ? db.getMember(memorial.trustee_member_id) : null;
  const trusteePending = !trustee ? db.pendingTrusteeInvite(memorial.id) : null;
  page(res, view.editor({
    settings: req.settings,
    member: req.member,
    memorial,
    family: memorial.hall_kind === 'family',
    people: db.listHallPeople(memorial.id),
    media: db.listMedia(memorial.id),
    orders: db.adminSnapshot().orders.filter((item) => item.memorial_id === memorial.id),
    products: db.listProducts('on'),
    invite: `${originOf(req)}/hall/${memorial.invite_code}`,
    visits: db.listVisits(memorial.id),
    allowance: db.hallAllowance(req.member.id),
    trustee,
    trusteePending,
    trusteeBlocked: extra && extra.trusteeBlocked,
    notice: noticeText(req.query.notice),
    errors: errors || []
  }), status);
}

app.get('/memorials/:id', requireMember, (req, res) => {
  const memorial = ownMemorial(req, res);
  if (!memorial) return;
  editorPage(req, res, memorial);
});

app.post('/memorials/:id', requireMember, (req, res) => {
  const memorial = ownMemorial(req, res);
  if (!memorial) return;
  const living = memorial.life_state !== 'deceased' && memorial.hall_kind !== 'family';
  const fields = memorialFields(req.body, living ? 'living' : 'deceased');
  if (fields.errors.length) {
    editorPage(req, res, { ...memorial, deceased_name: fields.deceasedName, birth_date: fields.birthDate, death_date: fields.deathDate, years: fields.years, title: fields.title, story: fields.story }, 400, fields.errors);
    return;
  }
  db.updateMemorial(memorial.id, fields);
  redirectNotice(res, `/memorials/${memorial.id}`, 'saved');
});

app.post('/memorials/:id/people', requireMember, (req, res) => {
  const memorial = ownMemorial(req, res);
  if (!memorial) return;
  if (memorial.hall_kind !== 'family') {
    redirectNotice(res, `/memorials/${memorial.id}`, 'off-shelf');
    return;
  }
  const seats = db.memberPlan(req.member.id).familySeats || 0;
  if (db.listHallPeople(memorial.id).length >= seats) {
    redirectNotice(res, `/memorials/${memorial.id}`, 'family-full');
    return;
  }
  const fields = memorialFields(req.body, 'deceased');
  if (fields.errors.length) {
    editorPage(req, res, memorial, 400, fields.errors);
    return;
  }
  db.addHallPerson({
    memorialId: memorial.id,
    name: fields.deceasedName,
    birthDate: fields.birthDate,
    deathDate: fields.deathDate,
    title: fields.title,
    story: fields.story
  });
  redirectNotice(res, `/memorials/${memorial.id}`, 'saved');
});

app.post('/memorials/:id/trustee', requireMember, (req, res) => {
  const memorial = ownMemorial(req, res);
  if (!memorial) return;
  if (memorial.life_state !== 'living') {
    redirectNotice(res, `/memorials/${memorial.id}`, 'off-shelf');
    return;
  }
  if (req.body.clear === '1') {
    db.clearTrustee(memorial.id);
    redirectNotice(res, `/memorials/${memorial.id}`, 'trust-clear');
    return;
  }
  const email = textField(req.body.email, 120);
  const target = activeByEmail(email.value);
  if (!target) {
    editorPage(req, res, memorial, 400, [NOTICES['bad-mail']]);
    return;
  }
  if (target.id === req.member.id) {
    editorPage(req, res, memorial, 400, [NOTICES['trust-self']]);
    return;
  }
  const cap = db.memberPlan(target.id).trusts || 1;
  const used = db.trustCount(target.id);
  if (used >= cap && memorial.trustee_member_id !== target.id) {
    editorPage(req, res, memorial, 200, [], { trusteeBlocked: target });
    return;
  }
  db.inviteTrustee(memorial.id, req.member.id, target.id);
  redirectNotice(res, `/memorials/${memorial.id}`, 'trust-set');
});

app.get('/account/notices', requireMember, (req, res) => {
  page(res, view.noticesPage({
    settings: req.settings,
    member: req.member,
    notices: db.listNoticesForMember(req.member.id),
    notice: noticeText(req.query.notice)
  }));
});

app.post('/account/notices/:id', requireMember, (req, res) => {
  const before = db.getNotice(req.params.id);
  const decision = req.body.status === 'accepted' ? 'accepted' : 'refused';
  const result = db.respondNotice(req.params.id, req.member.id, decision);
  let mapped = 'notice-missing';
  if (result === 'accepted') mapped = before && before.kind === 'trustee_invite' ? 'trust-accepted' : 'share-accepted';
  else if (result === 'refused') mapped = before && before.kind === 'trustee_invite' ? 'trust-refused' : 'share-refused';
  else if (result === 'trust-full') mapped = 'trust-full';
  redirectNotice(res, '/account/notices', mapped);
});

app.post('/memorials/:id/media', requireMember, (req, res) => {
  upload.single('file')(req, res, (error) => {
    const memorial = ownMemorial(req, res);
    if (!memorial) return;
    if (error || !req.file) {
      redirectNotice(res, `/memorials/${memorial.id}`, error ? 'bad-file' : 'no-file');
      return;
    }
    const kind = req.file.mimetype === 'video/mp4' ? 'video' : 'photo';
    const role = kind === 'photo' && req.body.role === 'portrait' ? 'portrait' : 'album';
    const duration = Math.round(Number(req.body.duration) || 0);
    const allowance = db.hallAllowance(memorial.member_id);
    const usage = allowance.usage;
    const plan = allowance.plan;
    const reject = (code) => {
      fs.unlink(path.join(db.uploadsDir, req.file.filename), () => {});
      redirectNotice(res, `/memorials/${memorial.id}`, code);
    };
    if (kind === 'photo' && req.file.size > 8 * 1024 * 1024) {
      reject('bad-file');
      return;
    }
    if (kind === 'video' && plan.videoSeconds <= 0) {
      reject('no-video');
      return;
    }
    if (kind === 'video' && (duration < 1 || usage.video_seconds + duration > plan.videoSeconds)) {
      reject('quota');
      return;
    }
    if (kind === 'photo' && plan.photos > 0 && usage.photos >= plan.photos) {
      reject('quota');
      return;
    }
    if (usage.bytes + req.file.size > plan.bytes) {
      reject('quota');
      return;
    }
    const caption = textField(req.body.caption, 80);
    db.addMedia({
      memorialId: memorial.id,
      kind,
      source: 'family',
      caption: caption.value || (role === 'portrait' ? '主遺影' : (kind === 'video' ? '影片' : '照片')),
      filePath: req.file.filename,
      status: 'pending_review',
      bytes: req.file.size,
      durationSeconds: kind === 'video' ? duration : 0,
      role
    });
    redirectNotice(res, `/memorials/${memorial.id}`, 'uploaded');
  });
});

app.post('/memorials/:id/capsule', requireMember, (req, res) => {
  const memorial = ownMemorial(req, res);
  if (!memorial) return;
  const product = db.getProductBySku('capsule');
  if (!product || product.shelf !== 'on') {
    redirectNotice(res, `/memorials/${memorial.id}`, 'off-shelf');
    return;
  }
  if (memorial.capsule_status === 'open') {
    redirectNotice(res, `/memorials/${memorial.id}`, 'already-open');
    return;
  }
  const result = db.openCapsule(memorial, product, req.member.name);
  redirectNotice(res, `/memorials/${memorial.id}`, result);
});

app.post('/memorials/:id/commission', requireMember, (req, res) => {
  const memorial = ownMemorial(req, res);
  if (!memorial) return;
  const product = db.getProductBySku(textField(req.body.sku, 40).value);
  if (!product || product.kind !== 'commission' || product.shelf !== 'on') {
    redirectNotice(res, `/memorials/${memorial.id}`, 'off-shelf');
    return;
  }
  const quoted = Number(String(req.body.amount || '').trim());
  const amount = Number.isInteger(quoted) && quoted >= 1 && quoted <= 1000000 ? quoted : product.price;
  db.addOrder({
    memorialId: memorial.id,
    productId: product.id,
    payerName: req.member.name,
    category: 'commission',
    itemLabel: product.name,
    amount,
    serviceStatus: 'producing'
  });
  redirectNotice(res, `/memorials/${memorial.id}`, 'ordered');
});

function hallRole(member, memorial) {
  if (!member) return 'guest';
  if (member.id === memorial.member_id) return 'owner';
  if (memorial.life_state === 'living' && member.id === memorial.trustee_member_id) return 'trustee';
  const open = db.hallAllowance(memorial.member_id).openIds.includes(memorial.id);
  if (!open) return 'closed';
  const visit = db.visitOf(memorial.id, member.id);
  if (!visit) return 'none';
  if (visit.status === 'allowed') return 'visitor';
  return visit.status === 'pending' || visit.status === 'refused' ? visit.status : 'none';
}

function hallPage(req, res, memorial, status, errors) {
  const role = hallRole(req.member, memorial);
  if (role !== 'owner' && role !== 'visitor' && role !== 'trustee') {
    page(res, view.hallGate({
      settings: req.settings,
      member: req.member,
      memorial,
      role,
      notice: noticeText(req.query.notice)
    }), status || 200);
    return;
  }
  const capsule = db.getProductBySku('capsule');
  const ownerId = memorial.member_id;
  const grants = db.planFrameSkus(ownerId);
  const plan = db.memberPlan(ownerId);
  const canManageMedia = role === 'owner' || role === 'trustee';
  const media = canManageMedia
    ? db.listMedia(memorial.id).filter((item) => item.file_path)
    : db.listPublicMedia(memorial.id);
  page(res, view.hall({
    settings: req.settings,
    memorial,
    owner: role === 'owner',
    counts: db.ritualCounts(memorial.id),
    messages: db.listPublicMessages(memorial.id),
    people: db.listHallPeople(memorial.id),
    total: db.pageTotal(memorial.id),
    media,
    trustee: role === 'trustee',
    offerings: db.listProducts('on').filter((item) => item.kind === 'offering' && !String(item.sku).startsWith('frame-')),
    frames: db.listProducts('on').filter((item) => String(item.sku).startsWith('frame-')),
    ownedFrames: db.listOwnedFrames(memorial.id),
    grantedFrames: grants,
    frameSlots: Math.max(0, plan.frames - grants.length),
    items: db.listRoomItems(memorial.id),
    capsuleOpenPrice: capsule && capsule.shelf === 'on' ? capsule.price : 0,
    notice: noticeText(req.query.notice),
    errors: errors || []
  }), status);
}

app.get('/hall/:code', (req, res) => {
  const memorial = db.getMemorialByCode(req.params.code);
  if (!memorial) {
    page(res, view.missing(req.settings), 404);
    return;
  }
  hallPage(req, res, memorial);
});

app.post('/hall/:code/rituals', (req, res) => {
  const memorial = db.getMemorialByCode(req.params.code);
  if (!memorial) {
    page(res, view.missing(req.settings), 404);
    return;
  }
  const role = hallRole(req.member, memorial);
  if (memorial.life_state !== 'deceased' || (role !== 'owner' && role !== 'visitor')) {
    redirectNotice(res, `/hall/${memorial.invite_code}`, 'need-visit');
    return;
  }
  const type = req.body.type;
  const notice = { light: 'lit', flower: 'flowered', prayer: 'prayed' }[type];
  if (!notice) {
    hallPage(req, res, memorial, 400, ['無法完成這項追思。']);
    return;
  }
  db.addRitual(memorial.id, type);
  redirectNotice(res, `/hall/${memorial.invite_code}`, notice);
});

app.post('/hall/:code/messages', (req, res) => {
  const memorial = db.getMemorialByCode(req.params.code);
  if (!memorial) {
    page(res, view.missing(req.settings), 404);
    return;
  }
  const role = hallRole(req.member, memorial);
  if (!req.member || (role !== 'owner' && role !== 'visitor' && role !== 'trustee')) {
    redirectNotice(res, `/hall/${memorial.invite_code}`, 'need-visit');
    return;
  }
  const author = textField(req.body.author, 40);
  const body = textField(req.body.body, 500);
  const errors = [];
  if (!author.value) errors.push('請填寫稱謂。');
  if (!body.value) errors.push(memorial.life_state === 'living' ? '請寫下想說的話。' : '請寫下想對先人說的話。');
  if (errors.length) {
    hallPage(req, res, memorial, 400, errors);
    return;
  }
  db.addMessage({ memorialId: memorial.id, author: author.value, body: body.value, memberId: req.member.id });
  redirectNotice(res, `/hall/${memorial.invite_code}`, 'noted');
});

app.post('/hall/:code/messages/:messageId/reply', requireMember, (req, res) => {
  const memorial = db.getMemorialByCode(req.params.code);
  if (!memorial) {
    page(res, view.missing(req.settings), 404);
    return;
  }
  if (hallRole(req.member, memorial) !== 'owner') {
    redirectNotice(res, `/hall/${memorial.invite_code}`, 'need-login');
    return;
  }
  const body = textField(req.body.body, 500);
  const parent = db.listPublicMessages(memorial.id).find((item) => item.id === req.params.messageId && !item.parent_id);
  if (!body.value || !parent) {
    redirectNotice(res, `/hall/${memorial.invite_code}`, 'bad-file');
    return;
  }
  db.addMessage({
    memorialId: memorial.id,
    author: req.member.name,
    body: body.value,
    parentId: parent.id,
    memberId: req.member.id
  });
  redirectNotice(res, `/hall/${memorial.invite_code}`, 'replied');
});

app.post('/hall/:code/convert', requireMember, (req, res) => {
  const memorial = db.getMemorialByCode(req.params.code);
  if (!memorial) {
    page(res, view.missing(req.settings), 404);
    return;
  }
  const next = db.convertToDeceased(memorial.id, req.member.id);
  if (next === 'hall-limit') {
    redirectNotice(res, `/hall/${memorial.invite_code}`, 'hall-limit');
    return;
  }
  if (!next) {
    redirectNotice(res, `/hall/${memorial.invite_code}`, 'need-login');
    return;
  }
  redirectNotice(res, `/hall/${next.invite_code}`, 'converted');
});

app.post('/hall/:code/orders', (req, res) => {
  const memorial = db.getMemorialByCode(req.params.code);
  if (!memorial) {
    page(res, view.missing(req.settings), 404);
    return;
  }
  const role = hallRole(req.member, memorial);
  if (memorial.life_state !== 'deceased' || (role !== 'owner' && role !== 'visitor')) {
    redirectNotice(res, `/hall/${memorial.invite_code}`, 'need-visit');
    return;
  }
  const kind = req.body.kind;
  if (kind === 'envelope') {
    redirectNotice(res, `/hall/${memorial.invite_code}`, 'need-visit');
    return;
  }
  const product = db.getProductBySku(textField(req.body.sku, 40).value);
  if (!product || product.kind !== 'offering' || product.shelf !== 'on') {
    redirectNotice(res, `/hall/${memorial.invite_code}`, 'off-shelf');
    return;
  }
  const orderId = db.addOrder({
    memorialId: memorial.id,
    productId: product.id,
    payerName: req.member.name,
    category: 'offering',
    itemLabel: product.name,
    amount: product.price
  });
  if (String(product.sku).startsWith('frame-')) {
    if (product.sku !== 'frame-set') db.setMemorialFrame(memorial.id, product.sku);
    redirectNotice(res, `/hall/${memorial.invite_code}`, 'framed');
    return;
  }
  db.addRoomItem({
    memorialId: memorial.id,
    orderId,
    sku: product.sku,
    label: product.name
  });
  redirectNotice(res, `/hall/${memorial.invite_code}`, 'offered');
});

app.post('/hall/:code/frame', (req, res) => {
  const memorial = db.getMemorialByCode(req.params.code);
  if (!memorial) {
    page(res, view.missing(req.settings), 404);
    return;
  }
  if (memorial.life_state !== 'deceased' || !req.member || req.member.id !== memorial.member_id) {
    redirectNotice(res, `/hall/${memorial.invite_code}`, 'need-login');
    return;
  }
  const sku = textField(req.body.sku, 40).value;
  const purchased = sku === 'plain' || db.listOwnedFrames(memorial.id).includes(sku);
  const grants = db.planFrameSkus(req.member.id);
  const plan = db.memberPlan(req.member.id);
  const fromPlan = grants.includes(sku) || (!purchased && sku !== 'frame-set' && plan.frames > grants.length);
  if (!purchased && !fromPlan) {
    redirectNotice(res, `/hall/${memorial.invite_code}`, 'off-shelf');
    return;
  }
  if (!purchased && !grants.includes(sku)) db.grantPlanFrame(req.member.id, sku);
  db.setMemorialFrame(memorial.id, sku);
  redirectNotice(res, `/hall/${memorial.invite_code}`, 'framed');
});

app.post('/hall/:code/layout', (req, res) => {
  const memorial = db.getMemorialByCode(req.params.code);
  if (!memorial) {
    res.status(404).json({ ok: false });
    return;
  }
  if (memorial.life_state !== 'deceased' || !req.member || req.member.id !== memorial.member_id) {
    res.status(403).json({ ok: false });
    return;
  }
  const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 200) : [];
  db.saveRoomLayout(memorial.id, items);
  res.json({ ok: true });
});

app.get('/media/:id/file', (req, res) => {
  const item = db.getMedia(req.params.id);
  if (!item || !item.file_path) {
    res.status(404).end();
    return;
  }
  const memorial = db.getMemorial(item.memorial_id);
  const role = memorial ? hallRole(req.member, memorial) : 'guest';
  const canManage = role === 'owner' || role === 'trustee' || Boolean(req.adminId);
  const canView = canManage || role === 'visitor';
  if (item.status !== 'public' && !canManage) {
    res.status(404).end();
    return;
  }
  if (item.status === 'public' && !canView) {
    res.status(404).end();
    return;
  }
  res.sendFile(path.join(db.uploadsDir, item.file_path));
});

app.get('/admin/login', (req, res) => {
  if (req.adminId) {
    res.redirect(303, '/admin');
    return;
  }
  page(res, view.adminLogin({
    settings: req.settings,
    notice: noticeText(req.query.notice),
    error: ''
  }));
});

app.post('/admin/login', (req, res) => {
  const username = textField(req.body.username, 40);
  const password = textField(req.body.password, 80);
  const admin = db.verifyAdmin(username.value, password.value);
  if (!admin) {
    page(res, view.adminLogin({
      settings: req.settings,
      notice: '',
      error: '帳號或密碼不正確。'
    }), 400);
    return;
  }
  if (req.sessionToken) db.deleteSession(req.sessionToken);
  setSession(res, db.createSession('admin', admin.id));
  res.redirect(303, '/admin');
});

app.post('/admin/logout', requireAdmin, (req, res) => {
  db.deleteSession(req.sessionToken);
  clearSession(res);
  res.redirect(303, '/admin/login');
});

function admin(req, res, section) {
  page(res, view.adminPage({
    settings: req.settings,
    section,
    snapshot: db.adminSnapshot(),
    planOptions: plans.PLANS,
    notice: noticeText(req.query.notice),
    errors: []
  }));
}

app.get('/admin', requireAdmin, (req, res) => admin(req, res, 'overview'));
app.get('/admin/members', requireAdmin, (req, res) => admin(req, res, 'members'));
app.get('/admin/products', requireAdmin, (req, res) => admin(req, res, 'products'));
app.get('/admin/memorials', requireAdmin, (req, res) => admin(req, res, 'memorials'));
app.get('/admin/rituals', requireAdmin, (req, res) => admin(req, res, 'rituals'));
app.get('/admin/messages', requireAdmin, (req, res) => admin(req, res, 'messages'));
app.get('/admin/media', requireAdmin, (req, res) => admin(req, res, 'media'));
app.get('/admin/orders', requireAdmin, (req, res) => admin(req, res, 'orders'));
app.get('/admin/inquiries', requireAdmin, (req, res) => admin(req, res, 'inquiries'));
app.get('/admin/settings', requireAdmin, (req, res) => admin(req, res, 'settings'));

app.post('/admin/members/:id/confirm', requireAdmin, (req, res) => {
  db.confirmMember(req.params.id);
  redirectNotice(res, '/admin/members', 'member-updated');
});

app.post('/admin/members/:id', requireAdmin, (req, res) => {
  const status = req.body.status === 'suspended' ? 'suspended' : 'active';
  db.setMemberStatus(req.params.id, status);
  redirectNotice(res, '/admin/members', 'member-updated');
});

app.post('/admin/messages/:id/hide', requireAdmin, (req, res) => {
  db.hideMessage(req.params.id);
  redirectNotice(res, '/admin/messages', 'saved');
});

app.post('/admin/products/:id', requireAdmin, (req, res) => {
  const product = db.getProduct(req.params.id);
  if (!product) {
    page(res, view.missing(req.settings), 404);
    return;
  }
  const name = textField(req.body.name, 40);
  const summary = textField(req.body.summary, 160);
  const price = Number(String(req.body.price || '').trim());
  const shelf = req.body.shelf === 'off' ? 'off' : 'on';
  const motion = req.body.motion === 'live' ? 'live' : 'still';
  if (!name.value || !summary.value || !Number.isInteger(price) || price < 0 || price > 1000000) {
    page(res, view.adminPage({
      settings: req.settings,
      section: 'products',
      snapshot: db.adminSnapshot(),
      notice: '',
      errors: ['請確認名稱、說明與價格。']
    }), 400);
    return;
  }
  db.updateProduct(product.id, { name: name.value, summary: summary.value, price, shelf, motion });
  redirectNotice(res, '/admin/products', 'saved');
});

app.post('/admin/settings', requireAdmin, (req, res) => {
  const sitePhone = textField(req.body.sitePhone, 40);
  const siteEmail = textField(req.body.siteEmail, 120);
  const siteAddress = textField(req.body.siteAddress, 120);
  const aboutLead = textField(req.body.aboutLead, 400);
  if (sitePhone.error || siteEmail.error || siteAddress.error || aboutLead.error || !aboutLead.value) {
    page(res, view.adminPage({
      settings: req.settings,
      section: 'settings',
      snapshot: db.adminSnapshot(),
      notice: '',
      errors: ['請確認設定內容。首頁介紹不可空白。']
    }), 400);
    return;
  }
  db.saveSettings({
    site_phone: sitePhone.value,
    site_email: siteEmail.value,
    site_address: siteAddress.value,
    about_lead: aboutLead.value
  });
  redirectNotice(res, '/admin/settings', 'saved');
});

app.post('/admin/media/:id', requireAdmin, (req, res) => {
  const status = req.body.status === 'hidden' ? 'hidden' : 'public';
  const ok = db.setMediaStatus(req.params.id, status);
  redirectNotice(res, '/admin/media', ok ? (status === 'public' ? 'published' : 'media-hidden') : 'no-file');
});

app.post('/admin/inquiries/:id', requireAdmin, (req, res) => {
  const status = ['new', 'contacted', 'closed'].includes(req.body.status) ? req.body.status : 'new';
  db.setInquiryStatus(req.params.id, status);
  redirectNotice(res, '/admin/inquiries', 'saved');
});

app.post('/admin/orders/:id/deliver', requireAdmin, (req, res) => {
  upload.single('file')(req, res, (error) => {
    if (error || !req.file) {
      redirectNotice(res, '/admin/orders', error ? 'bad-file' : 'no-file');
      return;
    }
    const caption = textField(req.body.caption, 80);
    const ok = db.deliverOrder(req.params.id, { filePath: req.file.filename, caption: caption.value });
    redirectNotice(res, '/admin/orders', ok ? 'delivered' : 'bad-file');
  });
});

app.post('/admin/members/:id/plan', requireAdmin, (req, res) => {
  const member = db.getMember(req.params.id);
  if (!member || member.status !== 'active') {
    redirectNotice(res, '/admin/members', 'member-updated');
    return;
  }
  const sku = textField(req.body.sku, 20).value;
  const cycle = req.body.cycle === 'year' ? 'year' : 'month';
  const plan = plans.planBySku(sku);
  if (plan.sku === 'free') db.endSubscription(member.id);
  else db.extendSubscription(member.id, plan.sku, cycle, plans.planPrice(plan, cycle), `staff-${Date.now()}`);
  redirectNotice(res, '/admin/members', 'plan-set');
});

function capsulePage(req, res, capsule, status, errors) {
  const opened = db.capsuleOpened(capsule);
  const owner = capsule.member_id === req.member.id;
  const shares = db.listCapsuleShares(capsule.id);
  const shared = db.hasCapsuleShare(capsule.id, req.member.id);
  if (!owner && !shared) {
    page(res, view.missing(req.settings), 404);
    return;
  }
  page(res, view.capsulePage({
    settings: req.settings,
    member: req.member,
    capsule: opened ? capsule : { ...capsule, title: '', body: '' },
    opened,
    shares: opened ? shares : [],
    media: opened ? db.listCapsuleMedia(capsule.id) : [],
    notice: noticeText(req.query.notice),
    errors: errors || []
  }), status);
}

function showCapsuleForm(req, res, status, errors, draft) {
  const allowance = db.hallAllowance(req.member.id);
  page(res, view.capsuleList({
    settings: req.settings,
    member: req.member,
    mine: db.listCapsulesByMember(req.member.id),
    shared: db.listCapsulesSharedWith(req.member.id),
    plan: allowance.plan,
    canCreate: db.listCapsulesByMember(req.member.id).length < (allowance.plan.capsules || 0),
    draft,
    notice: status ? '' : noticeText(req.query.notice),
    errors: errors || []
  }), status);
}

app.get('/capsules', requireMember, (req, res) => {
  showCapsuleForm(req, res);
});

app.post('/capsules', requireMember, (req, res) => {
  upload.array('files', 12)(req, res, (error) => {
    const files = req.files || [];
    const drop = () => files.forEach((file) => fs.unlink(path.join(db.uploadsDir, file.filename), () => {}));
    const plan = db.memberPlan(req.member.id);
    const title = textField(req.body.title, 40);
    const story = textField(req.body.body, 4000);
    const years = Number(req.body.years);
    const rawShares = Array.isArray(req.body.share) ? req.body.share : [req.body.share];
    const shareEmails = [...new Set(rawShares.map((item) => textField(item, 120).value).filter(Boolean))];
    const draft = { title: title.value, body: story.value, years, shares: shareEmails };
    const fail = (errors) => {
      drop();
      showCapsuleForm(req, res, 400, errors, draft);
    };
    if (db.listCapsulesByMember(req.member.id).length >= (plan.capsules || 0)) {
      drop();
      redirectNotice(res, '/capsules', 'capsule-limit');
      return;
    }
    if (error) {
      fail([NOTICES['bad-file']]);
      return;
    }
    const errors = [];
    if (!title.value) errors.push('請填寫標題。');
    if (!story.value) errors.push('請寫下想留下的話。');
    if (!plan.capsuleYears.includes(years)) errors.push(NOTICES['capsule-year']);
    if (!files.length) errors.push('請先放上照片或影片。');
    if (!shareEmails.length) errors.push('請填寫要分享的會員信箱。');
    if (shareEmails.length > plan.capsuleShares) errors.push(`目前的方案最多分享給 ${plan.capsuleShares} 位會員。`);
    const shareIds = [];
    shareEmails.forEach((email) => {
      const target = activeByEmail(email);
      if (!target) errors.push('無效帳號，請重新填入。');
      else if (target.id === req.member.id) errors.push('不能分享給自己。');
      else shareIds.push(target.id);
    });
    const durations = String(req.body.durations || '').split(',');
    const packed = [];
    let photoCount = 0;
    let videoSeconds = 0;
    let bytes = 0;
    files.forEach((file, index) => {
      const video = file.mimetype === 'video/mp4';
      const duration = Math.round(Number(durations[index]) || 0);
      if (!video && file.size > 8 * 1024 * 1024) errors.push('照片請小於 8 MB。');
      if (video && plan.videoSeconds <= 0) errors.push(NOTICES['no-video']);
      if (video && duration < 1) errors.push('影片長度讀取不到，請再選一次。');
      if (video) videoSeconds += duration;
      else photoCount += 1;
      bytes += file.size;
      packed.push({
        caption: video ? '影片' : '照片',
        filePath: file.filename,
        bytes: file.size,
        kind: video ? 'video' : 'photo',
        durationSeconds: video ? duration : 0
      });
    });
    const usage = db.memberUsage(req.member.id);
    if (plan.photos > 0 && usage.photos + photoCount > plan.photos) errors.push(NOTICES.quota);
    if (plan.videoSeconds > 0 && usage.video_seconds + videoSeconds > plan.videoSeconds) errors.push(NOTICES.quota);
    if (usage.bytes + bytes > plan.bytes) errors.push(NOTICES.quota);
    if (errors.length) {
      if (files.length) errors.push('照片或影片請再選一次。');
      fail([...new Set(errors)]);
      return;
    }
    let capsule;
    try {
      capsule = db.sealCapsule({
        memberId: req.member.id,
        title: title.value,
        body: story.value,
        years,
        shareIds,
        files: packed
      });
    } catch (sealError) {
      drop();
      throw sealError;
    }
    redirectNotice(res, `/capsules/${capsule.id}`, 'capsule-made');
  });
});

app.get('/capsules/:id', requireMember, (req, res) => {
  const capsule = db.getCapsule(req.params.id);
  if (!capsule) {
    page(res, view.missing(req.settings), 404);
    return;
  }
  capsulePage(req, res, capsule);
});

app.get('/capsule-media/:id/file', (req, res) => {
  const item = db.getCapsuleMedia(req.params.id);
  if (!item) {
    res.status(404).end();
    return;
  }
  const capsule = db.getCapsule(item.capsule_id);
  const owner = req.member && capsule && capsule.member_id === req.member.id;
  const shared = req.member && capsule && db.hasCapsuleShare(capsule.id, req.member.id);
  if (!capsule || !db.capsuleOpened(capsule) || (!owner && !shared && !req.adminId)) {
    res.status(404).end();
    return;
  }
  res.sendFile(path.join(db.uploadsDir, item.file_path));
});

app.post('/hall/:code/visit', requireMember, (req, res) => {
  const memorial = db.getMemorialByCode(req.params.code);
  if (!memorial) {
    page(res, view.missing(req.settings), 404);
    return;
  }
  if (req.member.id !== memorial.member_id) db.askVisit(memorial.id, req.member.id);
  redirectNotice(res, `/hall/${memorial.invite_code}`, 'visit-asked');
});

app.post('/memorials/:id/visits/:memberId', requireMember, (req, res) => {
  const memorial = ownMemorial(req, res);
  if (!memorial) return;
  const status = req.body.status === 'refused' ? 'refused' : 'allowed';
  db.setVisit(memorial.id, req.params.memberId, status);
  redirectNotice(res, `/memorials/${memorial.id}`, status === 'allowed' ? 'visit-allowed' : 'visit-refused');
});

app.use((req, res) => {
  page(res, view.missing(req.settings), 404);
});

app.listen(port, '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${port}`);
});
