const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// ---- Supabase admin (service role) client ----
function getAdminClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

// ---- Identify the logged-in user from the Supabase access token sent by the browser ----
async function getUserFromToken(accessToken) {
  if (!accessToken) return null;
  const sb = getAdminClient();
  const { data, error } = await sb.auth.getUser(accessToken);
  if (error || !data || !data.user) return null;
  return data.user;
}

// ---- Small HMAC session token, used only for the Master-Key admin session ----
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function requireAdmin(req) {
  const token = req.headers['x-admin-token'];
  const payload = verify(token);
  return payload && payload.role === 'super_admin' ? payload : null;
}

// ---- PIN hashing (scrypt + per-pin random salt) ----
function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function checkPin(pin, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const attempt = crypto.scryptSync(String(pin), salt, 64).toString('hex');
  const a = Buffer.from(attempt);
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ---- Telegram notifications (best-effort, never throws) ----
async function sendTelegram(message) {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
    });
  } catch (e) {}
}

function refId() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

module.exports = {
  getAdminClient, getUserFromToken, sign, verify, requireAdmin,
  hashPin, checkPin, sendTelegram, refId
};
