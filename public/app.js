'use strict';
const $ = (id) => document.getElementById(id);
const state = { reportes: [], imageData: '', loading: false };

function showPage(page) {
  const name = page === 'admin' ? 'admin' : 'ciudadano';
  $('page-ciudadano').hidden = name !== 'ciudadano';
  $('page-admin').hidden = name !== 'admin';
  document.querySelectorAll('[data-page]').forEach(btn => {
    const active = btn.dataset.page === name;
    btn.classList.toggle('active', active);
    if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
  });
  if (name === 'admin') checkSession();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

document.querySelectorAll('[data-page]').forEach(btn => btn.addEventListener('click', () => {
  location.hash = btn.dataset.page;
  showPage(btn.dataset.page);
}));
$('brand-link').addEventListener('click', () => showPage('ciudadano'));
window.addEventListener('hashchange', () => showPage(location.hash.replace('#', '')));

function setMessage(id, text, kind = 'error') {
  const el = $(id);
  el.textContent = text;
  el.className = `message ${kind}`;
  el.hidden = !text;
}
async function api(url, options = {}) {
  let response;
  try { response = await fetch(url, { credentials: 'same-origin', ...options }); }
  catch { throw new Error('No fue posible conectar con el servidor. Comprueba que esté iniciado.'); }
  let body;
  try { body = await response.json(); } catch { body = {}; }
  if (!response.ok) {
    const err = new Error(body.error || `Error HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return body;
}
$('descripcion').addEventListener('input', e => $('char-count').textContent = e.target.value.length);

// Redimensiona la fotografía sin usar Cloud Storage: se almacena compacta en Firestore.
async function compressImage(file) {
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Selecciona una fotografía JPG, PNG o WEBP.');
  if (file.size > 12 * 1024 * 1024) throw new Error('La imagen original debe pesar menos de 12 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const max = 1000;
    const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Tu navegador no permite procesar esta fotografía.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let result = '';
    for (const quality of [.78, .65, .5, .35]) {
      result = canvas.toDataURL('image/jpeg', quality);
      if (Math.ceil((result.length - 23) * .75) < 420000) break;
    }
    if (Math.ceil((result.length - 23) * .75) >= 450000) throw new Error('La foto sigue siendo muy grande. Intenta con otra imagen.');
    return result;
  } finally { bitmap.close(); }
}
$('fotografia').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  state.imageData = '';
  $('preview').hidden = true;
  if (!file) return;
  $('upload-title').textContent = 'Comprimiendo fotografía...';
  try {
    state.imageData = await compressImage(file);
    $('preview').src = state.imageData;
    $('preview').hidden = false;
    $('upload-title').textContent = `Fotografía lista: ${file.name}`;
    setMessage('form-message', '');
  } catch (err) {
    $('upload-title').textContent = 'Selecciona otra fotografía';
    e.target.value = '';
    setMessage('form-message', err.message);
  }
});
$('report-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget;
  if (!form.reportValidity()) return;
  if (!state.imageData) return setMessage('form-message', 'Debes seleccionar una fotografía válida antes de enviar.');
  if (state.loading) return;
  state.loading = true;
  $('submit-btn').disabled = true;
  $('submit-btn').textContent = 'Enviando reporte...';
  setMessage('form-message', '');
  try {
    const datos = {
      tipo: $('tipo').value,
      categoria: $('categoria').value,
      ubicacion: $('ubicacion').value.trim(),
      descripcion: $('descripcion').value.trim(),
      nombre: $('nombre').value.trim(),
      fotografia: state.imageData,
    };
    const result = await api('/api/reportes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
    });
    $('report-form').hidden = true;
    $('success-state').hidden = false;
    $('tracking-code').textContent = result.codigo;
    $('formulario').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) { setMessage('form-message', err.message); }
  finally {
    state.loading = false;
    $('submit-btn').disabled = false;
    $('submit-btn').innerHTML = 'Enviar solicitud <span aria-hidden="true">→</span>';
  }
});
$('new-report-btn').addEventListener('click', () => {
  $('report-form').reset();
  state.imageData = '';
  $('preview').hidden = true;
  $('preview').removeAttribute('src');
  $('upload-title').textContent = 'Haz clic para seleccionar una fotografía';
  $('char-count').textContent = '0';
  $('success-state').hidden = true;
  $('report-form').hidden = false;
  setMessage('form-message', '');
  $('formulario').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

async function checkSession() {
  try {
    await api('/api/admin/sesion');
    $('login-panel').hidden = true;
    $('dashboard').hidden = false;
    await loadReports();
  } catch {
    $('login-panel').hidden = false;
    $('dashboard').hidden = true;
  }
}
$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  $('login-btn').disabled = true;
  setMessage('login-message', '');
  try {
    await api('/api/admin/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({password: $('password').value}) });
    $('password').value = '';
    $('login-panel').hidden = true;
    $('dashboard').hidden = false;
    await loadReports();
  } catch (err) {
    setMessage('login-message', err.message);
  } finally { $('login-btn').disabled = false; }
});
$('logout-btn').addEventListener('click', async () => {
  try { await api('/api/admin/logout', {method:'POST'}); } catch { /* El panel se oculta localmente incluso si falla la red. */ }
  state.reportes = [];
  $('dashboard').hidden = true;
  $('login-panel').hidden = false;
  setMessage('login-message', '');
});
$('refresh-btn').addEventListener('click', loadReports);
$('search-reports').addEventListener('input', renderReports);
$('filter-type').addEventListener('change', renderReports);

async function loadReports() {
  $('reports-content').innerHTML = '<div class="empty-state">Consultando Firebase...</div>';
  $('refresh-btn').disabled = true;
  try {
    const result = await api('/api/admin/reportes');
    state.reportes = Array.isArray(result.reportes) ? result.reportes : [];
    $('stat-total').textContent = state.reportes.length;
    $('stat-quejas').textContent = state.reportes.filter(r => r.tipo === 'Queja').length;
    $('stat-reportes').textContent = state.reportes.filter(r => r.tipo === 'Reporte').length;
    renderReports();
  } catch (err) {
    if (err.status === 401) { $('dashboard').hidden = true; $('login-panel').hidden = false; }
    $('reports-content').textContent = err.message;
  } finally { $('refresh-btn').disabled = false; }
}
function el(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value != null) node.textContent = String(value);
  return node;
}
function formatDate(iso) {
  if (!iso) return 'Fecha pendiente';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'Fecha pendiente' : date.toLocaleString('es-GT', {dateStyle:'medium',timeStyle:'short'});
}
function renderReports() {
  const container = $('reports-content');
  container.replaceChildren();
  const query = $('search-reports').value.trim().toLocaleLowerCase('es');
  const type = $('filter-type').value;
  const data = state.reportes.filter(r => (!type || r.tipo === type) &&
    (!query || [r.descripcion, r.categoria, r.ubicacion, r.codigo, r.nombre].some(v => String(v || '').toLocaleLowerCase('es').includes(query))));
  if (!data.length) {
    container.append(el('div', 'empty-state', state.reportes.length ? 'No hay reportes que coincidan con los filtros.' : 'Todavía no se han registrado solicitudes.'));
    return;
  }
  const table = el('table', 'report-table');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  ['Fotografía', 'Código / Fecha', 'Tipo', 'Categoría / Ubicación', 'Estado', 'Acción'].forEach(label => trh.append(el('th', '', label)));
  thead.append(trh);
  table.append(thead);
  const tbody = document.createElement('tbody');
  for (const r of data) {
    const tr = document.createElement('tr');
    let td = document.createElement('td');
    const img = el('img', 'row-photo');
    img.src = r.fotografia || '';
    img.alt = 'Fotografía de la solicitud';
    td.append(img); tr.append(td);
    td = document.createElement('td'); td.append(el('b','',r.codigo),el('small','',formatDate(r.creadoEn)));tr.append(td);
    td = document.createElement('td');td.append(el('span',`type-pill ${r.tipo === 'Queja' ? 'queja' : ''}`,r.tipo));tr.append(td);
    td = document.createElement('td');td.append(el('b','',r.categoria),el('small','',r.ubicacion));tr.append(td);
    td = document.createElement('td');td.append(el('span','status-pill',r.estado));tr.append(td);
    td = document.createElement('td');const btn = el('button','view-btn','Ver detalle');btn.type = 'button';btn.addEventListener('click',()=>openReport(r));td.append(btn);tr.append(td);
    tbody.append(tr);
  }
  table.append(tbody);container.append(table);
}
function detail(label, value) {
  const div = document.createElement('div');
  div.append(el('p','detail-label',label),el('p','detail-text',value || '—'));
  return div;
}
function openReport(r) {
  $('dialog-title').textContent = `Reporte ${r.codigo}`;
  const content = $('dialog-content');
  content.replaceChildren();
  const img = el('img','detail-photo');img.src = r.fotografia || '';img.alt = 'Fotografía original adjunta por el ciudadano';
  content.append(img);
  const grid = el('div','detail-grid');
  grid.append(detail('Tipo',r.tipo),detail('Estado',r.estado),detail('Categoría',r.categoria),detail('Fecha',formatDate(r.creadoEn)),detail('Ubicación',r.ubicacion),detail('Nombre',r.nombre));
  content.append(grid,detail('Descripción original',r.descripcion));
  $('report-dialog').showModal();
}
$('dialog-close').addEventListener('click', () => $('report-dialog').close());
$('report-dialog').addEventListener('click', event => {if (event.target === $('report-dialog')) $('report-dialog').close();});

showPage(location.hash.replace('#',''));
