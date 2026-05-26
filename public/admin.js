// Admin dashboard client. Vanilla JS, no build step.
// Reads collection metadata from the inline <script id="collections-data">,
// then renders list + editor views and talks to /api/admin/*.

const COLLECTIONS = JSON.parse(document.getElementById('collections-data').textContent);

const state = {
  active: COLLECTIONS[0]?.slug ?? null,
  items: [],
  meta: null,
  editing: null, // { mode: 'new'|'edit', slug, data, body }
};

// =====================================================================
// HELPERS
// =====================================================================

function $(sel) { return document.querySelector(sel); }
function el(tag, props = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'style') Object.assign(n.style, v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'html') n.innerHTML = v;
    else if (v === true) n.setAttribute(k, '');
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return n;
}

function toast(msg, kind = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + kind;
  setTimeout(() => t.classList.remove('show'), 2400);
}

function fmtDate(v) {
  if (!v) return '';
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch { return String(v); }
}

// =====================================================================
// SIDEBAR + NAVIGATION
// =====================================================================

function renderSidebar() {
  const nav = $('#collections-nav');
  nav.innerHTML = '';
  // Group: Content vs Site
  const content = COLLECTIONS.filter((c) => c.slug !== 'pages');
  const settings = COLLECTIONS.filter((c) => c.slug === 'pages');

  nav.appendChild(el('div', { class: 'nav-section' }, 'Content'));
  content.forEach((c) => nav.appendChild(navItem(c)));

  if (settings.length) {
    nav.appendChild(el('div', { class: 'nav-section' }, 'Site & Pages'));
    settings.forEach((c) => nav.appendChild(navItem(c)));
  }
}

function navItem(c) {
  return el('a', {
    class: 'nav-item' + (c.slug === state.active ? ' active' : ''),
    dataset: { slug: c.slug },
    onclick: () => switchTo(c.slug),
  }, c.label);
}

async function switchTo(slug) {
  state.active = slug;
  $('#sidebar')?.classList.remove('open');
  document.querySelectorAll('.nav-item').forEach((n) => {
    n.classList.toggle('active', n.dataset.slug === slug);
  });
  await loadCollection();
}

// =====================================================================
// LIST VIEW
// =====================================================================

async function loadCollection() {
  $('#content').innerHTML = '<div class="empty">Loading…</div>';
  $('#new-btn').style.display = 'none';
  try {
    const r = await fetch(`/api/admin/content/${state.active}`);
    if (!r.ok) throw new Error(await r.text());
    const { meta, items } = await r.json();
    state.meta = meta;
    state.items = items;
    $('#page-title').textContent = meta.label;
    $('#page-sub').textContent = `${items.length} ${items.length === 1 ? meta.itemNoun : meta.itemNoun + 's'}`;
    $('#new-btn').style.display = '';
    $('#new-btn').textContent = `+ New ${meta.itemNoun}`;
    renderList();
  } catch (e) {
    $('#content').innerHTML = `<div class="empty">Couldn't load: ${e.message}</div>`;
  }
}

function renderList() {
  const wrap = $('#content');
  wrap.innerHTML = '';
  if (state.items.length === 0) {
    const empty = el('div', { class: 'empty' },
      `No ${state.meta.itemNoun}s yet.`,
      el('br'),
      el('button', { class: 'btn primary', onclick: openNew }, `+ Create your first ${state.meta.itemNoun}`)
    );
    wrap.appendChild(empty);
    return;
  }
  const grid = el('div', { class: 'list' });
  for (const item of state.items) {
    grid.appendChild(itemCard(item));
  }
  wrap.appendChild(grid);
}

function itemCard(item) {
  const d = item.data;
  const title = d.title || d.heading || d.siteName || item.slug;
  const subtitle = (() => {
    if (d.publishedAt) return fmtDate(d.publishedAt) + (d.draft ? ' · DRAFT' : '');
    if (d.takenAt) return fmtDate(d.takenAt);
    if (d.createdAt) return fmtDate(d.createdAt);
    if (d.tagline) return d.tagline;
    if (d.mood) return d.mood;
    if (d.eyebrow) return d.eyebrow;
    return item.slug;
  })();
  const card = el('div', { class: 'card', onclick: () => openEdit(item) });

  const imgPath = d.image || d.cover;
  if (imgPath) {
    // Resolve "./assets/x.jpg" relative to the entry's filePath
    const dir = item.filePath.replace(/\/[^\/]+$/, '');
    const src = imgPath.startsWith('./')
      ? '/api/admin/preview?path=' + encodeURIComponent(dir + imgPath.slice(1))
      : imgPath;
    card.appendChild(el('img', { class: 'thumb', src, alt: '', onerror: 'this.style.display="none"' }));
  }

  card.appendChild(el('div', { class: 'ttl' }, title));
  card.appendChild(el('div', { class: 'meta' }, subtitle));
  return card;
}

