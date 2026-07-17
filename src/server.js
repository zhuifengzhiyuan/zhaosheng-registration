const express = require('express');
const session = require('express-session');
const path = require('path');
const layouts = require('express-ejs-layouts');
const { db, initialize } = require('./database');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');

app.use(layouts);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'zhaosheng-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax'
  }
}));

app.use((req, res, next) => {
  res.locals.currentUser = req.session.userId ? {
    username: req.session.username,
    displayName: req.session.displayName,
    role: req.session.role
  } : null;
  next();
});

app.use('/', authRoutes);
app.use('/', studentRoutes);

app.get('/', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN admission_type = '正式录取' THEN 1 ELSE 0 END) as formal,
      SUM(CASE WHEN admission_type = '自主招生' THEN 1 ELSE 0 END) as independent
    FROM students
  `).get();

  const recentStudents = db.prepare(`
    SELECT s.*, u.display_name as creator_name
    FROM students s
    LEFT JOIN users u ON s.created_by = u.id
    ORDER BY s.created_at DESC LIMIT 5
  `).all();

  res.render('dashboard', { stats, recentStudents, title: '仪表盘' });
});

async function start() {
  await initialize();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`招生登记系统已启动: http://localhost:${PORT}`);
  });
}

start().catch(err => { console.error('启动失败:', err); process.exit(1); });
