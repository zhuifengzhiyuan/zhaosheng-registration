const express = require('express');
const { db } = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/students', requireAuth, (req, res) => {
  const search = req.query.search || '';
  const admissionType = req.query.admission_type || '';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params = [];

  if (search) {
    where += ' AND (s.student_name LIKE ? OR s.id_number LIKE ? OR s.middle_school LIKE ? OR s.father_name LIKE ? OR s.mother_name LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like, like);
  }
  if (admissionType) {
    where += ' AND s.admission_type = ?';
    params.push(admissionType);
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM students s ${where}`).get(...params);
  const total = countRow.total;
  const totalPages = Math.ceil(total / limit);

  const students = db.prepare(`
    SELECT s.*, u.display_name as creator_name
    FROM students s
    LEFT JOIN users u ON s.created_by = u.id
    ${where}
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.render('students/index', {
    students,
    search,
    admissionType,
    page,
    totalPages,
    total,
    title: '学生列表'
  });
});

router.get('/students/add', requireAuth, (req, res) => {
  res.render('students/form', { student: null, error: null, title: '添加学生' });
});

router.get('/students/:id', requireAuth, (req, res) => {
  const student = db.prepare(`
    SELECT s.*, u.display_name as creator_name
    FROM students s
    LEFT JOIN users u ON s.created_by = u.id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!student) {
    return res.status(404).send('学生记录不存在');
  }

  res.render('students/detail', { student, title: '学生详情' });
});

router.get('/students/:id/edit', requireAuth, (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) {
    return res.status(404).send('学生记录不存在');
  }
  res.render('students/form', { student, error: null, title: '编辑学生' });
});

router.post('/api/students', requireAuth, (req, res) => {
  try {
    const {
      student_name, gender, ethnicity, admission_type,
      registered_address, home_address, id_number,
      middle_school, father_name, father_phone,
      mother_name, mother_phone, zhongkao_score, notes
    } = req.body;

    if (!student_name || !gender || !ethnicity || !admission_type || !id_number) {
      return res.status(400).json({ error: '请填写必填字段（姓名、性别、民族、录取类型、身份证号）' });
    }

    if (!/^\d{17}[\dXx]$/.test(id_number)) {
      return res.status(400).json({ error: '身份证号码格式不正确' });
    }

    const existing = db.prepare('SELECT id FROM students WHERE id_number = ?').get(id_number);
    if (existing) {
      return res.status(400).json({ error: '该身份证号码已存在' });
    }

    db.prepare(`
      INSERT INTO students
      (student_name, gender, ethnicity, admission_type, registered_address, home_address,
       id_number, middle_school, father_name, father_phone, mother_name, mother_phone,
       zhongkao_score, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      student_name, gender, ethnicity, admission_type,
      registered_address || '', home_address || '',
      id_number, middle_school || '',
      father_name || '', father_phone || '',
      mother_name || '', mother_phone || '',
      parseFloat(zhongkao_score) || 0, notes || '',
      req.session.userId
    );

    res.json({ success: true });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '该身份证号码已存在' });
    }
    console.error(err);
    res.status(500).json({ error: '保存失败' });
  }
});

router.put('/api/students/:id', requireAuth, (req, res) => {
  try {
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
    if (!student) return res.status(404).json({ error: '记录不存在' });

    const {
      student_name, gender, ethnicity, admission_type,
      registered_address, home_address, id_number,
      middle_school, father_name, father_phone,
      mother_name, mother_phone, zhongkao_score, notes
    } = req.body;

    if (!student_name || !gender || !ethnicity || !admission_type || !id_number) {
      return res.status(400).json({ error: '请填写必填字段' });
    }

    if (id_number !== student.id_number) {
      const conflict = db.prepare('SELECT id FROM students WHERE id_number = ? AND id != ?').get(id_number, req.params.id);
      if (conflict) return res.status(400).json({ error: '该身份证号码已被其他学生使用' });
    }

    db.prepare(`
      UPDATE students SET
        student_name = ?, gender = ?, ethnicity = ?, admission_type = ?,
        registered_address = ?, home_address = ?, id_number = ?,
        middle_school = ?, father_name = ?, father_phone = ?,
        mother_name = ?, mother_phone = ?, zhongkao_score = ?,
        notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      student_name, gender, ethnicity, admission_type,
      registered_address || '', home_address || '',
      id_number, middle_school || '',
      father_name || '', father_phone || '',
      mother_name || '', mother_phone || '',
      parseFloat(zhongkao_score) || 0, notes || '',
      req.params.id
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '更新失败' });
  }
});

router.delete('/api/students/:id', requireAuth, (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ error: '记录不存在' });
  db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/api/students/export', requireAuth, (req, res) => {
  const students = db.prepare(`
    SELECT s.*, u.display_name as creator_name
    FROM students s
    LEFT JOIN users u ON s.created_by = u.id
    ORDER BY s.created_at DESC
  `).all();

  res.json(students);
});

module.exports = router;