// =====================================================================
// EDITOR DRAWER
// =====================================================================

function openNew() {
  const data = {};
  for (const f of state.meta.fields) {
    if (f.type === 'tags') data[f.name] = [];
    else if (f.type === 'links' || f.type === 'sidebar' || f.type === 'sections') data[f.name] = [];
    else if (f.type === 'boolean') data[f.name] = false;
    else if (f.type === 'cta') data[f.name] = {};
    else data[f.name] = '';
  }
  state.editing = { mode: 'new', slug: '', data, body: '' };
  $('#drawer-title').textContent = `New ${state.meta.itemNoun}`;
  $('#drawer-delete').style.display = 'none';
  renderEditor();
  openDrawer();
}

async function openEdit(item) {
  state.editing = {
    mode: 'edit',
    slug: item.slug,
    data: structuredClone(item.data),
    body: item.body ?? '',
  };
  // Fill any missing schema fields so editor renders them
  for (const f of state.meta.fields) {
    if (state.editing.data[f.name] === undefined) {
      if (f.type === 'tags' || f.type === 'links' || f.type === 'sidebar' || f.type === 'sections') {
        state.editing.data[f.name] = [];
      } else if (f.type === 'boolean') {
        state.editing.data[f.name] = false;
      } else if (f.type === 'cta') {
        state.editing.data[f.name] = {};
      } else {
        state.editing.data[f.name] = '';
      }
    }
  }
  $('#drawer-title').textContent = `Edit · ${item.slug}`;
  // Don't allow deleting `site` (the only entry that *must* exist)
  $('#drawer-delete').style.display = (state.meta.slug === 'pages' && item.slug === 'site') ? 'none' : '';
  renderEditor();
  openDrawer();
}

function openDrawer() {
  $('#drawer').classList.add('open');
  $('#drawer-bg').classList.add('open');
  $('#drawer').setAttribute('aria-hidden', 'false');
}
function closeDrawer() {
  $('#drawer').classList.remove('open');
  $('#drawer-bg').classList.remove('open');
  $('#drawer').setAttribute('aria-hidden', 'true');
  state.editing = null;
}

function renderEditor() {
  const body = $('#drawer-body');
  body.innerHTML = '';
  const { mode, data } = state.editing;

  // Slug input (for new items and for renaming)
  const slugField = el('div', { class: 'field' },
    el('label', {}, 'Slug (URL identifier)'),
    el('input', {
      type: 'text',
      value: state.editing.slug,
      placeholder: mode === 'new' ? '(auto from title)' : '',
      readonly: mode === 'edit',
      oninput: (e) => { state.editing.slug = e.target.value; },
    }),
    el('div', { class: 'help' }, mode === 'edit' ? 'Slug is locked after creation. Delete and re-create to rename.' : 'Leave blank to auto-generate from the title.'),
  );
  body.appendChild(slugField);

  // For the `pages` collection, filter by scope so site.json only shows
  // site-wide fields and home/about only show per-page fields.
  const slug = state.editing.slug;
  const fields = state.meta.fields.filter((f) => {
    if (state.meta.slug !== 'pages' || !f.scope) return true;
    if (slug === 'site') return f.scope === 'site';
    return f.scope === 'page';
  });
  for (const f of fields) {
    body.appendChild(renderField(f, data));
  }

  if (state.meta.bodyLabel) {
    body.appendChild(el('div', { class: 'field' },
      el('label', {}, state.meta.bodyLabel),
      el('textarea', {
        rows: 16,
        oninput: (e) => { state.editing.body = e.target.value; },
      }, state.editing.body || ''),
      el('div', { class: 'help' }, 'Markdown. Use **bold**, # headings, > quotes, - lists, etc.'),
    ));
  }
}

