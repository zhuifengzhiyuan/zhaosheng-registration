const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/');
  }
  res.render('login', { error: null, layout: false });
});

router.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.displayName = user.display_name;
  req.session.role = user.role;

  res.json({ success: true, redirect: '/' });
});

router.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

router.get('/api/me', requireAuth, (req, res) => {
  res.json({
    username: req.session.username,
    displayName: req.session.displayName,
    role: req.session.role
  });
});

router.get('/api/users', requireAuth, (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: '无权限' });
  }
  const users = db.prepare('SELECT id, username, display_name, role, is_active, created_at FROM users ORDER BY id').all();
  res.json(users);
});

router.post('/api/users', requireAuth, (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: '无权限' });
  }
  const { username, password, display_name, role } = req.body;
  if (!username || !password || !display_name) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: '用户名已存在' });
  }

  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)').run(
    username, hash, display_name, role || 'staff'
  );

  res.json({ success: true });
});

router.put('/api/users/:id/reset-password', requireAuth, (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: '无权限' });
  }
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: '请输入新密码' });
  }
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ success: true });
});

router.put('/api/users/:id/toggle-active', requireAuth, (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: '无权限' });
  }
  const user = db.prepare('SELECT id, is_active FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.id === req.session.userId) return res.status(400).json({ error: '不能禁用自己' });
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(user.is_active ? 0 : 1, req.params.id);
  res.json({ success: true });
});

module.exports = router;
