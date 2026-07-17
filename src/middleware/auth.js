function requireAuth(req, res, next) {
  if (!req.session.userId) {
    if (req.xhr || req.path.startsWith('/api/')) {
      return res.status(401).json({ error: '未登录' });
    }
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.session.role !== 'admin') {
    if (req.xhr || req.path.startsWith('/api/')) {
      return res.status(403).json({ error: '无权限' });
    }
    return res.status(403).send('无权访问');
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