function renderField(f, data) {
  const wrap = el('div', { class: 'field' });
  wrap.appendChild(el('label', {}, f.label + (f.required ? ' *' : '')));

  switch (f.type) {
    case 'text': {
      wrap.appendChild(el('input', {
        type: 'text', value: data[f.name] ?? '',
        oninput: (e) => { data[f.name] = e.target.value; },
      }));
      break;
    }
    case 'textarea': {
      wrap.appendChild(el('textarea', {
        rows: f.rows ?? 3,
        oninput: (e) => { data[f.name] = e.target.value; },
      }, data[f.name] ?? ''));
      break;
    }
    case 'number': {
      wrap.appendChild(el('input', {
        type: 'number', value: data[f.name] ?? '',
        oninput: (e) => { data[f.name] = e.target.value === '' ? '' : Number(e.target.value); },
      }));
      break;
    }
    case 'boolean': {
      const wrapper = el('div', { class: 'bool' });
      const cb = el('input', { type: 'checkbox',
        oninput: (e) => { data[f.name] = e.target.checked; },
      });
      cb.checked = Boolean(data[f.name]);
      wrapper.appendChild(cb);
      wrap.appendChild(wrapper);
      break;
    }
    case 'date': {
      const v = data[f.name] ? String(data[f.name]).slice(0, 10) : '';
      wrap.appendChild(el('input', {
        type: 'date', value: v,
        oninput: (e) => { data[f.name] = e.target.value; },
      }));
      break;
    }
    case 'select': {
      const sel = el('select', {
        oninput: (e) => { data[f.name] = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value); },
      });
      for (const opt of (f.options || [])) {
        const optEl = el('option', { value: opt }, opt);
        if (String(data[f.name]) === String(opt)) optEl.setAttribute('selected', '');
        sel.appendChild(optEl);
      }
      wrap.appendChild(sel);
      break;
    }
    case 'tags': {
      const v = Array.isArray(data[f.name]) ? data[f.name].join(', ') : (data[f.name] ?? '');
      wrap.appendChild(el('input', {
        type: 'text', value: v, placeholder: 'tag1, tag2, tag3',
        oninput: (e) => {
          data[f.name] = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
        },
      }));
      break;
    }
    case 'image': {
      wrap.appendChild(renderImageField(f, data));
      break;
    }
    case 'links': {
      wrap.appendChild(renderLinksField(f, data));
      break;
    }
    case 'sidebar': {
      wrap.appendChild(renderSidebarField(f, data));
      break;
    }
    case 'sections': {
      wrap.appendChild(renderSectionsField(f, data));
      break;
    }
    case 'cta': {
      const v = (data[f.name] && typeof data[f.name] === 'object') ? data[f.name] : {};
      data[f.name] = v;
      const row = el('div', { class: 'sub-row row2', style: { gridTemplateColumns: '1fr 1.5fr' } },
        el('div', {},
          el('label', {}, 'Button text'),
          el('input', { type: 'text', value: v.label ?? '', oninput: (e) => { v.label = e.target.value; } }),
        ),
        el('div', {},
          el('label', {}, 'URL or mailto:'),
          el('input', { type: 'text', value: v.href ?? '', oninput: (e) => { v.href = e.target.value; } }),
        ),
      );
      wrap.appendChild(row);
      break;
    }
  }

  if (f.help) wrap.appendChild(el('div', { class: 'help' }, f.help));
  return wrap;
}

// ===== Image field with browser compression + upload =================

