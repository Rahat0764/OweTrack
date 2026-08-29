module.exports = (req, res) => {
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    developerWhatsapp: process.env.DEVELOPER_WHATSAPP_LINK || '',
    developerGithub: process.env.DEVELOPER_GITHUB_LINK || 'https://github.com/Rahat0764',
    developerLinkedin: process.env.DEVELOPER_LINKEDIN_LINK || 'https://linkedin.com/in/RahatAhmedX',
    superAdminEmail: process.env.SUPER_ADMIN_EMAIL || '',
    apkUrl: process.env.APK_URL || ''
  });
};
