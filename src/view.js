function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function ntd(amount) {
  return Number(amount || 0).toLocaleString('zh-TW');
}

function formatTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function alerts({ notice, errors }) {
  const parts = [];
  if (notice) parts.push(`<p class="alert" role="status">${esc(notice)}</p>`);
  if (errors && errors.length) {
    parts.push(`<div class="alert error" role="alert"><ul>${errors.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>`);
  }
  return parts.join('');
}

function field(name, labelText, value, opts = {}) {
  const id = opts.id || name;
  const required = opts.required ? ' required' : '';
  const type = opts.type || 'text';
  const max = opts.max ? ` maxlength="${opts.max}"` : '';
  const auto = opts.autocomplete ? ` autocomplete="${opts.autocomplete}"` : '';
  if (opts.multiline) {
    return `<label for="${id}">${esc(labelText)}</label><textarea id="${id}" name="${name}"${required}${max}>${esc(value || '')}</textarea>`;
  }
  if (opts.options) {
    const options = opts.options.map((item) => `<option value="${esc(item)}"${item === value ? ' selected' : ''}>${esc(item)}</option>`).join('');
    return `<label for="${id}">${esc(labelText)}</label><select id="${id}" name="${name}"${required}>${options}</select>`;
  }
  return `<label for="${id}">${esc(labelText)}</label><input id="${id}" name="${name}" type="${type}" value="${esc(value || '')}"${required}${max}${auto}${opts.inputmode ? ` inputmode="${opts.inputmode}"` : ''}>`;
}

function navLink(href, label, current, key) {
  const mark = current === key ? ' aria-current="page"' : '';
  return `<a href="${href}"${mark}>${esc(label)}</a>`;
}