function renderImageField(f, data) {
  const wrap = el('div', { class: 'img-field' });
  const previewSrc = data[f.name]
    ? (data[f.name].startsWith('./')
        ? '/api/admin/preview?path=' + encodeURIComponent(
            (state.editing.mode === 'edit' ? state.meta.contentDir : state.meta.contentDir) + data[f.name].slice(1)
          )
        : data[f.name])
    : '';
  const img = el('img', { class: 'img-preview', src: previewSrc, alt: '' });
  if (!previewSrc) img.style.display = 'none';
  const controls = el('div', { class: 'img-controls' });
  const status = el('div', { class: 'status' }, data[f.name] || '(no image)');
  const fileBtn = el('label', { class: 'file-btn' }, 'Choose photo (or drag here)');
  const input = el('input', { type: 'file', accept: 'image/*' });
  fileBtn.appendChild(input);

  const onFile = async (file) => {
    if (!file) return;
    status.classList.remove('err');
    status.textContent = 'Compressing…';
    try {
      const compressed = await compressImage(file);
      status.textContent = `Uploading (${(compressed.size / 1024).toFixed(0)} KB)…`;
      const fd = new FormData();
      fd.append('file', compressed, file.name);
      fd.append('collection', state.meta.slug);
      fd.append('filename', file.name);
      const r = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      data[f.name] = j.path;
      // Update preview by reading the compressed blob directly
      const reader = new FileReader();
      reader.onload = () => { img.src = reader.result; img.style.display = ''; };
      reader.readAsDataURL(compressed);
      status.textContent = j.path;
    } catch (e) {
      status.classList.add('err');
      status.textContent = 'Upload failed: ' + e.message;
    }
  };

  input.addEventListener('change', (e) => onFile(e.target.files?.[0]));
  // Drag-drop
  fileBtn.addEventListener('dragover', (e) => { e.preventDefault(); fileBtn.style.borderColor = 'var(--accent)'; });
  fileBtn.addEventListener('dragleave', () => { fileBtn.style.borderColor = ''; });
  fileBtn.addEventListener('drop', (e) => {
    e.preventDefault();
    fileBtn.style.borderColor = '';
    onFile(e.dataTransfer?.files?.[0]);
  });

  controls.appendChild(fileBtn);
  controls.appendChild(status);
  // Manual path entry as escape hatch
  const manual = el('input', {
    type: 'text', value: data[f.name] ?? '', placeholder: 'or paste ./assets/filename.jpg',
    style: { fontSize: '11px' },
    oninput: (e) => { data[f.name] = e.target.value; status.textContent = e.target.value || '(no image)'; },
  });
  controls.appendChild(manual);

  wrap.appendChild(img);
  wrap.appendChild(controls);
  return wrap;
}

/**
 * Browser-side image compression. Resizes to max 2400px on the long edge
 * and re-encodes as JPEG ~85% quality. Keeps payloads well under Vercel's
 * 4.5 MB function limit even for big iPhone photos.
 */
