const { getAdminClient, getUserFromToken, hashPin, checkPin, sendTelegram } = require('../lib/server');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, pin, oldPin, accessToken } = req.body || {};
  const user = await getUserFromToken(accessToken);
  if (!user) return res.status(401).json({ error: 'Session expired, please login again' });

  const sb = getAdminClient();

  try {
    if (action === 'status') {
      const { data } = await sb.from('profiles').select('pin_set, is_suspended').eq('id', user.id).single();
      return res.status(200).json({ pin_set: !!(data && data.pin_set), is_suspended: !!(data && data.is_suspended) });
    }

    // 1. SET: only for brand new accounts (first-time PIN)
    if (action === 'set') {
      if (!pin || String(pin).length !== 6) return res.status(400).json({ error: 'PIN_LENGTH_ERR' });
      const { data: prof } = await sb.from('profiles').select('pin_set').eq('id', user.id).single();
      if (prof && prof.pin_set) return res.status(409).json({ error: 'PIN already exists. Please change or reset.' });

      const pin_hash = hashPin(pin);
      await sb.from('profiles').upsert({ id: user.id, email: user.email, pin_hash, pin_set: true }).throwOnError();
      await sendTelegram(`🔐 <b>New PIN Set</b>\n👤 ${user.email}`);
      return res.status(200).json({ ok: true });
    }

    // 2. CHANGE: updating an existing PIN (requires old PIN)
    if (action === 'change') {
      if (!pin || String(pin).length !== 6) return res.status(400).json({ error: 'PIN_LENGTH_ERR' });
      if (!oldPin) return res.status(400).json({ error: 'OLD_PIN_REQUIRED' });

      const { data: prof } = await sb.from('profiles').select('pin_set, pin_hash').eq('id', user.id).single();
      if (!prof || !prof.pin_set) return res.status(400).json({ error: 'No PIN is currently set' });
      if (!checkPin(oldPin, prof.pin_hash)) return res.status(401).json({ error: 'OLD_PIN_INVALID' });

      const pin_hash = hashPin(pin);
      await sb.from('profiles').upsert({ id: user.id, email: user.email, pin_hash, pin_set: true }).throwOnError();
      await sendTelegram(`🔐 <b>PIN Changed</b>\n👤 ${user.email}`);
      return res.status(200).json({ ok: true });
    }

    // 3. RESET: recover a forgotten PIN (identity already verified via login)
    if (action === 'reset') {
      if (!pin || String(pin).length !== 6) return res.status(400).json({ error: 'PIN_LENGTH_ERR' });
      const pin_hash = hashPin(pin);
      await sb.from('profiles').upsert({ id: user.id, email: user.email, pin_hash, pin_set: true }).throwOnError();
      await sendTelegram(`🔐 <b>PIN Reset</b>\n👤 ${user.email}`);
      return res.status(200).json({ ok: true });
    }

    if (action === 'verify') {
      if (!pin) return res.status(400).json({ error: 'Enter PIN' });
      const { data: prof } = await sb.from('profiles').select('pin_hash, pin_set').eq('id', user.id).single();
      if (!prof || !prof.pin_set) return res.status(400).json({ error: 'No PIN set' });
      const ok = checkPin(pin, prof.pin_hash);
      if (!ok) return res.status(401).json({ error: 'Incorrect PIN' });
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete_account') {
      const { error } = await sb.auth.admin.deleteUser(user.id);
      if (error) throw error;
      await sendTelegram(`🚨 <b>Account Permanently Deleted</b>\n👤 ${user.email}`);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};