function layout({ title, body, settings, member, mode, ownerHref, current }) {
  const name = settings.site_name || '時光仙境';
  const siteNav = `
    ${navLink('/', '首頁', current, 'home')}
    ${navLink('/about', '關於', current, 'about')}
    ${navLink('/plans', '方案', current, 'plans')}
    ${member ? navLink('/account', '會員專區', current, 'account') : `${navLink('/login', '登入', current, 'login')}${navLink('/register', '註冊', current, 'register')}`}`;
  const hallNav = `<a href="/">返回首頁</a>${ownerHref ? `<a href="${esc(ownerHref)}">整理此靈堂</a>` : ''}`;
  const noticeLabel = member && member.noticeCount
    ? `通知（${member.noticeCount}）`
    : '通知';
  const accountNav = `
    ${navLink('/', '首頁', current, 'home')}
    ${navLink('/account', '會員專區', current, 'account')}
    ${navLink('/account/notices', noticeLabel, current, 'notices')}
    ${navLink('/account/usage', '容量', current, 'usage')}
    ${navLink('/capsules', '時光膠囊', current, 'capsules')}
    ${navLink('/plans', '方案', current, 'plans')}`;
  const staffNav = `
    <a href="/admin">概況</a>
    <a href="/admin/members">會員</a>
    <a href="/admin/memorials">靈堂</a>
    <a href="/admin/rituals">追思</a>
    <a href="/admin/messages">追思留言</a>
    <a href="/admin/media">遺影</a>
    <a href="/admin/orders">禮金</a>
    <a href="/admin/products">禮儀項目</a>
    <a href="/admin/inquiries">諮詢</a>
    <a href="/admin/settings">設定</a>
    <a href="/">返回官網</a>
    <form method="post" action="/admin/logout"><button class="text-btn" type="submit">登出</button></form>`;
  const nav = mode === 'hall' ? hallNav : mode === 'account' ? accountNav : mode === 'staff' ? staffNav : siteNav;
  const contact = [
    settings.site_phone,
    settings.site_email,
    settings.site_address
  ].filter(Boolean).map((item) => `<span>${esc(item)}</span>`).join('');
  const footer = mode === 'hall'
    ? `<footer class="site-footer"><div class="wrap footer-quiet">${esc(name)}</div></footer>`
    : `<footer class="site-footer"><div class="wrap footer-row">
        <div><strong>${esc(name)}</strong>${contact ? `<p class="contact-line">${contact}</p>` : ''}</div>
        <nav class="footer-links"><a href="/about">關於</a><a href="/plans">方案</a><a href="/consult">聯絡</a></nav>
      </div></footer>`;
  const session = member && mode !== 'hall' && mode !== 'staff'
    ? `<form method="post" action="/logout"><button class="text-btn" type="submit">登出</button></form>`
    : '';
  const meadow = mode !== 'staff';
  const photo = meadow ? `
    <div class="page-bg" aria-hidden="true">
      <div class="page-photo">
        <img class="hero-photo hero-photo-desktop" src="/assets/hero-desktop.jpg?v=3" alt="">
        <img class="hero-photo hero-photo-mobile" src="/assets/hero-mobile.jpg" alt="">
      </div>
    </div>` : '';
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500&family=Noto+Serif+TC:wght@500;600&display=swap" rel="stylesheet">
  <link rel="icon" href="/assets/logo.png" type="image/png">
  <link rel="stylesheet" href="/assets/site.css?v=notices1">
</head>
<body class="${esc([mode || 'site', meadow ? 'meadow' : '', current === 'home' ? 'home' : ''].filter(Boolean).join(' '))}">
  <a class="skip" href="#main">跳到主要內容</a>
  <header class="site-header" data-header>
    <div class="header-inner">
      <a class="brand" href="/">
        <img class="brand-mark" src="/assets/logo.png" alt="" width="52" height="36">
        <span>${esc(name)}</span>
      </a>
      <button class="nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="site-nav">選單</button>
      <nav id="site-nav" class="site-nav" data-nav>${nav}${session}</nav>
    </div>
  </header>
  <main id="main">${photo}${body}</main>
  ${footer}
  <script src="/assets/site.js?v=tablet-info1"></script>
</body>
</html>`;
}

function isOpen(iso) {
  const date = new Date(iso);
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

function dotDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
  return parts.replaceAll('-', '.');
}

function home({ settings, member, notice }) {
  const body = `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">時光仙境</p>
        <h1><span>為一個人</span><span>留一處明亮的地方</span></h1>
        <p class="lede">生前把想說的話留下。身後，仍可以回來。</p>
        ${alerts({ notice })}
        <div class="actions">
          <a class="btn dark" href="${member ? '/account' : '/register'}">${member ? '進入會員專區' : '建立頁面'}</a>
        </div>
      </div>
    </section>
    <section class="panel intro" id="intro">
      <div class="wrap">
        <div class="hero-copy">
          <p class="eyebrow">關於時光仙境</p>
          <h2 class="fit">在世留下，身後仍在。</h2>
          <p class="prose fit-copy">
            <span>時光仙境為一個人預備一處陽光裡的福地。</span>
            <span>生前可以留言。身後，親友仍能點燈、獻花、回來看看。</span>
          </p>
        </div>
      </div>
    </section>
    <section class="panel alt">
      <div class="wrap">
        <p class="eyebrow">留下</p>
        <h2>頁面、留言，與時光膠囊。</h2>
        <div class="rite-grid">
          <article data-rise><span class="rite-no">壹</span><h3>個人頁面</h3><p>還沒有靈堂布置。親友可以留言，版主可以回覆。</p></article>
          <article data-rise><span class="rite-no">貳</span><h3>身後的靈堂</h3><p>代管的人接手之後，才會成為可以布置的靈堂。</p></article>
          <article data-rise><span class="rite-no">參</span><h3>時光膠囊</h3><p>寫下想說的話，指定年限，到了那一天才打開。</p></article>
        </div>
      </div>
    </section>
    <section class="close">
      <div class="wrap">
        <div class="hero-copy close-inner">
          <h2>從這一頁開始。</h2>
          <a class="btn dark" href="${member ? '/account' : '/register'}">${member ? '前往會員專區' : '註冊並建立頁面'}</a>
        </div>
      </div>
    </section>`;
  return layout({ title: settings.site_name, body, settings, member, current: 'home' });
}

function about({ settings, member, notice }) {
  const body = `
    <section class="page-hero">
      <div class="wrap">
        <p class="eyebrow">關於</p>
        <h1>一處陽光裡的福地</h1>
        <p class="lede dark">這裡是時光仙境，生前先把話留下，身後由代管的人接手，成為可以回來的地方。</p>
      </div>
    </section>
    <div class="wrap">
      ${alerts({ notice })}
      <div class="rite-grid">
        <article class="sheet" data-rise>
          <p class="eyebrow">個人</p>
          <h2>還在的時候</h2>
          <p>建立一頁自己的地方。沒有靈堂布置。親友可以留言，版主可以回覆。可以指定一位會員代管。</p>
          <p>若到了那一天，只有代管的人能把這一頁切成身後。切過去就不能再改回來。</p>
        </article>
        <article class="sheet" data-rise>
          <p class="eyebrow">身後</p>
          <h2>可以回來的靈堂</h2>
          <p>名諱、題辭、生平事略、點燈與獻花、留言，都留在同一處。留言板仍然在，版主可以回覆。</p>
        </article>
        <article class="sheet" data-rise>
          <p class="eyebrow">膠囊</p>
          <h2>時光膠囊</h2>
          <p>膠囊獨立於靈堂。寫下想說的話、放上照片。年限到了，被指定的會員才能打開。頁面上會寫明來自誰，以及可開啟的日期。</p>
        </article>
      </div>
      <div class="actions">
        <a class="btn dark" href="/register">註冊</a>
        <a class="btn line dark" href="/consult">聯絡禮儀人員</a>
      </div>
    </div>`;
  return layout({ title: `關於｜${settings.site_name}`, body, settings, member, current: 'about' });
}

function shopCategory(title, count, inner, open) {
  if (!count) return '';
  return `<details class="shop-cat"${open ? ' open' : ''}>
    <summary><span>${esc(title)}</span><span class="shop-cat-count">${esc(count)}</span></summary>
    <div class="shop-cat-body">${inner}</div>
  </details>`;
}

function offeringShopGroups(items) {
  const list = items || [];
  const flowers = list.filter((item) => isFlowerSku(item.sku));
  const seas = list.filter((item) => isFlowerSeaSku(item.sku));
  const lamps = list.filter((item) => item.sku === 'lamp');
  const gifts = list.filter((item) => !isFlowerSku(item.sku) && !isFlowerSeaSku(item.sku) && item.sku !== 'lamp');
  return [
    { title: '獻花', items: flowers },
    { title: '花海', items: seas },
    { title: '燈', items: lamps },
    { title: '禮物', items: gifts }
  ].filter((group) => group.items.length);
}

function services({ settings, products, member, notice }) {
  const card = (item) => `
    <article class="offer solid" id="${esc(item.sku)}">
      ${String(item.sku).startsWith('frame-') && item.sku !== 'frame-set' ? frameBox(item.sku) : offerArt(item.sku)}
      <p class="eyebrow">${String(item.sku).startsWith('frame-') ? '相框' : item.kind === 'offering' ? '靈堂奉上' : item.kind === 'capsule' ? '家屬開啟' : '託時光仙境製作'}</p>
      <h2>${esc(item.name)}</h2>
      <p>${esc(item.summary)}</p>
      <strong>NT$${esc(ntd(item.price))}</strong>
    </article>`;
  const offerings = products.filter((item) => item.kind === 'offering' && !String(item.sku).startsWith('frame-'));
  const frames = products.filter((item) => String(item.sku).startsWith('frame-') && item.sku !== 'frame-set');
  const bundle = products.find((item) => item.sku === 'frame-set');
  const family = products.filter((item) => item.kind !== 'offering');
  const offerCats = offeringShopGroups(offerings).map((group) => shopCategory(group.title, group.items.length, `<div class="offer-grid">${group.items.map(card).join('')}</div>`)).join('');
  const frameInner = `<p class="muted shop-note">素紙框隨靈堂附上。以下可加價奉上，十款也可以一併奉上。</p><div class="offer-grid">${frames.map(card).join('')}${bundle ? card(bundle) : ''}</div>`;
  const body = `
    <section class="page-hero">
      <div class="wrap">
        <p class="eyebrow">禮儀</p>
        <h1>為身後準備的禮儀</h1>
        <p class="lede dark">追思禮在身後的靈堂奉上。時光膠囊在會員專區另行建立，不附在靈堂裡。點開分類才會顯示商品。</p>
      </div>
    </section>
    <div class="wrap">
      ${alerts({ notice })}
      <div class="shop-stack" data-shop>
        ${offerings.length ? `<details class="shop-fold">
          <summary><span>親友可在靈堂奉上</span><span class="shop-fold-count">${esc(offerings.length)}</span></summary>
          <div class="shop-fold-body">${offerCats}</div>
        </details>` : ''}
        ${frames.length || bundle ? `<details class="shop-fold">
          <summary><span>遺影相框</span><span class="shop-fold-count">${esc(frames.length + (bundle ? 1 : 0))}</span></summary>
          <div class="shop-fold-body">${frameInner}</div>
        </details>` : ''}
        ${family.length ? `<details class="shop-fold">
          <summary><span>家屬可為靈堂安排</span><span class="shop-fold-count">${esc(family.length)}</span></summary>
          <div class="shop-fold-body"><div class="offer-grid">${family.map(card).join('')}</div></div>
        </details>` : ''}
      </div>
      ${products.length ? '' : '<p>目前沒有開放中的項目。</p>'}
      <div class="actions">
        <a class="btn dark" href="${member ? '/account' : '/register'}">${member ? '前往會員專區' : '註冊後建立頁面'}</a>
      </div>
    </div>`;
  return layout({ title: `禮儀｜${settings.site_name}`, body, settings, member, current: 'services' });
}

function authPage({ settings, mode, notice, errors, email, next }) {
  const login = mode === 'login';
  const nextField = next ? `<input type="hidden" name="next" value="${esc(next)}">` : '';
  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : '/register';
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login';
  const body = `
    <section class="auth">
      <div class="auth-card">
        <p class="eyebrow">${esc(settings.site_name)}</p>
        <h1>${login ? '登入' : '註冊'}</h1>
        <p class="muted">${login ? '會員請填註冊時的信箱。管理請填帳號。' : '填寫家屬資料。我們會把驗證碼寄到信箱和手機。'}</p>
        ${alerts({ notice, errors })}
        ${login ? `
          <form method="post" action="/login">
            ${nextField}
            ${field('email', '信箱或帳號', email, { required: true, max: 120, autocomplete: 'username' })}
            ${field('password', '密碼', '', { type: 'password', required: true, max: 72, autocomplete: 'current-password' })}
            <p><button class="btn dark" type="submit">登入</button></p>
          </form>
          <p class="muted"><a href="${esc(registerHref)}">還沒有帳號</a></p>
        ` : `
          <form method="post" action="/register">
            ${nextField}
            ${field('name', '您的姓名', '', { required: true, max: 40, autocomplete: 'name' })}
            ${field('email', '信箱', email, { type: 'email', required: true, max: 120, autocomplete: 'email' })}
            ${field('phone', '手機', '', { required: true, max: 40, autocomplete: 'tel' })}
            ${field('password', '密碼', '', { type: 'password', required: true, max: 72, autocomplete: 'new-password' })}
            ${field('confirm', '再輸入一次密碼', '', { type: 'password', required: true, max: 72, autocomplete: 'new-password' })}
            <p class="muted">密碼至少 8 碼。</p>
            <p><button class="btn dark" type="submit">建立帳號</button></p>
          </form>
          <p class="muted"><a href="${esc(loginHref)}">已經註冊</a></p>
        `}
      </div>
    </section>`;
  return layout({
    title: `${login ? '登入' : '註冊'}｜${settings.site_name}`,
    body,
    settings,
    current: login ? 'login' : 'register'
  });
}

function verifyPage({ settings, email, emailVerified, phoneVerified, notice, errors }) {
  const body = `
    <section class="auth">
      <div class="auth-card">
        <p class="eyebrow">${esc(settings.site_name)}</p>
        <h1>填寫驗證碼</h1>
        ${email ? `<p class="muted">請填入寄到 ${esc(email)} 的驗證碼，以及手機簡訊裡的驗證碼。</p>` : '<p class="muted">請從註冊或登入進入。</p>'}
        ${alerts({ notice, errors })}
        ${email ? `
          <form method="post" action="/verify">
            <input type="hidden" name="email" value="${esc(email)}">
            ${emailVerified ? '<p>信箱已確認。</p>' : field('emailCode', '信箱驗證碼', '', { required: true, max: 6, inputmode: 'numeric', autocomplete: 'one-time-code' })}
            ${phoneVerified ? '<p>手機已確認。</p>' : field('phoneCode', '手機驗證碼', '', { required: true, max: 6, inputmode: 'numeric' })}
            <p class="muted">30 分鐘內有效。</p>
            <p><button class="btn dark" type="submit">確認</button></p>
          </form>
          <form class="resend" method="post" action="/resend">
            <input type="hidden" name="email" value="${esc(email)}">
            <p><button class="btn line dark" type="submit">重寄驗證碼</button></p>
          </form>
        ` : ''}
        <p class="muted"><a href="/login">回到登入</a></p>
      </div>
    </section>`;
  return layout({
    title: `填寫驗證碼｜${settings.site_name}`,
    body,
    settings,
    current: 'login'
  });
}

function consult({ settings, notice, errors }) {
  const body = `
    <section class="page-hero">
      <div class="wrap">
        <p class="eyebrow">聯絡</p>
        <h1>聯絡禮儀人員</h1>
        <p class="lede dark">若要為家人建立頁面，或詢問生平影片與紀念相簿，請留下聯絡方式。</p>
      </div>
    </section>
    <div class="wrap narrow">
      ${alerts({ notice, errors })}
      <form class="sheet" method="post" action="/consult">
        ${field('leadName', '您的姓名', '', { required: true, max: 40 })}
        ${field('leadContact', '電話或信箱', '', { required: true, max: 80 })}
        ${field('need', '想交代的事', '', { multiline: true, max: 400 })}
        <p><button class="btn dark" type="submit">請與我聯絡</button></p>
      </form>
    </div>`;
  return layout({ title: `聯絡｜${settings.site_name}`, body, settings, current: 'consult' });
}

function bytesLabel(value) {
  const amount = Number(value || 0);
  if (amount >= 1024 * 1024 * 1024) {
    const gb = amount / (1024 * 1024 * 1024);
    return `${gb >= 10 ? Math.round(gb) : Math.round(gb * 10) / 10} GB`;
  }
  if (amount >= 1024 * 1024) {
    const mb = amount / (1024 * 1024);
    return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
  }
  if (amount >= 1024) return `${Math.round(amount / 1024)} KB`;
  return `${Math.max(0, Math.round(amount))} B`;
}

function usagePercent(used, total) {
  const limit = Number(total || 0);
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((Number(used || 0) / limit) * 1000) / 10);
}

function account({ settings, member, memorials, trustPages, capsules, sharedCapsules, plan, usage, canCreate, canCreateFamily, notice }) {
  const cards = memorials.length ? memorials.map((item) => `
    <article class="memory" data-rise>
      <p class="eyebrow">${item.hall_kind === 'family' ? '家族靈堂' : item.life_state === 'living' ? '個人' : '身後'}</p>
      <h2>${esc(item.deceased_name)}</h2>
      <p class="muted">${esc(item.years)}</p>
      <div class="actions">
        <a class="btn dark" href="/hall/${esc(item.invite_code)}">${item.life_state === 'living' ? '進入頁面' : '進入靈堂'}</a>
        <a class="btn line dark" href="/memorials/${esc(item.id)}">整理</a>
      </div>
    </article>`).join('') : '<article class="memory"><h2>尚未建立頁面</h2><p class="muted">個人頁面先留下想說的話。身後才會成為可以布置的靈堂。</p></article>';
  const trustCards = (trustPages || []).map((item) => `
    <article class="memory" data-rise>
      <p class="eyebrow">代管</p>
      <h2>${esc(item.deceased_name)}</h2>
      <p class="muted">由 ${esc(item.owner_name)} 指定代管${item.years ? `　${esc(item.years)}` : ''}</p>
      <div class="actions">
        <a class="btn dark" href="/hall/${esc(item.invite_code)}">進入頁面</a>
      </div>
    </article>`).join('');
  const capsuleCards = (capsules || []).map((item) => `
    <article class="memory">
      <p class="eyebrow">我的時光膠囊</p>
      <h2>${isOpen(item.opens_at) ? esc(item.title) : '尚未開啟'}</h2>
      <p class="muted">可開啟日期為 ${esc(dotDate(item.opens_at))}</p>
      <a class="btn line dark" href="/capsules/${esc(item.id)}">${isOpen(item.opens_at) ? '打開' : '查看日期'}</a>
    </article>`).join('');
  const sharedCards = (sharedCapsules || []).map((item) => `
    <article class="memory">
      <p class="eyebrow">來自 ${esc(item.owner_name)} 的時光膠囊</p>
      <h2>${isOpen(item.opens_at) ? esc(item.title) : '尚未開啟'}</h2>
      <p class="muted">可開啟日期為 ${esc(dotDate(item.opens_at))}</p>
      <a class="btn line dark" href="/capsules/${esc(item.id)}">${isOpen(item.opens_at) ? '打開' : '查看日期'}</a>
    </article>`).join('');
  const room = plan || { name: '免費', bytes: 24 * 1024 * 1024, endsAt: '' };
  const used = usage || { bytes: 0, photos: 0, video_seconds: 0 };
  const body = `
    <section class="page-hero">
      <div class="wrap">
        <p class="eyebrow">會員專區</p>
        <h1>${esc(member.name)}</h1>
        <p class="lede dark">${esc(member.email)}</p>
        ${alerts({ notice })}
        <p>目前方案 ${esc(room.name)}${room.endsAt ? `，至 ${esc(dotDate(room.endsAt))}` : ''}。空間 ${esc(bytesLabel(used.bytes))}／${esc(bytesLabel(room.bytes))}，照片 ${esc(used.photos)} 張，影片 ${esc(Math.round((used.video_seconds || 0) / 60))} 分鐘。</p>
        <div class="actions">
          ${canCreate ? '<a class="btn dark" href="/memorials/new">建立個人頁面</a>' : ''}
          ${canCreateFamily ? '<a class="btn line dark" href="/memorials/new?kind=family">建立家族靈堂</a>' : ''}
          <a class="btn line dark" href="/account/notices">通知${member.noticeCount ? `（${esc(member.noticeCount)}）` : ''}</a>
          <a class="btn line dark" href="/account/usage">容量</a>
          <a class="btn line dark" href="/capsules">時光膠囊</a>
          <a class="btn line dark" href="/plans">方案</a>
        </div>
      </div>
    </section>
    <div class="wrap">
      <div class="memory-grid">${cards}</div>
      ${trustCards ? `<h2 class="group-title">代管頁面</h2><div class="memory-grid">${trustCards}</div>` : ''}
      ${capsuleCards || sharedCards ? `<h2 class="group-title">時光膠囊</h2><div class="memory-grid">${capsuleCards}${sharedCards}</div>` : ''}
    </div>`;
  return layout({ title: `會員專區｜${settings.site_name}`, body, settings, member, mode: 'account', current: 'account' });
}

function usagePage({ settings, member, plan, usage, notice }) {
  const room = plan || { name: '免費', bytes: 24 * 1024 * 1024, photos: 0, videoSeconds: 0, endsAt: '' };
  const used = usage || { bytes: 0, photos: 0, video_seconds: 0, hall_bytes: 0, capsule_bytes: 0, halls: [], capsules: [] };
  const pct = usagePercent(used.bytes, room.bytes);
  const photoLimit = room.photos > 0 ? `${used.photos}／${room.photos} 張` : `${used.photos} 張（此方案不另限張數）`;
  const videoUsed = Math.round((used.video_seconds || 0) / 60);
  const videoLimit = room.videoSeconds > 0
    ? `${videoUsed}／${Math.round(room.videoSeconds / 60)} 分鐘`
    : `${videoUsed} 分鐘（此方案不能自行上傳影片）`;
  const hallRows = (used.halls || []).map((item) => {
    const kind = item.hall_kind === 'family' ? '家族靈堂' : item.life_state === 'living' ? '個人頁面' : '靈堂';
    return `<tr>
      <td>${esc(item.deceased_name)}</td>
      <td>${esc(kind)}</td>
      <td>${esc(bytesLabel(item.bytes))}</td>
      <td>${esc(item.photos)} 張</td>
      <td>${esc(Math.round((item.video_seconds || 0) / 60))} 分</td>
    </tr>`;
  }).join('') || '<tr><td colspan="5">尚未建立頁面。</td></tr>';
  const capsuleRows = (used.capsules || []).map((item) => `<tr>
      <td>${isOpen(item.opens_at) ? esc(item.title) : '尚未開啟'}</td>
      <td>${esc(dotDate(item.opens_at))}</td>
      <td>${esc(bytesLabel(item.bytes))}</td>
      <td>${esc(item.photos)} 張</td>
      <td>${esc(Math.round((item.video_seconds || 0) / 60))} 分</td>
    </tr>`).join('') || '<tr><td colspan="5">尚未建立時光膠囊。</td></tr>';
  const body = `
    <section class="page-hero">
      <div class="wrap">
        <p class="eyebrow">會員專區</p>
        <h1>容量</h1>
        <p class="lede dark">照片、影片與時光膠囊共用同一份空間。目前方案 ${esc(room.name)}${room.endsAt ? `，至 ${esc(dotDate(room.endsAt))}` : ''}。</p>
        ${alerts({ notice })}
      </div>
    </section>
    <div class="wrap narrow">
      <section class="sheet usage-sheet">
        <p class="eyebrow">已使用空間</p>
        <h2>${esc(bytesLabel(used.bytes))}／${esc(bytesLabel(room.bytes))}</h2>
        <div class="usage-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <p class="muted">已使用 ${esc(pct)}%</p>
        <div class="stat-row usage-stats">
          <article><strong>${esc(bytesLabel(used.hall_bytes || 0))}</strong><span>頁面／靈堂</span></article>
          <article><strong>${esc(bytesLabel(used.capsule_bytes || 0))}</strong><span>時光膠囊</span></article>
          <article><strong>${esc(photoLimit)}</strong><span>照片</span></article>
          <article><strong>${esc(videoLimit)}</strong><span>影片</span></article>
        </div>
        <p class="actions"><a class="btn line dark" href="/plans">查看方案</a></p>
      </section>
      <section class="sheet">
        <h2>各頁面用量</h2>
        <div class="table-wrap">
          <table class="usage-table">
            <thead><tr><th>名稱</th><th>類型</th><th>空間</th><th>照片</th><th>影片</th></tr></thead>
            <tbody>${hallRows}</tbody>
          </table>
        </div>
      </section>
      <section class="sheet">
        <h2>時光膠囊用量</h2>
        <div class="table-wrap">
          <table class="usage-table">
            <thead><tr><th>膠囊</th><th>可開啟日</th><th>空間</th><th>照片</th><th>影片</th></tr></thead>
            <tbody>${capsuleRows}</tbody>
          </table>
        </div>
      </section>
    </div>`;
  return layout({ title: `容量｜${settings.site_name}`, body, settings, member, mode: 'account', current: 'usage' });
}

function noticesPage({ settings, member, notices, notice }) {
  const statusLabel = { pending: '等候回覆', accepted: '已同意', refused: '已婉拒' };
  const cards = (notices || []).length ? notices.map((item) => {
    const when = esc(dotDate(item.created_at));
    let title = '';
    let detail = '';
    let link = '';
    if (item.kind === 'trustee_invite') {
      title = `${esc(item.from_name)} 請你協助代管`;
      detail = `個人頁面「${esc(item.memorial_name || '')}」。同意後，若對方離世，可由你接手並切成身後。`;
      link = item.status === 'accepted' && item.memorial_code
        ? `<p><a class="btn line dark" href="/hall/${esc(item.memorial_code)}">進入頁面</a></p>`
        : '';
    } else {
      title = `${esc(item.from_name)} 邀請你一同查看時光膠囊`;
      detail = `可開啟日期為 ${esc(dotDate(item.capsule_opens_at))}。同意後，到期才能打開內容。`;
      link = item.status === 'accepted' && item.capsule_id
        ? `<p><a class="btn line dark" href="/capsules/${esc(item.capsule_id)}">查看膠囊</a></p>`
        : '';
    }
    const actions = item.status === 'pending' ? `
      <form class="notice-actions" method="post" action="/account/notices/${esc(item.id)}">
        <button class="btn dark" name="status" value="accepted" type="submit">同意</button>
        <button class="btn line dark" name="status" value="refused" type="submit">婉拒</button>
      </form>` : `<p class="muted">${esc(statusLabel[item.status] || item.status)}</p>`;
    return `
      <article class="sheet notice-card${item.status === 'pending' ? ' is-pending' : ''}">
        <p class="eyebrow">${when}</p>
        <h2>${title}</h2>
        <p>${detail}</p>
        ${actions}
        ${link}
      </article>`;
  }).join('') : '<article class="sheet"><h2>目前沒有通知</h2><p class="muted">有人邀請你查看時光膠囊，或請你協助代管時，會出現在這裡。</p></article>';
  const body = `
    <section class="page-hero">
      <div class="wrap">
        <p class="eyebrow">會員專區</p>
        <h1>通知</h1>
        <p class="lede dark">時光膠囊分享與代管邀請，都在這裡回覆。</p>
        ${alerts({ notice })}
      </div>
    </section>
    <div class="wrap narrow notice-list">${cards}</div>`;
  return layout({ title: `通知｜${settings.site_name}`, body, settings, member, mode: 'account', current: 'notices' });
}

function editor({ settings, member, memorial, family, people, media, orders, products, invite, visits, allowance, trustee, trusteePending, trusteeBlocked, notice, errors }) {
  const isNew = !memorial || !memorial.id;
  const living = !family && (!memorial || memorial.life_state !== 'deceased');
  const value = memorial || { deceased_name: '', birth_date: '', death_date: '', years: '', title: '', story: '', life_state: living ? 'living' : 'deceased' };
  const familyStatus = { pending_review: '確認中', public: '已在頁面', hidden: '未公開' };
  const commissions = (products || []).filter((item) => item.kind === 'commission');
  const mediaList = (media || []).map((item) => `<li>${esc(item.caption)}　${esc(familyStatus[item.status] || '')}</li>`).join('') || '<li>尚未上傳照片。</li>';
  const orderList = (orders || []).filter((item) => item.category === 'commission').map((item) => `<li>${esc(item.item_label)}　${item.service_status === 'delivered' ? '已放入' : '製作中'}　NT$${esc(ntd(item.amount))}</li>`).join('') || '<li>尚未託付。</li>';
  const peopleList = (people || []).map((item) => `<li>${esc(item.name)}　${esc(item.birth_date)} — ${esc(item.death_date)}</li>`).join('') || '<li>尚未加入家人。</li>';
  const extra = isNew ? '' : `
    <section class="sheet" id="invite">
      <h2>邀請親友</h2>
      <p class="muted">把網址交給親友。對方必須登入（或註冊），再提出進入，經您在下方同意後，才能進來；只憑連結無法直接進入。</p>
      <input id="invite-link" readonly value="${esc(invite)}">
      <p><button class="btn line dark" type="button" data-copy="#invite-link" data-status="#copy-status">複製網址</button></p>
      <p id="copy-status" class="muted"></p>
    </section>
    ${living ? `
      <section class="sheet" id="trustee">
        <h2>免費代管</h2>
        <p class="muted">填寫一位會員的信箱。若這位家人離世，只有這個人能把頁面切成身後並接手。免費方案的帳號只能代管一頁，名額已滿時會顯示為灰色。</p>
        ${trustee ? `<p>目前由 ${esc(trustee.name)}（${esc(trustee.email)}）代管。</p>
          <form method="post" action="/memorials/${esc(memorial.id)}/trustee"><input type="hidden" name="clear" value="1"><button class="btn line dark" type="submit">取消代管</button></form>` : ''}
        ${!trustee && trusteePending ? `<p>已邀請 ${esc(trusteePending.name)}（${esc(trusteePending.email)}），等候對方在通知頁同意。</p>
          <form method="post" action="/memorials/${esc(memorial.id)}/trustee"><input type="hidden" name="clear" value="1"><button class="btn line dark" type="submit">取消邀請</button></form>` : ''}
        ${!trustee && !trusteePending ? '<p>尚未指定代管。對方同意後才會生效。</p>' : ''}
        ${trusteeBlocked ? `<p class="is-disabled">${esc(trusteeBlocked.name)}　${esc(trusteeBlocked.email)}　無法代管</p>` : ''}
        <form method="post" action="/memorials/${esc(memorial.id)}/trustee">
          ${field('email', '會員信箱', '', { type: 'email', required: true, max: 120 })}
          <p><button class="btn dark" type="submit">${trustee || trusteePending ? '改請另一位' : '邀請代管'}</button></p>
        </form>
      </section>` : ''}
    ${family ? `
      <section class="sheet">
        <h2>家族裡的家人</h2>
        <p class="muted">這一間最多六位。</p>
        <ul class="plain">${peopleList}</ul>
        <form method="post" action="/memorials/${esc(memorial.id)}/people">
          ${field('deceasedName', '名諱', '', { required: true, max: 40 })}
          ${field('birthDate', '出生日期', '', { type: 'date', required: true })}
          ${field('deathDate', '往生日期', '', { type: 'date', required: true })}
          ${field('title', '題辭', '', { max: 80 })}
          ${field('story', '生平事略', '', { required: true, multiline: true, max: 4000 })}
          <p><button class="btn dark" type="submit">加入這一位</button></p>
        </form>
      </section>` : ''}
    <section class="sheet" id="visits">
      <h2>進入頁面</h2>
      ${(visits || []).length ? (visits || []).map((item) => `
        <article class="visit">
          <p><strong>${esc(item.name)}</strong>　${item.status === 'allowed' ? '已同意' : item.status === 'refused' ? '已婉拒' : '等候中'}</p>
          ${item.status === 'pending' ? `
            <form method="post" action="/memorials/${esc(memorial.id)}/visits/${esc(item.member_id)}">
              <button class="btn dark" name="status" value="allowed" type="submit">同意</button>
              <button class="btn line dark" name="status" value="refused" type="submit">婉拒</button>
            </form>` : ''}
        </article>`).join('') : '<p class="muted">還沒有人提出進入。</p>'}
    </section>
    <section class="sheet" id="upload">
      <h2>${living ? '照片' : '遺影'}</h2>
      <form method="post" action="/memorials/${esc(memorial.id)}/media" enctype="multipart/form-data" data-upload>
        ${field('caption', '說明', '', { max: 80 })}
        <input type="hidden" name="role" value="album" data-role>
        <input type="hidden" name="duration" value="0" data-duration>
        <label for="file">選擇檔案</label>
        <input id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp,video/mp4" data-crop-file>
        <p class="muted">照片會先預覽，裁成直幅後才上傳。張數與容量和時光膠囊共用。${allowance ? `目前 ${esc(bytesLabel(allowance.usage.bytes))}／${esc(bytesLabel(allowance.plan.bytes))}。` : ''}</p>
        <p><button class="btn dark" type="submit">上傳</button></p>
      </form>
      <ul class="plain">${mediaList}</ul>
    </section>
    ${!living && commissions.length ? `
      <section class="sheet">
        <h2>託時光仙境製作</h2>
        <p class="muted">交給時光仙境製作。完成後放入這一位的靈堂。</p>
        ${commissions.map((item) => `
          <form method="post" action="/memorials/${esc(memorial.id)}/commission">
            <input type="hidden" name="sku" value="${esc(item.sku)}">
            ${field('amount', `${item.name}這一案的金額`, item.price, { id: `amount-${item.sku}`, required: true, inputmode: 'numeric', max: 7 })}
            <button class="btn ${item.sku === 'video' ? 'dark' : 'line dark'}" type="submit">託付</button>
          </form>`).join('')}
        <ul class="plain">${orderList}</ul>
      </section>` : ''}`;
  const nameLabel = living ? '姓名' : '名諱';
  const storyLabel = living ? '想留下的話' : '生平事略';
  const body = `
    <div class="wrap editor">
      <p class="eyebrow">${isNew ? (family ? '新的家族靈堂' : '新的個人頁面') : '整理'}</p>
      <h1>${isNew ? (family ? '建立家族靈堂' : '建立個人頁面') : esc(value.deceased_name)}</h1>
      ${alerts({ notice, errors })}
      <div class="editor-grid">
        <form class="sheet" method="post" action="${isNew ? '/memorials' : `/memorials/${esc(memorial.id)}`}" data-memorial-form>
          ${family && isNew ? '<input type="hidden" name="kind" value="family">' : ''}
          <h2>${living ? '這一頁' : '先人'}</h2>
          ${field('deceasedName', nameLabel, value.deceased_name, { required: true, max: 40 })}
          ${field('birthDate', '出生日期', value.birth_date, { type: 'date', required: !living })}
          ${living ? '' : field('deathDate', '往生日期', value.death_date, { type: 'date', required: true })}
          ${field('title', '題辭', value.title, { max: 80 })}
          ${field('story', storyLabel, value.story, { required: true, multiline: true, max: 4000 })}
          <p><button class="btn dark" type="submit">${isNew ? '建立' : '儲存'}</button></p>
        </form>
        <aside class="sheet preview sun-preview">
          <p class="eyebrow">${living ? '個人' : family ? '家族' : '身後'}</p>
          <h2 data-preview-name>${esc(value.deceased_name || (living ? '尚未填寫姓名' : '尚未填寫名諱'))}</h2>
          <p data-preview-title>${esc(value.title || '')}</p>
        </aside>
      </div>
      ${extra ? `<div class="stack">${extra}</div>` : ''}
    </div>`;
  return layout({ title: `${isNew ? '建立頁面' : '整理頁面'}｜${settings.site_name}`, body, settings, member, mode: 'account', current: 'account' });
}

function figures(items) {
  if (!items.length) return '<p class="muted">遺影會出現在這裡。</p>';
  return `<div class="album">${items.map((item) => `
    <figure>
      ${item.kind === 'video'
        ? `<video src="/media/${esc(item.id)}/file" controls></video>`
        : `<img src="/media/${esc(item.id)}/file" alt="${esc(item.caption)}">`}
      <figcaption>${esc(item.caption)}</figcaption>
    </figure>`).join('')}</div>`;
}

function isFlowerSeaSku(sku) {
  return sku === 'flower-sea' || sku === 'sea';
}

function isFlowerSku(sku) {
  if (isFlowerSeaSku(sku)) return false;
  return sku === 'flower' || String(sku).startsWith('flower-');
}

function offerArt(sku) {
  if (isFlowerSku(sku) || isFlowerSeaSku(sku) || sku === 'lamp' || sku === 'gift') {
    return `<div class="offer-art">${pieceArt(sku)}</div>`;
  }
  return '';
}

function pieceArt(sku) {
  if (sku === 'lamp') {
    return `<span class="piece-art piece-art--lamp"><img src="/assets/room/lamp.png" alt=""><span class="flame-glow" aria-hidden="true"></span></span>`;
  }
  if (isFlowerSeaSku(sku)) {
    return `<img class="piece-art piece-art--sea" src="/assets/room/flower-sea-single.png?v=4" alt="">`;
  }
  if (isFlowerSku(sku)) {
    return `<img class="piece-art piece-art--column" src="/assets/room/flower-column.png?v=2" alt="">`;
  }
  return `<svg class="piece-art" viewBox="0 0 72 80" aria-hidden="true"><rect x="10" y="26" width="52" height="42" fill="#7c3e36"/><rect x="32" y="26" width="8" height="42" fill="#d7c39a"/><rect x="10" y="42" width="52" height="8" fill="#d7c39a"/><path d="M28 26c0-10 16-10 16 0" fill="none" stroke="#d7c39a" stroke-width="3"/><circle cx="36" cy="16" r="3" fill="#d7c39a"/></svg>`;
}

const FRAME_OPENING = {
  'frame-plain': [29.51, 22.48, 40.63, 53.47],
  'frame-wood': [28.94, 21.88, 42.12, 55.2],
  'frame-dark': [29.51, 22.4, 40.74, 53.64],
  'frame-ebony': [29.51, 22.22, 40.74, 53.73],
  'frame-gold': [27.08, 20.31, 45.72, 57.9],
  'frame-mat': [29.4, 22.4, 40.85, 53.82],
  'frame-round': [30.32, 22.05, 39.47, 56.25],
  'frame-lotus': [29.4, 22.31, 40.85, 53.91],
  'frame-bamboo': [28.01, 21.18, 43.75, 56.86],
  'frame-cloud': [29.51, 22.31, 40.86, 53.99],
  'frame-double': [25.69, 19.53, 48.27, 60.07]
};

function portraitStage(sku, inner) {
  const file = sku === 'plain' ? 'frame-plain' : sku;
  const box = FRAME_OPENING[file] || FRAME_OPENING['frame-plain'];
  return `<div class="portrait-stage"><div class="portrait-photo" style="left:${box[0]}%;top:${box[1]}%;width:${box[2]}%;height:${box[3]}%">${inner}</div><img class="frame-skin" src="/assets/room/${file}.png" alt=""></div>`;
}

function frameBox(sku) {
  return portraitStage(sku, '<span class="portrait-wait">遺影</span>');
}

function portraitFrame(sku, portrait) {
  const inner = portrait
    ? `<img src="/media/${esc(portrait.id)}/file" alt="">`
    : '<span class="portrait-wait">遺影</span>';
  return portraitStage(sku, inner);
}

function isLiveGift(item) {
  return item.motion === 'live' || item.sku === 'lamp';
}

function formatLifeDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
  const [year, month, day] = String(value).split('-').map(Number);
  return `${year}年${month}月${day}日`;
}

function altarYears(memorial) {
  const birth = formatLifeDate(memorial.birth_date);
  const death = formatLifeDate(memorial.death_date);
  if (birth && death) {
    return `<p class="years"><span>${esc(birth)}生</span><span>${esc(death)}往生</span></p>`;
  }
  if (death) return `<p class="years"><span>${esc(death)}往生</span></p>`;
  if (birth) return `<p class="years"><span>${esc(birth)}生</span></p>`;
  if (!memorial.years) return '';
  const parts = String(memorial.years).split(/[　\s]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `<p class="years"><span>${esc(parts[0])}</span><span>${esc(parts.slice(1).join(''))}</span></p>`;
  }
  return `<p class="years"><span>${esc(memorial.years)}</span></p>`;
}

function zonePiece(item, kind) {
  const live = isLiveGift(item);
  if (kind === 'stand') {
    return `<div class="plaque plaque--column piece--${live ? 'live' : 'still'}" aria-label="${esc(item.label)}">
      <img class="column-flower" src="/assets/room/flower-column.png?v=2" alt="${esc(item.label)}">
      <span class="piece-name">${esc(item.label)}</span>
    </div>`;
  }
  if (kind === 'kneel') {
    return `<div class="plaque plaque--kneel piece--${live ? 'live' : 'still'}" aria-label="${esc(item.label)}">
      <div class="plaque-board">
        <div class="plaque-art">${pieceArt(item.sku)}</div>
        <span class="plaque-stem" aria-hidden="true"></span>
        <span class="plaque-base" aria-hidden="true"></span>
      </div>
      <span class="piece-name">${esc(item.label)}</span>
    </div>`;
  }
  const bottle = item.sku === 'gift' ? 'box' : item.sku === 'lamp' ? 'lamp' : 'vase';
  return `<div class="piece piece--${live ? 'live' : 'still'} piece--${esc(kind)}" aria-label="${esc(item.label)}">
    <div class="piece-bottle piece-bottle--${bottle}">
      <div class="piece-visual">${pieceArt(item.sku)}</div>
      <span class="bottle-body" aria-hidden="true"></span>
    </div>
    <span class="piece-name">${esc(item.label)}</span>
  </div>`;
}

function hallZones(items) {
  const usable = (items || []).filter((item) => !String(item.sku).startsWith('frame-'));
  const flowers = usable.filter((item) => isFlowerSku(item.sku)).slice(0, 10);
  const seaItems = usable.filter((item) => isFlowerSeaSku(item.sku));
  const gifts = usable.filter((item) => !isFlowerSku(item.sku) && !isFlowerSeaSku(item.sku)).slice(0, 9);
  const stand = flowers;
  const standLeft = stand.filter((_, i) => i % 2 === 0);
  const standRight = stand.filter((_, i) => i % 2 === 1);
  const giftHtml = gifts.map((item) => zonePiece(item, 'gift')).join('');
  const standLeftHtml = standLeft.map((item) => zonePiece(item, 'stand')).join('');
  const standRightHtml = standRight.map((item) => zonePiece(item, 'stand')).join('');
  const seaCount = Math.min(2, seaItems.length);
  const seaLabel = (item) => `<span class="sea-name">${esc(item.label)}</span>`;
  let seaHtml = '<span class="zone-empty"></span>';
  if (seaCount === 1) {
    seaHtml = `<div class="sea-bed sea-bed--single">
      <img class="sea-art" src="/assets/room/flower-sea-single.png?v=4" alt="花海">
      <div class="sea-labels">${seaLabel(seaItems[0])}</div>
    </div>`;
  } else if (seaCount === 2) {
    seaHtml = `<div class="sea-bed sea-bed--pair">
      <div class="sea-wing sea-wing--left">
        <img class="sea-art sea-art--join" src="/assets/room/flower-sea-full.png?v=4" alt="花海左">
        <div class="sea-labels">${seaLabel(seaItems[0])}</div>
      </div>
      <div class="sea-wing sea-wing--right">
        <img class="sea-art sea-art--join" src="/assets/room/flower-sea-full.png?v=4" alt="花海右">
        <div class="sea-labels">${seaLabel(seaItems[1])}</div>
      </div>
    </div>`;
  }
  return {
    flowerCount: flowers.length,
    giftCount: gifts.length,
    kneelCount: 0,
    seaCount,
    html: `
      <div class="zone-rack zone-gifts" aria-label="禮物區">${giftHtml || '<span class="zone-empty"></span>'}</div>
      <div class="zone-stand zone-stand--left" aria-label="花柱左">${standLeftHtml || '<span class="zone-empty"></span>'}</div>
      <div class="zone-stand zone-stand--right" aria-label="花柱右">${standRightHtml || '<span class="zone-empty"></span>'}</div>
      <div class="zone-sea zone-sea--${seaCount || 0}" aria-label="花海區">${seaHtml}</div>`
  };
}

function altarCandle(side) {
  return `<span class="altar-candle altar-candle--${side}" aria-hidden="true">
    <span class="candle-sway">
      <span class="candle-flame"><span class="candle-flame-core"></span></span>
      <span class="candle-wick"></span>
      <span class="candle-stick"></span>
    </span>
    <span class="candle-base"></span>
  </span>`;
}

function rocParts(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  return { roc: year - 1911, month, day, year };
}

function ageYears(birth, death) {
  const a = rocParts(birth);
  const b = rocParts(death);
  if (!a || !b) return null;
  let age = b.year - a.year;
  if (b.month < a.month || (b.month === a.month && b.day < a.day)) age -= 1;
  return age > 0 ? age : null;
}

function tabletNotice(memorial) {
  const name = memorial.deceased_name || '○○';
  const birth = rocParts(memorial.birth_date);
  const death = rocParts(memorial.death_date);
  const age = ageYears(memorial.birth_date, memorial.death_date);
  const ageWord = age == null ? '○○' : String(age);
  const ageLabel = age != null && age >= 60 ? '壽' : '享年';
  const deathLine = death
    ? `慟於中華民國${death.roc}年${death.month}月${death.day}日○午○時逝世`
    : '慟於中華民國○○年○月○日○午○時逝世';
  const birthLine = birth
    ? `距生於民國${birth.roc}年${birth.month}月${birth.day}日${ageLabel}${ageWord}歲`
    : `距生於民國○○年○月○日${ageLabel}${ageWord}歲`;
  const riteLine = death
    ? `○等遵禮成服謹擇於${death.roc}年${death.month}月${death.day}日（星期○）○午○時`
    : '○等遵禮成服謹擇於○○年○月○日（星期○）○午○時';
  return `
    <p class="tablet-line">考　${esc(name)}　公　／　顯妣　${esc(name)}　夫人</p>
    <p class="tablet-line">${esc(deathLine)}</p>
    <p class="tablet-line">${esc(birthLine)}</p>
    <p class="tablet-line">${esc(riteLine)}</p>
    ${memorial.title ? `<p class="tablet-line tablet-line--soft">${esc(memorial.title)}</p>` : ''}`;
}

function spiritTablet(memorial) {
  const dialogId = `tablet-${esc(memorial.id || memorial.invite_code || 'main')}`;
  return `
    <button type="button" class="spirit-tablet" data-note-open="${dialogId}" aria-label="查看牌位資訊">
      <img class="spirit-tablet-art" src="/assets/room/spirit-tablet.png?v=2" alt="">
      <span class="spirit-tablet-name">${esc(memorial.deceased_name)}</span>
    </button>
    <dialog class="note-dialog tablet-dialog" id="${dialogId}" data-note-dialog>
      <form method="dialog" class="note-dialog-bar"><button class="btn line dark" value="close">關閉</button></form>
      <p class="eyebrow">牌位資訊</p>
      <h3>${esc(memorial.deceased_name)}</h3>
      <div class="tablet-notice">${tabletNotice(memorial)}</div>
    </dialog>`;
}

function altarOfferings() {
  return `<div class="altar-offerings" aria-hidden="true">
    <span class="offer-spray offer-spray--left"></span>
    <span class="offer-spray offer-spray--right"></span>
  </div>`;
}


function frameChoice(item, { current, owned, grants, slots, owner, code }) {
  if (item.sku === 'frame-set') {
    const hasAll = owned.filter((sku) => sku !== 'frame-set').length >= 10;
    const action = hasAll
      ? '<p class="muted">已可使用</p>'
      : `<form method="post" action="/hall/${esc(code)}/orders"><input type="hidden" name="kind" value="offering"><input type="hidden" name="sku" value="frame-set"><strong>NT$${esc(ntd(item.price))}</strong><button class="btn dark" type="submit">奉上</button></form>`;
    return `<article class="frame-card"><h3>${esc(item.name)}</h3><p>${esc(item.summary || '十款一併奉上。')}</p>${action}</article>`;
  }
  const active = current === item.sku;
  const bought = item.sku === 'plain' || owned.includes(item.sku);
  const granted = (grants || []).includes(item.sku);
  const has = bought || granted;
  let action = '<p class="muted">已奉上</p>';
  if (active) action = '<button class="btn line dark" type="button" disabled>使用中</button>';
  else if (has && owner) {
    action = `<form method="post" action="/hall/${esc(code)}/frame"><input type="hidden" name="sku" value="${esc(item.sku)}"><button class="btn line dark" type="submit">換上</button></form>`;
  } else if (!has && owner && slots > 0) {
    action = `<form method="post" action="/hall/${esc(code)}/frame"><input type="hidden" name="sku" value="${esc(item.sku)}"><button class="btn line dark" type="submit">以此方案換上</button></form>`;
  } else if (!has) {
    action = `<form method="post" action="/hall/${esc(code)}/orders"><input type="hidden" name="kind" value="offering"><input type="hidden" name="sku" value="${esc(item.sku)}"><strong>NT$${esc(ntd(item.price))}</strong><button class="btn dark" type="submit">奉上</button></form>`;
  } else if (item.sku === 'plain') action = '';
  return `<article class="frame-card">${frameBox(item.sku)}<h3>${esc(item.name)}</h3>${item.sku === 'plain' ? '<p>附於靈堂</p>' : ''}${action}</article>`;
}

function messageBoard(memorial, messages, owner) {
  const tops = (messages || []).filter((item) => !item.parent_id);
  const replies = (messages || []).filter((item) => item.parent_id);
  const notes = tops.length ? tops.map((item) => {
    const thread = replies.filter((reply) => reply.parent_id === item.id).map((reply) => `
      <article class="message reply"><strong>版主　${esc(reply.author)}</strong> <time>${esc(formatTime(reply.created_at))}</time><p>${esc(reply.body)}</p></article>`).join('');
    const form = owner ? `
      <form method="post" action="/hall/${esc(memorial.invite_code)}/messages/${esc(item.id)}/reply">
        ${field('body', '版主回覆', '', { id: `reply-${item.id}`, multiline: true, max: 500 })}
        <p><button class="btn line dark" type="submit">回覆</button></p>
      </form>` : '';
    return `<article class="message"><strong>${esc(item.author)}</strong> <time>${esc(formatTime(item.created_at))}</time><p>${esc(item.body)}</p>${thread}${form}</article>`;
  }).join('') : '<p class="muted">想說的話，可以留在這裡。</p>';
  return `
    <section class="sheet" id="messages">
      <h2>留言板</h2>
      <div class="messages">${notes}</div>
      <form method="post" action="/hall/${esc(memorial.invite_code)}/messages">
        ${field('author', '稱謂', '', { required: true, max: 40 })}
        ${field('body', '想說的話', '', { required: true, multiline: true, max: 500 })}
        <p><button class="btn dark" type="submit">留下</button></p>
      </form>
    </section>`;
}

function loungeRoom(memorial, messages, owner, media) {
  const tops = (messages || []).filter((item) => !item.parent_id);
  const replies = (messages || []).filter((item) => item.parent_id);
  const photos = (media || []).filter((item) => item.kind === 'photo' && item.file_path);
  const avatar = photos[0];
  const shelfPhotos = photos.slice(0, 4);
  const slips = tops.length ? tops.map((item, index) => {
    const preview = String(item.body || '').replace(/\s+/g, ' ').trim();
    const short = preview.length > 36 ? `${preview.slice(0, 36)}…` : preview;
    const tone = index % 5;
    const thread = replies.filter((reply) => reply.parent_id === item.id).map((reply) => `
      <article class="message reply"><strong>版主　${esc(reply.author)}</strong> <time>${esc(formatTime(reply.created_at))}</time><p>${esc(reply.body)}</p></article>`).join('');
    const form = owner ? `
      <form method="post" action="/hall/${esc(memorial.invite_code)}/messages/${esc(item.id)}/reply">
        ${field('body', '版主回覆', '', { id: `lounge-reply-${item.id}`, multiline: true, max: 500 })}
        <p><button class="btn line dark" type="submit">回覆</button></p>
      </form>` : '';
    return `
      <button type="button" class="note-slip note-slip--${tone}" data-note-open="note-${esc(item.id)}">
        <strong>${esc(item.author)}</strong>
        <span class="note-preview">${esc(short)}</span>
      </button>
      <dialog class="note-dialog" id="note-${esc(item.id)}" data-note-dialog>
        <form method="dialog" class="note-dialog-bar"><button class="btn line dark" value="close">關閉</button></form>
        <h3>${esc(item.author)}</h3>
        <time>${esc(formatTime(item.created_at))}</time>
        <p>${esc(item.body)}</p>
        ${thread}${form}
      </dialog>`;
  }).join('') : '<p class="lounge-empty">沙發邊的茶几還沒有便條。<a href="#messages">寫一張給這個人吧</a></p>';
  const avatarBlock = avatar
    ? `<div class="lounge-avatar"><img src="/media/${esc(avatar.id)}/file" alt="${esc(memorial.deceased_name)}"></div>`
    : '<div class="lounge-avatar lounge-avatar--empty" aria-hidden="true"></div>';
  const shelf = shelfPhotos.length
    ? `<div class="lounge-shelf" aria-label="相本架">${shelfPhotos.map((item) => `
        <figure class="lounge-shelf-item">
          <img src="/media/${esc(item.id)}/file" alt="${esc(item.caption || memorial.deceased_name)}">
        </figure>`).join('')}</div>`
    : `<div class="lounge-shelf lounge-shelf--empty" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>`;
  return `
    <section class="lounge-hero">
      <div class="wrap lounge-wrap">
        <div class="lounge-intro">
          <p class="eyebrow lounge-eyebrow">交誼廳</p>
          <h1 class="lounge-page-title">走進 ${esc(memorial.deceased_name)} 的會客空間</h1>
          <p class="lounge-lede">木牆、沙發、吧台都在這裡。留言貼在茶几上，照片立在書架，像真的來坐一坐。</p>
        </div>
        <div class="lounge lounge--club" data-lounge>
          <div class="lounge-scene" aria-hidden="true"></div>
          <div class="lounge-vignette" aria-hidden="true"></div>
          <div class="lounge-arch-glow" aria-hidden="true"></div>
          <div class="lounge-host">
            ${avatarBlock}
            <div class="lounge-host-copy">
              <p class="lounge-label">主人</p>
              <h2>${esc(memorial.deceased_name)}</h2>
              ${memorial.title ? `<p class="lounge-title">${esc(memorial.title)}</p>` : ''}
            </div>
          </div>
          <div class="lounge-shelf-panel">
            <p class="lounge-zone-label">書架</p>
            ${shelf}
          </div>
          <div class="lounge-seating">
            <div class="note-board" aria-label="茶几便條">
              <div class="note-board-head">
                <p class="note-board-label">茶几便條</p>
                <span class="note-board-count">${tops.length}</span>
              </div>
              <div class="note-board-grid">${slips}</div>
            </div>
          </div>
          <div class="lounge-bar" aria-hidden="true">
            <p class="lounge-zone-label">吧台</p>
            <div class="lounge-bar-glow"></div>
            <div class="lounge-stools"><span></span><span></span><span></span></div>
          </div>
        </div>
      </div>
    </section>`;
}

function hall({ settings, memorial, owner, trustee, counts, messages, people, total, media, offerings, frames, ownedFrames, grantedFrames, frameSlots, items, notice, errors }) {
  if (memorial.life_state !== 'deceased') {
    const body = `
      ${loungeRoom(memorial, messages, owner, media)}
      <div class="wrap hall-body lounge-body">
        ${alerts({ notice, errors })}
        ${trustee ? `<section class="sheet lounge-card"><h2>代管</h2><p>你可以接手這一頁。切成身後之後，不能再改回生前。</p><form method="post" action="/hall/${esc(memorial.invite_code)}/convert"><button class="btn dark" type="submit">切換為身後</button></form></section>` : ''}
        <div class="lounge-lower">
          <section class="sheet lounge-card story">
            <p class="eyebrow">關於主人</p>
            <h2>想留下的話</h2>
            <p>${esc(memorial.story)}</p>
          </section>
          <section class="sheet lounge-card" id="messages">
            <p class="eyebrow">寫下便條</p>
            <h2>留給茶几</h2>
            <p class="muted">寫好會出現在交誼廳茶几上，大家都能點開來看。</p>
            <form method="post" action="/hall/${esc(memorial.invite_code)}/messages">
              ${field('author', '稱謂', '', { required: true, max: 40 })}
              ${field('body', '想說的話', '', { required: true, multiline: true, max: 500 })}
              <p><button class="btn dark" type="submit">貼上便條</button></p>
            </form>
          </section>
        </div>
        <section class="sheet lounge-card">
          <p class="eyebrow">相本架</p>
          <h2>照片</h2>
          ${figures(media)}
        </section>
      </div>`;
    return layout({
      title: `${memorial.deceased_name}｜${settings.site_name}`,
      body,
      settings,
      mode: 'hall',
      ownerHref: owner ? `/memorials/${memorial.id}` : ''
    });
  }
  const peopleBlock = (people || []).length ? `
    <section class="sheet">
      <h2>家族</h2>
      ${(people || []).map((item) => `<article class="story-block"><h3>${esc(item.name)}</h3><p class="muted">${esc(item.birth_date)} — ${esc(item.death_date)}</p>${item.title ? `<p>${esc(item.title)}</p>` : ''}<p>${esc(item.story)}</p></article>`).join('')}
    </section>` : '';
  const portrait = media.find((item) => item.kind === 'photo');
  const placed = items || [];
  const zones = hallZones(placed);
  const frameSku = memorial.frame_sku || 'plain';
  const frameItems = [{ sku: 'plain', name: '素紙框', price: 0 }, ...(frames || [])];
  const frameGrid = frameItems.map((item) => frameChoice(item, {
    current: frameSku,
    owned: ownedFrames || [],
    grants: grantedFrames || [],
    slots: frameSlots || 0,
    owner,
    code: memorial.invite_code
  })).join('');
  const body = `
    <section class="hall-hero">
      <div class="wrap">
        <div class="hall-head">
          <p class="eyebrow">靈堂</p>
          <h1 class="hall-name">${esc(memorial.deceased_name)}</h1>
          ${altarYears(memorial)}
          ${memorial.title ? `<p class="hall-title">${esc(memorial.title)}</p>` : ''}
        </div>
        <div class="house house--memory house--gifts-${esc(zones.giftCount)} house--flowers-${esc(zones.flowerCount)} house--kneel-${esc(zones.kneelCount)}" data-room>
          <div class="house-wall" aria-hidden="true"></div>
          <div class="house-memory-banner" aria-hidden="true"><span class="memory-word">MEMORY</span></div>
          <div class="house-curtain-side house-curtain-side--left" aria-hidden="true"></div>
          <div class="house-curtain-side house-curtain-side--right" aria-hidden="true"></div>
          <div class="house-curtain-frame" aria-hidden="true"></div>
          <div class="house-floor" aria-hidden="true"></div>
          <div class="house-aisle" aria-hidden="true"><span class="aisle-runner"></span></div>
          <div class="altar">
            <div class="altar-stage">
              ${portraitFrame(frameSku, portrait)}
            </div>
            <div class="altar-table altar-table--satin">
              ${altarCandle('left')}
              ${spiritTablet(memorial)}
              ${altarCandle('right')}
              ${altarOfferings()}
              <div class="altar-cloth" aria-hidden="true">
                <div class="cloth-deck"></div>
                <div class="cloth-skirt"></div>
              </div>
            </div>
          </div>
          ${zones.html}
        </div>
      </div>
    </section>
    <div class="wrap hall-body">
      ${alerts({ notice, errors })}
      <section class="sheet shop-panel" id="frames">
        <details class="shop-fold">
          <summary><span>相框</span><span class="shop-fold-count">${esc(frameItems.length)}</span></summary>
          <div class="shop-fold-body">
            <p class="muted shop-note">素紙框隨靈堂附上。方案內的相框可直接換上。其餘可單獨奉上，或十款一併奉上。</p>
            <div class="frame-grid">${frameGrid}</div>
          </div>
        </details>
      </section>
      <section class="sheet story">
        <h2>生平事略</h2>
        <p>${esc(memorial.story)}</p>
      </section>
      <section class="sheet" id="rituals">
        <h2>點燈、獻花、祈福</h2>
        <div class="rite-actions">
          ${[
            ['light', '點燈', counts.light],
            ['flower', '獻花', counts.flower],
            ['prayer', '祈福', counts.prayer]
          ].map(([type, text, count]) => `
            <form method="post" action="/hall/${esc(memorial.invite_code)}/rituals">
              <input type="hidden" name="type" value="${type}">
              <p class="count">${esc(count)}</p>
              <button class="btn line dark" type="submit">${esc(text)}</button>
            </form>`).join('')}
        </div>
      </section>
      ${peopleBlock}
      ${messageBoard(memorial, messages, owner)}
      <section class="sheet shop-panel" id="offering" data-shop>
        <details class="shop-fold">
          <summary><span>奉上商城</span><span class="shop-fold-count">${esc((offerings || []).length)}</span></summary>
          <div class="shop-fold-body">
            ${offeringShopGroups(offerings).map((group) => shopCategory(group.title, group.items.length, `<div class="offer-grid compact">${group.items.map((item) => `
              <form method="post" action="/hall/${esc(memorial.invite_code)}/orders">
                <input type="hidden" name="kind" value="offering">
                <input type="hidden" name="sku" value="${esc(item.sku)}">
                ${offerArt(item.sku)}
                <h3>${esc(item.name)}</h3>
                <p>${esc(item.summary)}</p>
                <strong>NT$${esc(ntd(item.price))}</strong>
                <button class="btn dark" type="submit">奉上</button>
              </form>`).join('')}</div>`)).join('') || '<p class="muted">目前沒有可奉上的項目。</p>'}
          </div>
        </details>
      </section>
      <section class="sheet" id="album">
        <h2>遺影</h2>
        ${figures(media)}
      </section>
    </div>`;
  return layout({
    title: `${memorial.deceased_name}｜${settings.site_name}`,
    body,
    settings,
    mode: 'hall',
    ownerHref: owner ? `/memorials/${memorial.id}` : ''
  });
}

function adminLogin({ settings, notice, error }) {
  const body = `
    <section class="auth">
      <div class="auth-card">
        <p class="eyebrow">管理</p>
        <h1>管理登入</h1>
        ${alerts({ notice, errors: error ? [error] : [] })}
        <form method="post" action="/admin/login">
          ${field('username', '帳號', '', { required: true, autocomplete: 'username' })}
          ${field('password', '密碼', '', { type: 'password', required: true, autocomplete: 'current-password' })}
          <p><button class="btn dark" type="submit">進入</button></p>
        </form>
      </div>
    </section>`;
  return layout({ title: `管理登入｜${settings.site_name}`, body, settings, mode: 'staff' });
}

function staffTable(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((item) => `<th>${esc(item)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function adminPage({ settings, section, snapshot, planOptions, notice, errors }) {
  const shelfLabel = { on: '上架', off: '下架' };
  const memberLabel = { pending: '待確認', active: '使用中', suspended: '已停用' };
  const inquiryLabel = { new: '新來信', contacted: '已聯絡', closed: '已結束' };
  let content = '';
  if (section === 'members') {
    const rows = snapshot.members.map((item) => `<tr>
      <td>${esc(item.name)}</td><td>${esc(item.email)}</td><td>${esc(item.phone)}</td><td>${esc(memberLabel[item.status] || item.status)}</td>
      <td>${esc(item.plan_name || '常設')}</td>
      <td>${item.status === 'pending' ? `信箱 ${esc(item.email_code || '—')}　手機 ${esc(item.phone_code || '—')}` : '已確認'}</td>
      <td>${item.status === 'active' ? `<form method="post" action="/admin/members/${esc(item.id)}/plan"><select name="sku">${(planOptions || []).map((plan) => `<option value="${esc(plan.sku)}"${plan.name === item.plan_name ? ' selected' : ''}>${esc(plan.name)}</option>`).join('')}</select><select name="cycle"><option value="month">每月</option><option value="year">每年</option></select><button class="btn line dark" type="submit">更新方案</button></form>` : ''}${item.status === 'pending' ? `<form method="post" action="/admin/members/${esc(item.id)}/confirm"><button class="btn line dark" type="submit">確認帳號</button></form>` : `<form method="post" action="/admin/members/${esc(item.id)}"><input type="hidden" name="status" value="${item.status === 'suspended' ? 'active' : 'suspended'}"><button class="btn line dark" type="submit">${item.status === 'suspended' ? '恢復' : '停用'}</button></form>`}</td>
    </tr>`).join('') || '<tr><td colspan="7">還沒有會員。</td></tr>';
    content = `<h1>會員</h1>${staffTable(['姓名', '信箱', '手機', '狀態', '方案', '驗證碼', ''], rows)}`;
  } else if (section === 'products') {
    content = `<h1>禮儀項目</h1><div class="product-admin">${snapshot.products.map((item) => `
      <form class="sheet" method="post" action="/admin/products/${esc(item.id)}">
        ${field('name', '名稱', item.name, { id: `name-${item.id}`, required: true, max: 40 })}
        ${field('summary', '說明', item.summary, { id: `summary-${item.id}`, required: true, max: 160 })}
        ${field('price', '價格', item.price, { id: `price-${item.id}`, required: true, inputmode: 'numeric', max: 7 })}
        <label for="shelf-${esc(item.id)}">上下架</label>
        <select id="shelf-${esc(item.id)}" name="shelf">
          <option value="on"${item.shelf === 'on' ? ' selected' : ''}>上架</option>
          <option value="off"${item.shelf === 'off' ? ' selected' : ''}>下架</option>
        </select>
        <label for="motion-${esc(item.id)}">靈堂顯示</label>
        <select id="motion-${esc(item.id)}" name="motion">
          <option value="still"${item.motion !== 'live' ? ' selected' : ''}>靜態</option>
          <option value="live"${item.motion === 'live' ? ' selected' : ''}>動態</option>
        </select>
        <p class="muted">目前${esc(shelfLabel[item.shelf])}，${item.motion === 'live' ? '動態' : '靜態'}</p>
        <p><button class="btn dark" type="submit">儲存</button></p>
      </form>`).join('')}</div>`;
  } else if (section === 'settings') {
    content = `<h1>設定</h1>
      <form class="sheet" method="post" action="/admin/settings">
        ${field('sitePhone', '聯絡電話', settings.site_phone, { max: 40 })}
        ${field('siteEmail', '聯絡信箱', settings.site_email, { type: 'email', max: 120 })}
        ${field('siteAddress', '地址', settings.site_address, { max: 120 })}
        ${field('aboutLead', '首頁關於時光仙境', settings.about_lead, { multiline: true, max: 400 })}
        <p><button class="btn dark" type="submit">儲存</button></p>
      </form>`;
  } else if (section === 'memorials') {
    const rows = snapshot.memorials.map((item) => `<tr><td>${esc(item.deceased_name)}</td><td>${esc(item.member_name)}</td><td>${esc(item.light_count)}</td><td>${esc(item.flower_count)}</td><td>${esc(item.prayer_count)}</td><td>${esc(item.message_count)}</td><td>NT$${esc(ntd(item.revenue))}</td><td>${item.capsule_status === 'open' ? '已開啟' : '尚未開啟'}</td><td><a href="/hall/${esc(item.invite_code)}">開啟靈堂</a></td></tr>`).join('') || '<tr><td colspan="9">尚未建立靈堂。</td></tr>';
    content = `<h1>靈堂</h1>${staffTable(['先人', '家屬', '點燈', '獻花', '祈福', '留言', '已收下', '時光膠囊', ''], rows)}`;
  } else if (section === 'media') {
    const rows = snapshot.media.map((item) => {
      const src = `/media/${esc(item.id)}/file`;
      const preview = !item.file_path
        ? '<span class="muted">無檔案</span>'
        : item.kind === 'video'
          ? `<a class="media-review" href="${src}" target="_blank" rel="noopener"><video src="${src}" muted playsinline preload="metadata"></video><span>開影片</span></a>`
          : `<a class="media-review" href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="${esc(item.caption || '照片')}"></a>`;
      return `<tr>
      <td>${esc(item.deceased_name)}</td>
      <td>${preview}</td>
      <td>${esc(item.caption || '—')}</td>
      <td>${item.status === 'public' ? '公開' : item.status === 'hidden' ? '隱藏' : '確認中'}</td>
      <td><form method="post" action="/admin/media/${esc(item.id)}"><input type="hidden" name="status" value="${item.status === 'public' ? 'hidden' : 'public'}"><button class="btn line dark" type="submit">${item.status === 'public' ? '隱藏' : '公開'}</button></form></td>
    </tr>`;
    }).join('') || '<tr><td colspan="5">沒有影像。</td></tr>';
    content = `<h1>遺影</h1>${staffTable(['靈堂', '預覽', '說明', '狀態', ''], rows)}`;
  } else if (section === 'orders') {
    const rows = snapshot.orders.map((item) => `<tr>
      <td>${esc(formatTime(item.created_at))}</td><td>${esc(item.deceased_name)}</td><td>${esc(item.payer_name)}</td><td>${esc(item.item_label)}</td><td>NT$${esc(ntd(item.amount))}</td><td>${item.service_status === 'producing' ? '製作中' : item.service_status === 'delivered' ? '已奉入' : '已收下'}</td>
    </tr>`).join('') || '<tr><td colspan="6">尚未有禮金。</td></tr>';
    const producing = snapshot.orders.filter((item) => item.service_status === 'producing');
    const forms = producing.map((item) => {
      const product = snapshot.products.find((entry) => entry.id === item.product_id);
      const video = product && product.media_kind === 'video';
      return `
      <form class="sheet" method="post" action="/admin/orders/${esc(item.id)}/deliver" enctype="multipart/form-data">
        <h2>${esc(item.deceased_name)}　${esc(item.item_label)}</h2>
        ${field('caption', '奉入靈堂時的說明', item.item_label, { id: `caption-${item.id}`, max: 80 })}
        <label for="file-${esc(item.id)}">成品檔案</label>
        <input id="file-${esc(item.id)}" name="file" type="file" accept="${video ? 'video/mp4' : 'image/jpeg,image/png,image/webp'}" required>
        <p><button class="btn dark" type="submit">奉入靈堂</button></p>
      </form>`;
    }).join('') || '<p class="muted">沒有製作中的託付。</p>';
    content = `<h1>禮金</h1>${staffTable(['時間', '靈堂', '致奠者', '項目', '金額', '狀態'], rows)}<h2>交付成品</h2>${forms}`;
  } else if (section === 'inquiries') {
    const rows = snapshot.inquiries.map((item) => `<tr>
      <td>${esc(item.name)}</td><td>${esc(item.contact)}</td><td>${esc(item.need)}</td><td>${esc(inquiryLabel[item.status] || '')}</td>
      <td><form method="post" action="/admin/inquiries/${esc(item.id)}"><select name="status"><option value="new">新來信</option><option value="contacted"${item.status === 'contacted' ? ' selected' : ''}>已聯絡</option><option value="closed"${item.status === 'closed' ? ' selected' : ''}>已結束</option></select><button class="btn line dark" type="submit">更新</button></form></td>
    </tr>`).join('') || '<tr><td colspan="5">沒有諮詢。</td></tr>';
    content = `<h1>諮詢</h1>${staffTable(['姓名', '聯絡方式', '內容', '狀態', ''], rows)}`;
  } else if (section === 'rituals') {
    const riteLabel = { light: '點燈', flower: '獻花', prayer: '祈福' };
    const rows = snapshot.rituals.map((item) => `<tr><td>${esc(formatTime(item.created_at))}</td><td>${esc(item.deceased_name)}</td><td>${esc(riteLabel[item.type] || item.type)}</td></tr>`).join('') || '<tr><td colspan="3">還沒有追思。</td></tr>';
    content = `<h1>追思</h1>${staffTable(['時間', '靈堂', '項目'], rows)}`;
  } else if (section === 'messages') {
    const rows = snapshot.messages.map((item) => `<tr>
      <td>${esc(formatTime(item.created_at))}</td><td>${esc(item.deceased_name)}</td><td>${esc(item.author)}</td><td>${esc(item.body)}</td><td>${item.visibility === 'public' ? '公開' : '已隱藏'}</td>
      <td>${item.visibility === 'public' ? `<form method="post" action="/admin/messages/${esc(item.id)}/hide"><button class="btn line dark" type="submit">隱藏</button></form>` : ''}</td>
    </tr>`).join('') || '<tr><td colspan="6">還沒有留言。</td></tr>';
    content = `<h1>追思留言</h1>${staffTable(['時間', '靈堂', '稱謂', '內容', '狀態', ''], rows)}`;
  } else {
    const totals = snapshot.totals;
    const recentOrders = snapshot.orders.slice(0, 8).map((item) => `<tr><td>${esc(formatTime(item.created_at))}</td><td>${esc(item.deceased_name)}</td><td>${esc(item.payer_name)}</td><td>${esc(item.item_label)}</td><td>NT$${esc(ntd(item.amount))}</td></tr>`).join('') || '<tr><td colspan="5">尚未有禮金。</td></tr>';
    const recentHalls = snapshot.memorials.slice(0, 8).map((item) => `<tr><td>${esc(item.deceased_name)}</td><td>${esc(item.member_name)}</td><td>${esc(item.light_count)}</td><td>${esc(item.flower_count)}</td><td>${esc(item.message_count)}</td><td>NT$${esc(ntd(item.revenue))}</td></tr>`).join('') || '<tr><td colspan="6">尚未建立靈堂。</td></tr>';
    content = `
      <h1>概況</h1>
      <div class="queue">
        <a href="/admin/members">待確認會員 ${esc(totals.membersPending)}</a>
        <a href="/admin/media">待審影像 ${esc(totals.mediaPending)}</a>
        <a href="/admin/orders">製作中 ${esc(totals.producing)}</a>
        <a href="/admin/inquiries">新諮詢 ${esc(totals.inquiriesNew)}</a>
      </div>
      <h2>人數</h2>
      <div class="stat-row">
        <article><strong>${esc(totals.members)}</strong><span>會員</span></article>
        <article><strong>${esc(totals.membersActive)}</strong><span>使用中</span></article>
        <article><strong>${esc(totals.membersPending)}</strong><span>待確認</span></article>
        <article><strong>${esc(totals.membersSuspended)}</strong><span>已停用</span></article>
        <article><strong>${esc(totals.memorials)}</strong><span>靈堂</span></article>
        <article><strong>${esc(totals.capsulesOpen)}</strong><span>膠囊已開啟</span></article>
      </div>
      <h2>追思</h2>
      <div class="stat-row">
        <article><strong>${esc(totals.lights)}</strong><span>點燈</span></article>
        <article><strong>${esc(totals.flowers)}</strong><span>獻花</span></article>
        <article><strong>${esc(totals.prayers)}</strong><span>祈福</span></article>
        <article><strong>${esc(totals.messages)}</strong><span>公開留言</span></article>
        <article><strong>${esc(totals.messagesHidden)}</strong><span>已隱藏留言</span></article>
      </div>
      <h2>禮金</h2>
      <div class="stat-row">
        <article><strong>NT$${esc(ntd(totals.revenue))}</strong><span>合計</span></article>
        <article><strong>NT$${esc(ntd(totals.offering))}</strong><span>獻禮</span></article>
        <article><strong>NT$${esc(ntd(totals.capsule))}</strong><span>時光膠囊</span></article>
        <article><strong>NT$${esc(ntd(totals.commission))}</strong><span>託付</span></article>
      </div>
      <h2>最近禮金</h2>
      ${staffTable(['時間', '靈堂', '致奠者', '項目', '金額'], recentOrders)}
      <h2>靈堂</h2>
      ${staffTable(['先人', '家屬', '點燈', '獻花', '留言', '已收下'], recentHalls)}`;
  }
  const body = `<div class="wrap staff">${alerts({ notice, errors })}${content}</div>`;
  return layout({ title: `管理｜${settings.site_name}`, body, settings, mode: 'staff' });
}

function hallGate({ settings, member, memorial, role, notice }) {
  const waiting = role === 'pending';
  const refused = role === 'refused';
  const closed = role === 'closed';
  const guest = role === 'guest';
  const living = memorial.life_state !== 'deceased';
  const place = living ? '個人頁面' : '靈堂';
  const next = encodeURIComponent(`/hall/${memorial.invite_code}`);
  const body = `
    <section class="page-hero">
      <div class="wrap narrow">
        <p class="eyebrow">${place}</p>
        <h1>${esc(memorial.deceased_name)}</h1>
        ${alerts({ notice })}
        ${guest ? `<p>進入這一位的${place}，請先登入或註冊。家屬同意後才能進來。</p><div class="actions"><a class="btn dark" href="/login?next=${next}">登入</a><a class="btn line dark" href="/register?next=${next}">註冊</a></div>` : ''}
        ${waiting ? '<p>已向家屬提出，請等候同意。尚未同意前無法進入。</p>' : ''}
        ${refused ? '<p>家屬這次沒有同意進入。</p>' : ''}
        ${closed ? `<p>這一${living ? '頁' : '間'}目前暫停對外開放。</p>` : ''}
        ${!guest && !waiting && !refused && !closed ? `<p>進入之前，需要這一位的家屬同意。提出後請等候審核。</p><form method="post" action="/hall/${esc(memorial.invite_code)}/visit"><button class="btn dark" type="submit">提出進入</button></form>` : ''}
      </div>
    </section>`;
  return layout({ title: `${memorial.deceased_name}｜${settings.site_name}`, body, settings, member, current: 'hall' });
}

function plansPage({ settings, member, plans, current, notice }) {
  const mark = (item) => current && current.sku === item.sku ? ' class="is-current"' : '';
  const cells = (fn) => plans.map((item) => `<td${mark(item)}>${esc(fn(item))}</td>`).join('');
  const row = (label, fn) => `<tr><th>${esc(label)}</th>${cells(fn)}</tr>`;
  const table = `
    <div class="table-wrap">
      <table class="plan-table">
        <thead>
          <tr>
            <th>項目</th>
            ${plans.map((item) => `<th${mark(item)}>${esc(item.name)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${row('費用', (item) => item.month ? `每月 NT$${ntd(item.month)}` : '不另收費')}
          ${row('個人頁面', (item) => `${item.living} 個`)}
          ${row('靈堂', (item) => `管理 ${item.halls} 間`)}
          ${row('家族靈堂', (item) => item.family ? `${item.family} 間，可容納 ${item.familySeats} 位` : 'x')}
          ${row('容量', (item) => {
            const parts = [bytesLabel(item.bytes)];
            if (item.photos > 0) parts.push(`約 ${item.photos} 張照片`);
            if (item.videoSeconds > 0) parts.push(`約 ${Math.round(item.videoSeconds / 60)} 分鐘影片`);
            else parts.push('不能自行上傳影片');
            if (item.videoSeconds > 0) parts.push('照片與影片共用');
            return parts.join('，');
          })}
          ${row('時光膠囊', (item) => `${item.capsules} 個`)}
          ${row('時光膠囊可儲存年限', (item) => `${item.capsuleYears.join('、')} 年`)}
          ${row('分享查看', (item) => `${item.capsuleShares} 位會員`)}
        </tbody>
      </table>
    </div>`;
  const body = `
    <section class="page-hero plans-hero">
      <div class="hero-copy">
        <p class="eyebrow">時光仙境</p>
        <h1>方案</h1>
        ${alerts({ notice })}
      </div>
    </section>
    <div class="wrap">${table}</div>`;
  return layout({ title: `方案｜${settings.site_name}`, body, settings, member, current: 'plans' });
}

function payPage({ settings, member, checkout, sheet, notice }) {
  const fields = sheet ? Object.entries(sheet.fields).map(([key, value]) => `<input type="hidden" name="${esc(key)}" value="${esc(value)}">`).join('') : '';
  const body = `
    <section class="auth">
      <div class="auth-card">
        <p class="eyebrow">付款</p>
        <h1>${esc(checkout.item_label)}</h1>
        <p>NT$${esc(ntd(checkout.amount))}</p>
        ${alerts({ notice })}
        ${checkout.status === 'pending' && sheet ? `
          <p class="muted">這是綠界測試環境，不會真的扣款。</p>
          <form method="post" action="${esc(sheet.action)}">${fields}<p><button class="btn dark" type="submit">前往綠界測試收銀台</button></p></form>
          <p class="muted">測試卡號 ${esc(sheet.testCard)}。安全碼任意三碼，有效期限用未來的月份，3D 驗證碼 1234。</p>
          <form method="post" action="/pay/${esc(checkout.id)}/sandbox">
            <p><button class="btn line dark" type="submit">在這台電腦完成沙盒付款</button></p>
          </form>
          <p class="muted">這台電腦若收不到綠界回傳，用這一筆確認。確認之後，訂單才成立。</p>
        ` : '<p>這筆付款沒有完成。</p>'}
      </div>
    </section>`;
  return layout({ title: `付款｜${settings.site_name}`, body, settings, member, mode: 'account', current: 'account' });
}

function capsuleList({ settings, member, mine, shared, plan, canCreate, draft, notice, errors }) {
  const value = draft || { title: '', body: '', years: plan.capsuleYears[0], shares: [] };
  const yearOptions = (plan.capsuleYears || [1]).map((year) => `<option value="${year}"${Number(value.years) === year ? ' selected' : ''}>${year} 年後</option>`).join('');
  const shareFields = Array.from({ length: plan.capsuleShares || 1 }, (_, index) => field('share', index === 0 ? '邀請查看的會員信箱' : '再一位', (value.shares || [])[index] || '', {
    id: `share-${index}`,
    type: 'email',
    required: index === 0,
    max: 120
  })).join('');
  const card = (item, mineCard) => {
    const opened = isOpen(item.opens_at);
    return `
    <article class="sheet">
      <p class="eyebrow">${mineCard ? '我的時光膠囊' : `來自 ${esc(item.owner_name)} 的時光膠囊`}</p>
      <h2>${opened ? esc(item.title) : '尚未開啟'}</h2>
      <p>可開啟日期為 ${esc(dotDate(item.opens_at))}</p>
      <a class="btn line dark" href="/capsules/${esc(item.id)}">${opened ? '打開' : '查看日期'}</a>
    </article>`;
  };
  const body = `
    <section class="page-hero">
      <div class="wrap">
        <p class="eyebrow">時光膠囊</p>
        <h1>寫好再封存</h1>
        <p class="lede dark">目前方案可建立 ${esc(plan.capsules)} 個，年限 ${esc((plan.capsuleYears || []).join('、'))} 年，可分享給 ${esc(plan.capsuleShares)} 位會員。照片、影片與靈堂共用容量。送出之後就封存，開啟日之前不能查看，也不能再改。</p>
        ${alerts({ notice, errors })}
      </div>
    </section>
    <div class="wrap">
      ${canCreate ? `
        <form class="sheet" method="post" action="/capsules" enctype="multipart/form-data" data-capsule-form>
          <h2>撰寫</h2>
          <p class="muted">標題、內文、照片或影片、分享對象，都要在這一次備好。</p>
          ${field('title', '標題', value.title, { required: true, max: 40 })}
          ${field('body', '內文', value.body, { required: true, multiline: true, max: 4000 })}
          <label for="files">照片或影片</label>
          <input id="files" name="files" type="file" accept="image/jpeg,image/png,image/webp,video/mp4" multiple required data-capsule-files>
          <input type="hidden" name="durations" value="" data-durations>
          <label for="years">開啟年限</label>
          <select id="years" name="years">${yearOptions}</select>
          ${shareFields}
          <p class="muted">信箱必須是已註冊的會員。對方會在通知頁收到邀請，同意後才能一同查看。</p>
          <p><button class="btn dark" type="submit">封存</button></p>
        </form>` : '<p>目前的方案不能再建立時光膠囊。</p>'}
      <div class="stack">${(mine || []).map((item) => card(item, true)).join('')}${(shared || []).map((item) => card(item, false)).join('')}</div>
    </div>`;
  return layout({ title: `時光膠囊｜${settings.site_name}`, body, settings, member, mode: 'account', current: 'capsules' });
}

function capsulePage({ settings, member, capsule, opened, shares, media, notice, errors }) {
  const pieces = (media || []).map((item) => `
    <figure>
      ${item.kind === 'video'
        ? `<video src="/capsule-media/${esc(item.id)}/file" controls></video>`
        : `<img src="/capsule-media/${esc(item.id)}/file" alt="${esc(item.caption)}">`}
      <figcaption>${esc(item.caption)}</figcaption>
    </figure>`).join('');
  const shareStatus = { pending: '等候同意', allowed: '已同意', refused: '已婉拒' };
  const shareList = (shares || []).map((item) => `<li>${esc(item.name)}　${esc(shareStatus[item.status] || '')}</li>`).join('');
  const body = `
    <div class="wrap narrow">
      <p class="eyebrow">來自 ${esc(capsule.owner_name)} 的時光膠囊</p>
      <h1>${opened ? esc(capsule.title) : '尚未開啟'}</h1>
      <p>可開啟日期為 ${esc(dotDate(capsule.opens_at))}</p>
      ${alerts({ notice, errors })}
      ${opened ? `
        <section class="sheet story"><p>${esc(capsule.body)}</p></section>
        <section class="sheet"><h2>照片與影片</h2>${pieces ? `<div class="album">${pieces}</div>` : '<p class="muted">沒有照片或影片。</p>'}</section>
        ${shareList ? `<section class="sheet"><h2>可一同查看</h2><ul class="plain">${shareList}</ul></section>` : ''}
      ` : '<section class="sheet"><p>還沒到開啟日期。到了那一天，才能看裡面的話、照片和影片。</p></section>'}
    </div>`;
  return layout({ title: `${opened ? capsule.title : '時光膠囊'}｜${settings.site_name}`, body, settings, member, mode: 'account', current: 'capsules' });
}

function missing(settings) {
  const body = `<div class="wrap narrow"><h1>找不到這一頁</h1><p><a href="/">回首頁</a></p></div>`;
  return layout({ title: `找不到這一頁｜${settings.site_name}`, body, settings });
}

module.exports = {
  home,
  about,
  services,
  authPage,
  verifyPage,
  consult,
  account,
  usagePage,
  noticesPage,
  editor,
  hall,
  hallGate,
  plansPage,
  capsuleList,
  capsulePage,
  payPage,
  adminLogin,
  adminPage,
  missing
};
