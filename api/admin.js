const { getAdminClient, requireAdmin, sendTelegram, refId } = require('../lib/server');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const adminPayload = requireAdmin(req);
  if (!adminPayload) return res.status(401).json({ error: 'Admin session expired, enter the Master Key again' });

  const sb = getAdminClient();
  const { action, payload } = req.body || {};
  const superEmail = (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim();

  try {
    switch (action) {
      case 'list_users': {
        const { data: authData, error: authErr } = await sb.auth.admin.listUsers();
        if (authErr) throw authErr;
        const authUsers = authData.users || [];

        const { data: profiles, error: pErr } = await sb.from('profiles').select('*');
        if (pErr) throw pErr;

        const { data: contacts, error: cErr } = await sb.from('contacts').select('id, user_id');
        if (cErr) throw cErr;

        const { data: entries, error: eErr } = await sb.from('entries').select('user_id, type, amount');
        if (eErr) throw eErr;

        const contactCounts = {};
        (contacts || []).forEach(c => { contactCounts[c.user_id] = (contactCounts[c.user_id] || 0) + 1; });

        const totals = {};
        (entries || []).forEach(e => {
          if (!totals[e.user_id]) totals[e.user_id] = { gave: 0, took: 0, count: 0 };
          totals[e.user_id][e.type] += Number(e.amount);
          totals[e.user_id].count += 1;
        });

        // Merge Auth Data with Profiles Data securely
        const usersMap = {};
        authUsers.forEach(u => {
          const meta = u.user_metadata || {};
          usersMap[u.id] = {
            id: u.id,
            email: u.email || '',
            full_name: meta.full_name || meta.name || 'User',
            avatar_url: meta.avatar_url || meta.picture || '',
            is_suspended: false,
            created_at: u.created_at
          };
        });

        (profiles || []).forEach(p => {
          if (!usersMap[p.id]) {
            usersMap[p.id] = { id: p.id, email: p.email || '', full_name: 'User', created_at: p.created_at };
          }
          if (p.full_name) usersMap[p.id].full_name = p.full_name;
          if (p.avatar_url) usersMap[p.id].avatar_url = p.avatar_url;
          usersMap[p.id].is_suspended = p.is_suspended;
          usersMap[p.id].pin_set = p.pin_set;
        });

        const users = Object.values(usersMap).map(u => ({
          ...u,
          isAdmin: !!superEmail && (u.email || '').toLowerCase().trim() === superEmail,
          contactCount: contactCounts[u.id] || 0,
          totalGave: totals[u.id]?.gave || 0,
          totalTook: totals[u.id]?.took || 0,
          entryCount: totals[u.id]?.count || 0
        })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return res.status(200).json({ users });
      }

      case 'suspend_user': {
        if (payload.id === adminPayload.uid) return res.status(400).json({ error: 'You cannot suspend your own account' });
        await sb.from('profiles').update({ is_suspended: true, suspend_reason: payload.reason || null }).eq('id', payload.id).throwOnError();
        await sendTelegram(`⛔ <b>User Suspended</b>\nID: ${payload.id}\nReason: ${payload.reason || '—'}`);
        return res.status(200).json({ ok: true });
      }

      case 'unsuspend_user': {
        await sb.from('profiles').update({ is_suspended: false, suspend_reason: null }).eq('id', payload.id).throwOnError();
        await sendTelegram(`✅ <b>User Unsuspended</b>\nID: ${payload.id}`);
        return res.status(200).json({ ok: true });
      }

      case 'ban_user': {
        if (payload.id === adminPayload.uid) return res.status(400).json({ error: 'You cannot ban your own account' });
        const { error } = await sb.auth.admin.deleteUser(payload.id);
        if (error) throw error;
        await sendTelegram(`🚨 <b>User Banned & Deleted</b>\nID: ${payload.id}`);
        return res.status(200).json({ ok: true });
      }

      case 'send_feedback': {
        if (!payload.message || !payload.user_id) return res.status(400).json({ error: 'Message and user are required' });
        await sb.from('feedback').insert([{ user_id: payload.user_id, message: payload.message }]).throwOnError();
        const id = refId();
        await sendTelegram(`💬 <b>Message Sent</b>\nTo: ${payload.user_id}\n📝 ${payload.message}\n🔑 Ref #${id}`);
        return res.status(200).json({ ok: true });
      }

      case 'get_user_data': {
        const { data: contacts, error: cErr } = await sb.from('contacts').select('*').eq('user_id', payload.user_id);
        if (cErr) throw cErr;
        const { data: entries, error: eErr } = await sb.from('entries').select('*').eq('user_id', payload.user_id).order('entry_date', { ascending: false });
        if (eErr) throw eErr;
        return res.status(200).json({ contacts: contacts || [], entries: entries || [] });
      }

      case 'list_user_feedback': {
        const { data: fb, error: fErr } = await sb.from('user_feedback').select('*').order('created_at', { ascending: false });
        if (fErr) throw fErr;

        const userIds = [...new Set((fb || []).map(f => f.user_id))];
        let profilesMap = {};
        if (userIds.length) {
          const { data: profs, error: prErr } = await sb.from('profiles').select('*').in('id', userIds);
          if (prErr) throw prErr;
          (profs || []).forEach(p => { profilesMap[p.id] = p; });
        }

        const feedbackList = (fb || []).map(f => ({
          ...f,
          full_name: profilesMap[f.user_id]?.full_name || 'Unknown',
          email: profilesMap[f.user_id]?.email || '',
          avatar_url: profilesMap[f.user_id]?.avatar_url || ''
        }));

        return res.status(200).json({ feedback: feedbackList });
      }

      case 'mark_feedback_read': {
        await sb.from('user_feedback').update({ is_read: true }).eq('id', payload.id).throwOnError();
        return res.status(200).json({ ok: true });
      }

      case 'mark_feedback_unread': {
        await sb.from('user_feedback').update({ is_read: false }).eq('id', payload.id).throwOnError();
        return res.status(200).json({ ok: true });
      }

      case 'mark_all_feedback_read': {
        await sb.from('user_feedback').update({ is_read: true }).eq('is_read', false).throwOnError();
        return res.status(200).json({ ok: true });
      }

      case 'mark_all_feedback_unread': {
        await sb.from('user_feedback').update({ is_read: false }).eq('is_read', true).throwOnError();
        return res.status(200).json({ ok: true });
      }

      case 'delete_user_feedback': {
        await sb.from('user_feedback').delete().eq('id', payload.id).throwOnError();
        return res.status(200).json({ ok: true });
      }

      case 'delete_all_user_feedback': {
        await sb.from('user_feedback').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError();
        return res.status(200).json({ ok: true });
      }

      case 'reply_user_feedback': {
        if (!payload.reply || !payload.reply.trim()) return res.status(400).json({ error: 'Reply text required' });
        await sb.from('user_feedback').update({
          admin_reply: payload.reply.trim(),
          reply_at: new Date().toISOString(),
          reply_seen: false,
          is_read: true
        }).eq('id', payload.id).throwOnError();
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(400).json({ error: 'Unknown command' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};