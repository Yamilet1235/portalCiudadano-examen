'use strict';
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('node:crypto');
const path = require('node:path');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const COLLECTION = 'reportes_ciudadanos';
const TYPES = ['Queja', 'Reporte'];
const CATEGORIES = ['Calles y carreteras', 'Alumbrado público', 'Agua potable', 'Basura y limpieza', 'Parques y espacios públicos', 'Otros'];

if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'CAMBIA_ESTA_CONTRASENA' ||
    !process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32 ||
    process.env.ADMIN_SESSION_SECRET.startsWith('PEGA_AQUI')) {
  console.error('\n⚠️  Configura ADMIN_PASSWORD y ADMIN_SESSION_SECRET en tu archivo .env antes de iniciar.\n');
  process.exit(1);
}

let db;
try {
  initializeApp({ credential: applicationDefault() });
  db = getFirestore();
} catch (err) {
  console.error('❌ No se pudo configurar Firebase. Revisa GOOGLE_APPLICATION_CREDENTIALS y tu archivo JSON privado.');
  console.error(err.message);
  process.exit(1);
}

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '950kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const postLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Demasiados intentos. Vuelve a intentarlo más tarde.' } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Demasiados intentos de acceso. Inténtalo más tarde.' } });

function sha256(value) { return crypto.createHash('sha256').update(value).digest(); }
function safeEquals(a, b) { return crypto.timingSafeEqual(sha256(a), sha256(b)); }
function serializeSession() {
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp: Date.now() + 4 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
function verifySession(cookie) {
  if (!cookie || typeof cookie !== 'string') return false;
  const [payload, signature, extra] = cookie.split('.');
  if (!payload || !signature || extra) return false;
  const expected = crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET).update(payload).digest('base64url');
  if (!safeEquals(signature, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.role === 'admin' && Number.isFinite(data.exp) && data.exp > Date.now();
  } catch { return false; }
}
function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const item = raw.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return item ? item.substring(name.length + 1) : '';
}
function requireAdmin(req, res, next) {
  if (!verifySession(getCookie(req, 'admin_session'))) return res.status(401).json({ error: 'Acceso no autorizado. Inicia sesión.' });
  next();
}
function cleanText(value, max) { return typeof value === 'string' ? value.trim().slice(0, max + 1) : ''; }
function photoIsValid(photo) {
  if (typeof photo !== 'string') return false;
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo);
  if (!match || match[2].length > 600000) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length < 100 || bytes.length > 450000) return false;
  const sig = bytes.subarray(0, 12);
  const mime = match[1];
  const isJpeg = sig[0] === 0xff && sig[1] === 0xd8 && sig[2] === 0xff;
  const isPng = sig.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isWebp = sig.toString('ascii', 0, 4) === 'RIFF' && sig.toString('ascii', 8, 12) === 'WEBP';
  return (mime === 'jpeg' && isJpeg) || (mime === 'png' && isPng) || (mime === 'webp' && isWebp);
}

app.get('/api/health', (_, res) => res.json({ ok: true, servicio: 'Portal Municipal de Atención Ciudadana' }));

app.post('/api/reportes', postLimiter, async (req, res) => {
  try {
    const { tipo, categoria, descripcion, ubicacion, nombre, fotografia } = req.body || {};
    const tipoLimpio = cleanText(tipo, 30);
    const categoriaLimpia = cleanText(categoria, 70);
    const descripcionLimpia = cleanText(descripcion, 1200);
    const ubicacionLimpia = cleanText(ubicacion, 160);
    const nombreLimpio = cleanText(nombre, 90);
    if (!TYPES.includes(tipoLimpio)) return res.status(400).json({ error: 'Selecciona un tipo de solicitud válido.' });
    if (!CATEGORIES.includes(categoriaLimpia)) return res.status(400).json({ error: 'Selecciona una categoría válida.' });
    if (descripcionLimpia.length < 15 || descripcionLimpia.length > 1200) return res.status(400).json({ error: 'La descripción debe contener entre 15 y 1200 caracteres.' });
    if (ubicacionLimpia.length < 5 || ubicacionLimpia.length > 160) return res.status(400).json({ error: 'Indica una ubicación de 5 a 160 caracteres.' });
    if (nombreLimpio.length > 90) return res.status(400).json({ error: 'El nombre es demasiado largo.' });
    if (!photoIsValid(fotografia)) return res.status(400).json({ error: 'Adjunta una imagen JPG, PNG o WEBP válida y comprimida (máximo 450 KB).' });

    const ref = await db.collection(COLLECTION).add({
      tipo: tipoLimpio,
      categoria: categoriaLimpia,
      descripcion: descripcionLimpia,
      ubicacion: ubicacionLimpia,
      nombre: nombreLimpio || 'Anónimo',
      fotografia,
      estado: 'Recibido',
      creadoEn: FieldValue.serverTimestamp(),
    });
    return res.status(201).json({ mensaje: 'Tu solicitud fue registrada correctamente.', codigo: ref.id.slice(0, 8).toUpperCase() });
  } catch (err) {
    console.error('Error al guardar reporte:', err.message);
    return res.status(500).json({ error: 'No se pudo guardar el reporte en Firebase. Comprueba la conexión y vuelve a intentarlo.' });
  }
});

app.post('/api/admin/login', loginLimiter, (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password || !safeEquals(password, process.env.ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Contraseña incorrecta.' });
  }
  res.cookie('admin_session', serializeSession(), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 4 * 60 * 60 * 1000, path: '/' });
  return res.json({ mensaje: 'Sesión iniciada.' });
});

app.get('/api/admin/sesion', requireAdmin, (_, res) => res.json({ autenticado: true }));
app.post('/api/admin/logout', (_, res) => {
  res.clearCookie('admin_session', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
  res.json({ mensaje: 'Sesión cerrada.' });
});

app.get('/api/admin/reportes', requireAdmin, async (_, res) => {
  try {
    const snapshot = await db.collection(COLLECTION).orderBy('creadoEn', 'desc').limit(100).get();
    const reportes = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        codigo: doc.id.slice(0, 8).toUpperCase(),
        tipo: data.tipo, categoria: data.categoria, descripcion: data.descripcion,
        ubicacion: data.ubicacion, nombre: data.nombre,
        fotografia: data.fotografia, estado: data.estado,
        creadoEn: data.creadoEn?.toDate?.()?.toISOString() || null,
      };
    });
    res.json({ reportes });
  } catch (err) {
    console.error('Error al consultar Firestore:', err.message);
    res.status(500).json({ error: 'No se pudieron consultar las solicitudes en Firebase.' });
  }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'La fotografía supera el tamaño permitido.' });
  console.error('Error de aplicación:', err.message);
  return res.status(500).json({ error: 'Ocurrió un error interno.' });
});

app.listen(PORT, () => console.log(`\n✅ Portal municipal iniciado en http://localhost:${PORT}\n`));
