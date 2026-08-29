const { getAdminClient, getUserFromToken, sendTelegram } = require('../lib/server');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, message, rating, accessToken } = req.body || {};
  const user = await getUserFromToken(accessToken);
  if (!user) return res.status(401).json({ error: 'Session expired, please login again' });

  const sb = getAdminClient();

  try {
    if (action === 'submit') {
      if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });

      let ratingVal = null;
      if (rating !== undefined && rating !== null && rating !== '') {
        const r = Number(rating);
        if (r >= 1 && r <= 5) ratingVal = r;
      }

      await sb.from('user_feedback').insert([{ user_id: user.id, message: message.trim(), rating: ratingVal }]).throwOnError();

      const name = user.user_metadata?.full_name || user.email;
      await sendTelegram(`💬 <b>New Feedback</b>\n👤 ${name}\n✉️ ${user.email}${ratingVal ? `\n⭐ ${ratingVal}/5` : ''}\n📝 ${message.trim()}`);

      return res.status(200).json({ ok: true });
    }

    if (action === 'list_own') {
      const { data, error } = await sb.from('user_feedback').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ feedback: data || [] });
    }

    if (action === 'mark_reply_seen') {
      await sb.from('user_feedback').update({ reply_seen: true }).eq('user_id', user.id).not('reply_at', 'is', null).throwOnError();
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
