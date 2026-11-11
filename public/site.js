const heroVideo = document.querySelector('.hero-video');
if (heroVideo) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    heroVideo.removeAttribute('autoplay');
    heroVideo.pause();
  } else {
    heroVideo.play().catch(() => {});
  }
}

const toggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const input = document.querySelector(button.getAttribute('data-copy'));
    const status = document.querySelector(button.getAttribute('data-status'));
    if (!input) return;
    try {
      await navigator.clipboard.writeText(input.value);
      if (status) status.textContent = '已複製。';
    } catch (_) {
      input.focus();
      input.select();
      if (status) status.textContent = '請手動複製網址。';
    }
  });
});

const form = document.querySelector('[data-memorial-form]');
if (form) {
  const name = form.querySelector('[name="deceasedName"]');
  const title = form.querySelector('[name="title"]');
  const nameOut = document.querySelector('[data-preview-name]');
  const titleOut = document.querySelector('[data-preview-title]');
  const paint = () => {
    if (nameOut && name) nameOut.textContent = name.value.trim() || '尚未填寫名諱';
    if (titleOut && title) titleOut.textContent = title.value.trim();
  };
  name?.addEventListener('input', paint);
  title?.addEventListener('input', paint);
}


const capsuleForm = document.querySelector('[data-capsule-form]');
if (capsuleForm) {
  const input = capsuleForm.querySelector('[data-capsule-files]');
  const durations = capsuleForm.querySelector('[data-durations]');
  const readDuration = (file) => new Promise((resolve) => {
    if (!file.type.startsWith('video/')) {
      resolve('0');
      return;
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolve(String(Math.max(1, Math.round(video.duration || 0))));
      URL.revokeObjectURL(video.src);
    };
    video.onerror = () => resolve('0');
    video.src = URL.createObjectURL(file);
  });
  input.addEventListener('change', async () => {
    const files = [...(input.files || [])];
    const values = await Promise.all(files.map(readDuration));
    durations.value = values.join(',');
  });
}

document.querySelectorAll('#rituals form').forEach((item) => {
  item.addEventListener('submit', () => {
    const button = item.querySelector('button');
    if (button) button.textContent = '送出中';
  });
});

document.querySelectorAll('[data-shop]').forEach((shop) => {
  shop.addEventListener('toggle', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLDetailsElement) || !target.open) return;
    if (!target.classList.contains('shop-fold') && !target.classList.contains('shop-cat')) return;
    const root = target.parentElement;
    if (!root) return;
    root.querySelectorAll(':scope > details.shop-fold, :scope > details.shop-cat').forEach((item) => {
      if (item !== target) item.open = false;
    });
  }, true);
});

document.querySelectorAll('[data-note-open]').forEach((button) => {
  button.addEventListener('click', () => {
    const dialog = document.getElementById(button.getAttribute('data-note-open'));
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
  });
});
document.querySelectorAll('[data-note-dialog]').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
});

const uploadForm = document.querySelector('[data-upload]');
if (uploadForm) {
  const input = uploadForm.querySelector('[data-crop-file]');
  const roleInput = uploadForm.querySelector('[data-role]');
  const durationInput = uploadForm.querySelector('[data-duration]');
  let cropped = false;

  let applying = false;
  input.addEventListener('change', () => {
    if (applying) {
      applying = false;
      return;
    }
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        durationInput.value = String(Math.max(1, Math.round(video.duration || 0)));
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(file);
      return;
    }
    if (file.type.startsWith('image/')) openCrop(file);
  });

  function openCrop(file) {
    const layer = document.createElement('div');
    layer.className = 'crop-layer';
    layer.innerHTML = '<div class="crop-panel"><h2>相片裁切</h2><p class="muted">拖移方框，取直幅。</p><div class="crop-stage"><canvas></canvas></div><label><input type="checkbox" data-portrait> 作為主遺影，不計入張數</label><p><button class="btn dark" type="button" data-use>使用這張</button> <button class="btn line dark" type="button" data-cancel>取消</button></p></div>';
    document.body.appendChild(layer);
    const canvas = layer.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const maxW = Math.min(480, window.innerWidth - 80);
      const scale = Math.min(1, maxW / image.width);
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const box = document.createElement('div');
      box.className = 'crop-box';
      const stage = layer.querySelector('.crop-stage');
      stage.appendChild(box);
      let width = Math.min(canvas.width * 0.72, canvas.height * 0.72 * 3 / 4);
      let height = width * 4 / 3;
      if (height > canvas.height) {
        height = canvas.height * 0.86;
        width = height * 3 / 4;
      }
      let left = (canvas.width - width) / 2;
      let top = (canvas.height - height) / 2;
      const paint = () => {
        box.style.left = `${left}px`;
        box.style.top = `${top}px`;
        box.style.width = `${width}px`;
        box.style.height = `${height}px`;
      };
      paint();
      let drag = null;
      box.addEventListener('pointerdown', (event) => {
        drag = { x: event.clientX, y: event.clientY, left, top };
        box.setPointerCapture(event.pointerId);
      });
      box.addEventListener('pointermove', (event) => {
        if (!drag) return;
        left = Math.min(canvas.width - width, Math.max(0, drag.left + event.clientX - drag.x));
        top = Math.min(canvas.height - height, Math.max(0, drag.top + event.clientY - drag.y));
        paint();
      });
      box.addEventListener('pointerup', () => { drag = null; });
      layer.querySelector('[data-use]').addEventListener('click', () => {
        const ratio = image.width / canvas.width;
        const out = document.createElement('canvas');
        out.width = 900;
        out.height = 1200;
        out.getContext('2d').drawImage(image, left * ratio, top * ratio, width * ratio, height * ratio, 0, 0, out.width, out.height);
        out.toBlob((blob) => {
          const next = new File([blob], 'portrait.jpg', { type: 'image/jpeg' });
          const data = new DataTransfer();
          data.items.add(next);
          applying = true;
          input.files = data.files;
          roleInput.value = layer.querySelector('[data-portrait]').checked ? 'portrait' : 'album';
          cropped = true;
          URL.revokeObjectURL(url);
          layer.remove();
        }, 'image/jpeg', 0.92);
      });
    };
    image.src = url;
    layer.querySelector('[data-cancel]').addEventListener('click', () => {
      input.value = '';
      URL.revokeObjectURL(url);
      layer.remove();
    });
  }
}
