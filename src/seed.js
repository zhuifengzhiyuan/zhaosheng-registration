const bcrypt = require('bcryptjs');
const { db, initialize } = require('./database');

async function run() {
  await initialize();

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (existing) {
    console.log('管理员用户已存在，跳过初始化');
    process.exit(0);
  }

  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)').run(
    'admin', hash, '系统管理员', 'admin'
  );

  console.log('初始化完成！');
  console.log('管理员账号: admin');
  console.log('管理员密码: admin123');
}

run().catch(err => { console.error(err); process.exit(1); });
