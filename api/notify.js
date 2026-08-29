const { getUserFromToken, sendTelegram } = require('../lib/server');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { event, accessToken, details } = req.body || {};

  const user = await getUserFromToken(accessToken);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const name = user.user_metadata?.full_name || user.email;
  let msg = '';

  switch (event) {
    case 'login':
      msg = `👋 <b>New Login</b>\n👤 ${name}\n✉️ ${user.email}`;
      break;
    case 'contact_add':
      msg = `➕ <b>New Contact Added</b>\n👤 ${name}\n🧑 Contact: ${details.contact_name}`;
      break;
    case 'contact_delete':
      msg = `🗑️ <b>Contact Deleted</b>\n👤 ${name}\n🧑 Contact: ${details.contact_name}`;
      break;
    case 'entry_add':
      msg = `💰 <b>${details.type === 'gave' ? 'Gave (You → Them)' : 'Took (Them → You)'}</b>\n👤 ${name}\n🧑 With: ${details.contact_name}\n💵 ৳${details.amount}\n🔑 Ref #${details.ref_id}`;
      break;
    case 'entry_delete':
      msg = `🗑️ <b>Entry Deleted</b>\n👤 ${name}\n🔑 Ref #${details.ref_id}\n💵 ৳${details.amount}`;
      break;
    case 'full_reset':
      msg = `⚠️ <b>Full History Reset</b>\n👤 ${name}\n✉️ ${user.email}\nAll contacts & entries wiped by the user.`;
      break;
    default:
      return res.status(400).json({ error: 'Unknown event' });
  }

  await sendTelegram(msg);
  return res.status(200).json({ ok: true });
};