async function compressImage(file, maxDim = 2400, quality = 0.85) {
  if (!file.type.startsWith('image/')) return file;
  // Skip compression for tiny files
  if (file.size < 500 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  // Always emit JPEG for predictable sizing (transparent PNGs become opaque)
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}

// ===== Links field (array of { label, url }) =========================

function renderLinksField(f, data) {
  const list = Array.isArray(data[f.name]) ? data[f.name] : [];
  data[f.name] = list;
  const wrap = el('div', { class: 'sub-rows' });
  function rerender() {
    wrap.innerHTML = '';
    list.forEach((row, i) => {
      const r = el('div', { class: 'sub-row row2' },
        el('div', {},
          el('label', {}, 'Label'),
          el('input', { type: 'text', value: row.label ?? '', oninput: (e) => { row.label = e.target.value; } })
        ),
        el('div', {},
          el('label', {}, 'URL'),
          el('input', { type: 'text', value: row.url ?? row.href ?? '', oninput: (e) => { row.url = e.target.value; row.href = e.target.value; } })
        ),
        el('button', { class: 'x', type: 'button', onclick: () => { list.splice(i, 1); rerender(); } }, '×'),
      );
      wrap.appendChild(r);
    });
    wrap.appendChild(el('button', {
      class: 'add-row-btn', type: 'button',
      onclick: () => { list.push({ label: '', url: '' }); rerender(); },
    }, '+ Add row'));
  }
  rerender();
  return wrap;
}

// ===== Sidebar field (array of { label, value }) =====================

function renderSidebarField(f, data) {
  const list = Array.isArray(data[f.name]) ? data[f.name] : [];
  data[f.name] = list;
  const wrap = el('div', { class: 'sub-rows' });
  function rerender() {
    wrap.innerHTML = '';
    list.forEach((row, i) => {
      const r = el('div', { class: 'sub-row row2' },
        el('div', {},
          el('label', {}, 'Label'),
          el('input', { type: 'text', value: row.label ?? '', oninput: (e) => { row.label = e.target.value; } })
        ),
        el('div', {},
          el('label', {}, 'Value'),
          el('input', { type: 'text', value: row.value ?? '', oninput: (e) => { row.value = e.target.value; } })
        ),
        el('button', { class: 'x', type: 'button', onclick: () => { list.splice(i, 1); rerender(); } }, '×'),
      );
      wrap.appendChild(r);
    });
    wrap.appendChild(el('button', {
      class: 'add-row-btn', type: 'button',
      onclick: () => { list.push({ label: '', value: '' }); rerender(); },
    }, '+ Add row'));
  }
  rerender();
  return wrap;
}

// ===== Sections field (array of { eyebrow, heading, body, items[] }) =

function renderSectionsField(f, data) {
  const list = Array.isArray(data[f.name]) ? data[f.name] : [];
  data[f.name] = list;
  const wrap = el('div', { class: 'sub-rows' });
  function rerender() {
    wrap.innerHTML = '';
    list.forEach((row, i) => {
      const itemsEditor = el('textarea', {
        rows: Math.max(2, (row.items || []).length),
        placeholder: 'One item per line',
        oninput: (e) => {
          row.items = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
        },
      }, (row.items || []).join('\n'));
      const r = el('div', { class: 'sub-row' },
        el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          el('strong', { style: { fontSize: '12px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' } }, `Section ${i + 1}`),
          el('button', { class: 'x', type: 'button', onclick: () => { list.splice(i, 1); rerender(); } }, '×'),
        ),
        el('div', {},
          el('label', {}, 'Eyebrow'),
          el('input', { type: 'text', value: row.eyebrow ?? '', oninput: (e) => { row.eyebrow = e.target.value; } }),
        ),
        el('div', {},
          el('label', {}, 'Heading'),
          el('input', { type: 'text', value: row.heading ?? '', oninput: (e) => { row.heading = e.target.value; } }),
        ),
        el('div', {},
          el('label', {}, 'Body'),
          el('textarea', { rows: 2, oninput: (e) => { row.body = e.target.value; } }, row.body ?? ''),
        ),
        el('div', { class: 'section-items' },
          el('label', {}, 'List items'),
          itemsEditor,
        ),
      );
      wrap.appendChild(r);
    });
    wrap.appendChild(el('button', {
      class: 'add-row-btn', type: 'button',
      onclick: () => { list.push({ eyebrow: '', heading: '', body: '', items: [] }); rerender(); },
    }, '+ Add section'));
  }
  rerender();
  return wrap;
}

// =====================================================================
// SAVE / DELETE
// =====================================================================

async function save() {
  if (!state.editing) return;
  const { mode, slug, data, body } = state.editing;
  // Strip empty values so JSON files stay clean
  const cleanData = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === '' || v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((x) => !x)) continue;
    cleanData[k] = v;
  }
  $('#drawer-save').setAttribute('disabled', '');
  $('#drawer-save').textContent = 'Saving…';
  try {
    const url = mode === 'new'
      ? `/api/admin/content/${state.meta.slug}`
      : `/api/admin/content/${state.meta.slug}/${slug}`;
    const r = await fetch(url, {
      method: mode === 'new' ? 'POST' : 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, data: cleanData, body }),
    });
    if (!r.ok) throw new Error(await r.text());
    toast('Saved. Vercel rebuild starting…', 'ok');
    closeDrawer();
    await loadCollection();
  } catch (e) {
    toast('Save failed: ' + e.message, 'err');
  } finally {
    $('#drawer-save').removeAttribute('disabled');
    $('#drawer-save').textContent = 'Save';
  }
}

async function del() {
  if (!state.editing) return;
  const { slug } = state.editing;
  if (!confirm(`Delete "${slug}"? This cannot be undone.`)) return;
  try {
    const r = await fetch(`/api/admin/content/${state.meta.slug}/${slug}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await r.text());
    toast('Deleted.', 'ok');
    closeDrawer();
    await loadCollection();
  } catch (e) {
    toast('Delete failed: ' + e.message, 'err');
  }
}

// =====================================================================
// WIRE UP
// =====================================================================

$('#drawer-close').addEventListener('click', closeDrawer);
$('#drawer-cancel').addEventListener('click', closeDrawer);
$('#drawer-bg').addEventListener('click', closeDrawer);
$('#drawer-save').addEventListener('click', save);
$('#drawer-delete').addEventListener('click', del);
$('#new-btn').addEventListener('click', openNew);
$('#menu-btn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

renderSidebar();
if (state.active) loadCollection();
