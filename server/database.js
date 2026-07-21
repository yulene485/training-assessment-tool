/* ============================================================
   SQLite 数据库层（sql.js - WASM 实现，无需编译）
   - 三级角色：super_admin / admin / employee
   - 操作日志表
   - 考试支持参与人员、草稿/发布状态、时间设置
   - 钉钉用户自动注册与部门同步
   ============================================================ */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'etms.db');
let db = null;

// ---------- 初始化数据库 ----------
async function initDB() {
  const SQL = await initSqlJs();

  // 尝试加载已有数据库文件
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // 建表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      dept TEXT DEFAULT '',
      scope TEXT DEFAULT '',
      job_number TEXT DEFAULT '',
      position TEXT DEFAULT '',
      dingtalk_id TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '📁',
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      desc TEXT DEFAULT '',
      cover TEXT DEFAULT '',
      category_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'doc',
      file_name TEXT DEFAULT '',
      file_size INTEGER DEFAULT 0,
      file_path TEXT DEFAULT '',
      url TEXT DEFAULT '',
      content TEXT DEFAULT '',
      uploader TEXT DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      stem TEXT NOT NULL,
      options TEXT NOT NULL DEFAULT '[]',
      answer TEXT NOT NULL DEFAULT '[]',
      score INTEGER NOT NULL DEFAULT 10,
      analysis TEXT DEFAULT '',
      category_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      desc TEXT DEFAULT '',
      category_id TEXT NOT NULL,
      question_ids TEXT NOT NULL DEFAULT '[]',
      duration INTEGER NOT NULL DEFAULT 30,
      pass_score INTEGER NOT NULL DEFAULT 60,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      random_order INTEGER NOT NULL DEFAULT 0,
      total_score INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      participants TEXT DEFAULT '[]',
      start_time INTEGER DEFAULT NULL,
      deadline INTEGER DEFAULT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL,
      exam_title TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      dept TEXT DEFAULT '',
      score INTEGER NOT NULL DEFAULT 0,
      total_score INTEGER NOT NULL DEFAULT 0,
      pass_score INTEGER NOT NULL DEFAULT 60,
      passed INTEGER NOT NULL DEFAULT 0,
      answers TEXT DEFAULT '{}',
      details TEXT DEFAULT '[]',
      duration INTEGER DEFAULT 0,
      started_at INTEGER DEFAULT 0,
      submitted_at INTEGER NOT NULL,
      attempt INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      material_id TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inprogress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      exam_id TEXT NOT NULL,
      answers TEXT DEFAULT '{}',
      remaining INTEGER DEFAULT 0,
      started_at INTEGER DEFAULT 0,
      saved_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT DEFAULT '',
      detail TEXT DEFAULT '',
      created_at INTEGER NOT NULL
    );
  `);

  // 创建唯一约束
  try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_progress ON progress(user_id, material_id)'); } catch {}
  try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_inprogress ON inprogress(user_id, exam_id)'); } catch {}

  // 迁移旧数据：补充新字段
  try { db.exec('ALTER TABLE users ADD COLUMN scope TEXT DEFAULT \'\''); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN job_number TEXT DEFAULT \'\''); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN position TEXT DEFAULT \'\''); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN status TEXT DEFAULT \'active\''); } catch {}
  try { db.exec('ALTER TABLE materials ADD COLUMN cover TEXT DEFAULT \'\''); } catch {}
  try { db.exec('ALTER TABLE exams ADD COLUMN participants TEXT DEFAULT \'[]\''); } catch {}
  try { db.exec('ALTER TABLE exams ADD COLUMN start_time INTEGER DEFAULT NULL'); } catch {}
  try { db.exec('ALTER TABLE exams ADD COLUMN deadline INTEGER DEFAULT NULL'); } catch {}

  seed();
  save();
  return db;
}

// 保存数据库到文件
function save() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// ---------- 种子数据 ----------
function seed() {
  const result = db.exec('SELECT COUNT(*) as c FROM users');
  const count = result[0] ? result[0].values[0][0] : 0;
  if (count > 0) return;

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const now = Date.now();
  const hash = pwd => bcrypt.hashSync(pwd, 8);

  db.exec(`INSERT INTO users (id, username, password, name, role, dept, scope, job_number, position, created_at) VALUES ('u_super', 'superadmin', '${hash('super123')}', '总管理员', 'super_admin', '总管理部', 'all', 'SA001', '总管理员', ${now})`);
  db.exec(`INSERT INTO users (id, username, password, name, role, dept, scope, job_number, position, created_at) VALUES ('u_admin', 'admin', '${hash('admin123')}', '张主管', 'admin', '人力资源部', 'c1,c2', 'A001', '培训主管', ${now})`);
  db.exec(`INSERT INTO users (id, username, password, name, role, dept, job_number, position, created_at) VALUES ('u_e1', 'employee', '${hash('123456')}', '张明', 'employee', '研发部', 'E001', '前端工程师', ${now})`);
  db.exec(`INSERT INTO users (id, username, password, name, role, dept, job_number, position, created_at) VALUES ('u_e2', 'lina', '${hash('123456')}', '李娜', 'employee', '市场部', 'E002', '市场专员', ${now})`);
  db.exec(`INSERT INTO users (id, username, password, name, role, dept, job_number, position, created_at) VALUES ('u_e3', 'wangwu', '${hash('123456')}', '王五', 'employee', '研发部', 'E003', '后端工程师', ${now})`);

  db.exec(`INSERT INTO categories (id, name, icon) VALUES ('c1', '入职培训', '🎯')`);
  db.exec(`INSERT INTO categories (id, name, icon) VALUES ('c2', '安全规范', '🛡️')`);
  db.exec(`INSERT INTO categories (id, name, icon) VALUES ('c3', '产品知识', '📦')`);
  db.exec(`INSERT INTO categories (id, name, icon) VALUES ('c4', '技术培训', '💻')`);

  db.exec(`INSERT INTO materials (id, title, desc, category_id, type, file_name, file_size, content, uploader, created_at) VALUES ('m1', '新员工入职指南', '介绍公司文化、组织架构、规章制度等入职必读内容。', 'c1', 'doc', '新员工入职指南.docx', 1024000, '欢迎使用新员工入职指南。\\n\\n本指南涵盖：\\n1. 公司简介与发展历程\\n2. 组织架构与各部门职能\\n3. 员工行为规范\\n4. 薪酬福利体系\\n5. 晋升发展通道\\n\\n请仔细阅读并理解各项内容，这将帮助你快速融入团队。', '总管理员', ${now - 86400000 * 7})`);
  db.exec(`INSERT INTO materials (id, title, desc, category_id, type, file_name, file_size, content, uploader, created_at) VALUES ('m2', '信息安全管理制度', '公司信息安全管理规范，包括数据保护、密码策略等。', 'c2', 'pdf', '信息安全管理制度.pdf', 2048000, '信息安全管理制度\\n\\n一、数据保护原则\\n- 最小权限原则\\n- 数据分类分级管理\\n- 定期备份机制\\n\\n二、密码安全策略\\n- 密码长度不少于8位\\n- 包含大小写字母、数字、特殊字符\\n- 每90天更换一次\\n- 禁止使用弱密码\\n\\n三、终端安全\\n- 安装杀毒软件并定期更新\\n- 离开工位须锁屏\\n- 禁止安装未经审批的软件', '总管理员', ${now - 86400000 * 5})`);
  db.exec(`INSERT INTO materials (id, title, desc, category_id, type, file_name, file_size, url, content, uploader, created_at) VALUES ('m3', '产品功能演示视频', '公司核心产品的功能介绍与操作演示。', 'c3', 'video', '产品演示.mp4', 51200000, 'https://www.w3schools.com/html/mov_bbb.mp4', '', '总管理员', ${now - 86400000 * 3})`);
  db.exec(`INSERT INTO materials (id, title, desc, category_id, type, file_name, file_size, content, uploader, created_at) VALUES ('m4', '前端开发规范', '团队前端代码规范与最佳实践。', 'c4', 'doc', '前端开发规范.docx', 8192000, '前端开发规范\\n\\n一、命名规范\\n- 组件名使用 PascalCase\\n- 变量名使用 camelCase\\n- 常量名使用 UPPER_SNAKE_CASE\\n\\n二、代码结构\\n- 单文件不超过 300 行\\n- 函数单一职责\\n- 必要的注释\\n\\n三、Git 提交规范\\n- feat: 新功能\\n- fix: 修复 bug\\n- docs: 文档变更\\n- refactor: 重构', '总管理员', ${now - 86400000 * 2})`);

  const J = v => JSON.stringify(v);
  db.exec(`INSERT INTO questions (id, type, stem, options, answer, score, analysis, category_id, created_at) VALUES ('q1', 'single', '公司员工行为规范中，下列哪项是正确的？', '${J(['可以随意泄露公司机密', '离职后可带走公司数据', '遵守保密协议，保护公司信息', '可在社交媒体随意发表公司内部信息'])}', '${J([2])}', 10, '员工应严格遵守保密协议，保护公司信息资产安全。', 'c2', ${now})`);
  db.exec(`INSERT INTO questions (id, type, stem, options, answer, score, analysis, category_id, created_at) VALUES ('q2', 'single', '公司密码安全策略要求密码长度不少于多少位？', '${J(['6位', '8位', '10位', '12位'])}', '${J([1])}', 10, '根据信息安全管理制度，密码长度不少于8位。', 'c2', ${now})`);
  db.exec(`INSERT INTO questions (id, type, stem, options, answer, score, analysis, category_id, created_at) VALUES ('q3', 'multiple', '以下哪些属于强密码的特征？（多选）', '${J(['包含大小写字母', '包含数字', '包含特殊字符', '使用生日或姓名'])}', '${J([0, 1, 2])}', 15, '强密码应包含大小写字母、数字和特殊字符，不应使用生日等易猜信息。', 'c2', ${now})`);
  db.exec(`INSERT INTO questions (id, type, stem, options, answer, score, analysis, category_id, created_at) VALUES ('q4', 'judge', '员工离开工位时必须锁屏。', '${J(['正确', '错误'])}', '${J([0])}', 5, '离开工位锁屏是基本的信息安全要求。', 'c2', ${now})`);
  db.exec(`INSERT INTO questions (id, type, stem, options, answer, score, analysis, category_id, created_at) VALUES ('q5', 'single', '前端组件命名应使用哪种命名法？', '${J(['kebab-case', 'PascalCase', 'camelCase', 'snake_case'])}', '${J([1])}', 10, '根据前端开发规范，组件名使用 PascalCase。', 'c4', ${now})`);
  db.exec(`INSERT INTO questions (id, type, stem, options, answer, score, analysis, category_id, created_at) VALUES ('q6', 'multiple', '以下哪些是 Git 提交规范的前缀？（多选）', '${J(['feat', 'fix', 'docs', 'random'])}', '${J([0, 1, 2])}', 15, '规范的前缀包括 feat、fix、docs、refactor 等。', 'c4', ${now})`);
  db.exec(`INSERT INTO questions (id, type, stem, options, answer, score, analysis, category_id, created_at) VALUES ('q7', 'judge', '单文件代码可以超过 300 行，无需拆分。', '${J(['正确', '错误'])}', '${J([1])}', 5, '规范要求单文件不超过 300 行。', 'c4', ${now})`);
  db.exec(`INSERT INTO questions (id, type, stem, options, answer, score, analysis, category_id, created_at) VALUES ('q8', 'single', '新员工入职指南中不包括以下哪项内容？', '${J(['公司简介', '组织架构', '个人家庭信息', '薪酬福利'])}', '${J([2])}', 10, '入职指南涵盖公司简介、组织架构、行为规范、薪酬福利等，不涉及个人家庭信息。', 'c1', ${now})`);
  db.exec(`INSERT INTO questions (id, type, stem, options, answer, score, analysis, category_id, created_at) VALUES ('q9', 'multiple', '信息安全管理遵循的原则包括？（多选）', '${J(['最小权限原则', '数据分类分级管理', '定期备份机制', '随意共享数据'])}', '${J([0, 1, 2])}', 15, '信息安全应遵循最小权限、分类分级、定期备份等原则。', 'c2', ${now})`);
  db.exec(`INSERT INTO questions (id, type, stem, options, answer, score, analysis, category_id, created_at) VALUES ('q10', 'judge', '员工可以在工作电脑上安装任何来源的软件。', '${J(['正确', '错误'])}', '${J([1])}', 5, '禁止安装未经审批的软件。', 'c2', ${now})`);

  db.exec(`INSERT INTO exams (id, title, desc, category_id, question_ids, duration, pass_score, max_attempts, random_order, total_score, status, participants, start_time, deadline, created_at) VALUES ('ex1', '信息安全基础考核', '检验员工对信息安全管理制度的掌握程度。', 'c2', '${J(['q1','q2','q3','q4','q9','q10'])}', 20, 60, 3, 1, 70, 'published', '${J(['u_e1','u_e2','u_e3'])}', ${now - 86400000 * 10}, ${now + 86400000 * 30}, ${now})`);
  db.exec(`INSERT INTO exams (id, title, desc, category_id, question_ids, duration, pass_score, max_attempts, random_order, total_score, status, participants, start_time, deadline, created_at) VALUES ('ex2', '前端开发规范考核', '测试团队前端开发规范掌握情况。', 'c4', '${J(['q5','q6','q7'])}', 10, 60, 2, 0, 30, 'published', '${J(['u_e1'])}', ${now - 86400000 * 5}, ${now + 86400000 * 30}, ${now})`);
  db.exec(`INSERT INTO exams (id, title, desc, category_id, question_ids, duration, pass_score, max_attempts, random_order, total_score, status, participants, created_at) VALUES ('ex3', '新员工入职考核', '新员工入职培训综合考核。', 'c1', '${J(['q8'])}', 10, 60, 1, 0, 10, 'draft', '${J([])}', ${now})`);

  db.exec(`INSERT INTO records (id, exam_id, exam_title, user_id, user_name, dept, score, total_score, pass_score, passed, duration, submitted_at, attempt) VALUES ('r1', 'ex1', '信息安全基础考核', 'u_e1', '张明', '研发部', 85, 70, 60, 1, 980000, ${now - 86400000 * 3 + 980000}, 1)`);
  db.exec(`INSERT INTO records (id, exam_id, exam_title, user_id, user_name, dept, score, total_score, pass_score, passed, duration, submitted_at, attempt) VALUES ('r2', 'ex1', '信息安全基础考核', 'u_e2', '李娜', '市场部', 55, 70, 60, 0, 1200000, ${now - 86400000 * 2 + 1200000}, 1)`);
  db.exec(`INSERT INTO records (id, exam_id, exam_title, user_id, user_name, dept, score, total_score, pass_score, passed, duration, submitted_at, attempt) VALUES ('r3', 'ex2', '前端开发规范考核', 'u_e1', '张明', '研发部', 30, 30, 60, 1, 420000, ${now - 86400000 + 420000}, 1)`);
  db.exec(`INSERT INTO records (id, exam_id, exam_title, user_id, user_name, dept, score, total_score, pass_score, passed, duration, submitted_at, attempt) VALUES ('r4', 'ex1', '信息安全基础考核', 'u_e3', '王五', '研发部', 70, 70, 60, 1, 760000, ${now - 86400000 + 760000}, 1)`);
  db.exec(`INSERT INTO records (id, exam_id, exam_title, user_id, user_name, dept, score, total_score, pass_score, passed, duration, submitted_at, attempt) VALUES ('r5', 'ex3', '新员工入职考核', 'u_e2', '李娜', '市场部', 10, 10, 60, 1, 180000, ${now - 3600000 + 180000}, 1)`);
}

// ---------- 通用查询 ----------
function all(table) {
  const results = db.exec(`SELECT * FROM ${table}`);
  if (!results[0]) return [];
  const cols = results[0].columns;
  return results[0].values.map(row => {
    const obj = {};
    cols.forEach((c, i) => obj[c] = row[i]);
    return obj;
  });
}

function get(table, id) {
  const results = db.exec(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  if (!results[0] || !results[0].values[0]) return null;
  const cols = results[0].columns;
  const obj = {};
  cols.forEach((c, i) => obj[c] = results[0].values[0][i]);
  return obj;
}

function insert(table, row) {
  const cols = Object.keys(row);
  const vals = Object.values(row);
  const placeholders = cols.map(() => '?').join(', ');
  db.exec(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`, vals);
  save();
  return get(table, row.id);
}

function update(table, id, patch) {
  const sets = Object.keys(patch).map(k => `${k} = ?`).join(', ');
  db.exec(`UPDATE ${table} SET ${sets} WHERE id = ?`, [...Object.values(patch), id]);
  save();
  return get(table, id);
}

function del(table, id) {
  db.exec(`DELETE FROM ${table} WHERE id = ?`, [id]);
  save();
}

// ---------- JSON 字段辅助 ----------
function parseJSON(field) {
  try { return JSON.parse(field || '[]'); } catch { return []; }
}

// ---------- 业务封装 ----------
module.exports = {
  db, initDB, save,
  // 用户
  getUsers: () => all('users').map(u => ({ ...u, password: undefined })),
  getUserById: id => { const u = get('users', id); return u ? { ...u, password: undefined } : null; },
  getUserByIdWithPassword: id => get('users', id), // 含密码（登录用）
  getAdmins: () => all('users').filter(u => u.role === 'admin').map(u => ({ ...u, password: undefined })),
  getDepartments: () => [...new Set(all('users').map(u => u.dept).filter(Boolean))],
  findUser: (username, password) => {
    const results = db.exec(`SELECT * FROM users WHERE username = ?`, [username]);
    if (!results[0] || !results[0].values[0]) return null;
    const cols = results[0].columns;
    const u = {};
    cols.forEach((c, i) => u[c] = results[0].values[0][i]);
    if (u.status === 'disabled') return null; // 停用账号不可登录
    return bcrypt.compareSync(password, u.password) ? { ...u, password: undefined } : null;
  },
  findUserByDingtalkId: dtid => {
    const results = db.exec(`SELECT * FROM users WHERE dingtalk_id = ?`, [dtid]);
    if (!results[0] || !results[0].values[0]) return null;
    const cols = results[0].columns;
    const u = {};
    cols.forEach((c, i) => u[c] = results[0].values[0][i]);
    return { ...u, password: undefined };
  },
  addUser: u => { u.id = u.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7); u.password = bcrypt.hashSync(u.password || '123456', 8); u.created_at = u.created_at || Date.now(); return insert('users', u); },
  updateUser: (id, p) => { if (p.password) p.password = bcrypt.hashSync(p.password, 8); return update('users', id, p); },
  deleteUser: id => del('users', id),
  // 分类
  getCategories: () => all('categories'),
  getCategoryById: id => get('categories', id),
  addCategory: c => { c.id = c.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7); return insert('categories', c); },
  updateCategory: (id, p) => update('categories', id, p),
  deleteCategory: id => del('categories', id),
  // 资料
  getMaterials: () => all('materials'),
  getMaterialById: id => get('materials', id),
  getMaterialsByCategory: cid => {
    const results = db.exec(`SELECT * FROM materials WHERE category_id = ?`, [cid]);
    if (!results[0]) return [];
    const cols = results[0].columns;
    return results[0].values.map(row => { const obj = {}; cols.forEach((c, i) => obj[c] = row[i]); return obj; });
  },
  addMaterial: m => { m.id = m.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7); m.created_at = m.created_at || Date.now(); return insert('materials', m); },
  updateMaterial: (id, p) => update('materials', id, p),
  deleteMaterial: id => del('materials', id),
  // 题库
  getQuestions: () => all('questions').map(q => ({ ...q, options: parseJSON(q.options), answer: parseJSON(q.answer) })),
  getQuestionById: id => { const q = get('questions', id); return q ? { ...q, options: parseJSON(q.options), answer: parseJSON(q.answer) } : null; },
  getQuestionsByCategory: cid => {
    const rows = all('questions').filter(q => q.category_id === cid);
    return rows.map(q => ({ ...q, options: parseJSON(q.options), answer: parseJSON(q.answer) }));
  },
  addQuestion: q => { q.id = q.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7); q.options = JSON.stringify(q.options || []); q.answer = JSON.stringify(q.answer || []); q.created_at = q.created_at || Date.now(); return insert('questions', q); },
  updateQuestion: (id, p) => { if (p.options) p.options = JSON.stringify(p.options); if (p.answer) p.answer = JSON.stringify(p.answer); return update('questions', id, p); },
  deleteQuestion: id => del('questions', id),
  // 考试
  getExams: () => all('exams').map(e => ({ ...e, questionIds: parseJSON(e.question_ids), randomOrder: !!e.random_order, participants: parseJSON(e.participants) })),
  getExamById: id => { const e = get('exams', id); return e ? { ...e, questionIds: parseJSON(e.question_ids), randomOrder: !!e.random_order, participants: parseJSON(e.participants) } : null; },
  getActiveExams: () => all('exams').filter(e => e.status === 'published' || e.status === 'active').map(e => ({ ...e, questionIds: parseJSON(e.question_ids), randomOrder: !!e.random_order, participants: parseJSON(e.participants) })),
  getPublishedExams: () => all('exams').filter(e => e.status === 'published' || e.status === 'active').map(e => ({ ...e, questionIds: parseJSON(e.question_ids), randomOrder: !!e.random_order, participants: parseJSON(e.participants) })),
  getExamsForEmployee: uid => all('exams').filter(e => (e.status === 'published' || e.status === 'active') && (!parseJSON(e.participants).length || parseJSON(e.participants).includes(uid))).map(e => ({ ...e, questionIds: parseJSON(e.question_ids), randomOrder: !!e.random_order, participants: parseJSON(e.participants) })),
  addExam: e => { e.id = e.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7); e.question_ids = JSON.stringify(e.questionIds || e.question_ids || []); if (e.participants) e.participants = JSON.stringify(e.participants); e.created_at = e.created_at || Date.now(); return insert('exams', e); },
  updateExam: (id, p) => { if (p.questionIds) p.question_ids = JSON.stringify(p.questionIds); if (p.randomOrder !== undefined) p.random_order = p.randomOrder ? 1 : 0; if (p.participants) p.participants = JSON.stringify(p.participants); return update('exams', id, p); },
  deleteExam: id => del('exams', id),
  // 考试记录
  getRecords: () => all('records').map(r => ({ ...r, answers: parseJSON(r.answers), details: parseJSON(r.details), passed: !!r.passed })),
  getRecordById: id => { const r = get('records', id); return r ? { ...r, answers: parseJSON(r.answers), details: parseJSON(r.details), passed: !!r.passed } : null; },
  getRecordsByUser: uid => all('records').filter(r => r.user_id === uid).map(r => ({ ...r, answers: parseJSON(r.answers), details: parseJSON(r.details), passed: !!r.passed })),
  getRecordsByExam: eid => all('records').filter(r => r.exam_id === eid).map(r => ({ ...r, answers: parseJSON(r.answers), details: parseJSON(r.details), passed: !!r.passed })),
  addRecord: r => { r.id = r.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7); r.answers = JSON.stringify(r.answers || {}); r.details = JSON.stringify(r.details || []); r.passed = r.passed ? 1 : 0; r.submitted_at = r.submitted_at || Date.now(); r.created_at = r.created_at || Date.now(); return insert('records', r); },
  deleteRecord: id => del('records', id),
  // 学习进度
  getProgress: () => all('progress').map(p => ({ ...p, completed: !!p.completed })),
  getProgressByUser: uid => all('progress').filter(p => p.user_id === uid).map(p => ({ ...p, completed: !!p.completed })),
  upsertProgress: p => {
    const results = db.exec(`SELECT * FROM progress WHERE user_id = ? AND material_id = ?`, [p.userId || p.user_id, p.materialId || p.material_id]);
    if (results[0] && results[0].values[0]) {
      const cols = results[0].columns;
      const existing = {};
      cols.forEach((c, i) => existing[c] = results[0].values[0][i]);
      update('progress', existing.id, { completed: p.completed ? 1 : 0, completed_at: p.completedAt || p.completed_at || Date.now() });
    } else {
      p.id = p.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      p.user_id = p.userId || p.user_id;
      p.material_id = p.materialId || p.material_id;
      p.completed = p.completed ? 1 : 0;
      p.completed_at = p.completedAt || p.completed_at || Date.now();
      p.created_at = p.created_at || Date.now();
      insert('progress', p);
    }
  },
  // 断线续考
  getInProgressByUser: uid => all('inprogress').filter(ip => ip.user_id === uid).map(ip => ({ ...ip, answers: parseJSON(ip.answers) })),
  getInProgressByExam: (uid, eid) => {
    const results = db.exec(`SELECT * FROM inprogress WHERE user_id = ? AND exam_id = ?`, [uid, eid]);
    if (!results[0] || !results[0].values[0]) return null;
    const cols = results[0].columns;
    const ip = {};
    cols.forEach((c, i) => ip[c] = results[0].values[0][i]);
    return { ...ip, answers: parseJSON(ip.answers) };
  },
  saveInProgress: ip => {
    ip.answers = JSON.stringify(ip.answers || {});
    ip.user_id = ip.userId || ip.user_id;
    ip.exam_id = ip.examId || ip.exam_id;
    const results = db.exec(`SELECT * FROM inprogress WHERE user_id = ? AND exam_id = ?`, [ip.user_id, ip.exam_id]);
    if (results[0] && results[0].values[0]) {
      const cols = results[0].columns;
      const existing = {};
      cols.forEach((c, i) => existing[c] = results[0].values[0][i]);
      update('inprogress', existing.id, { answers: ip.answers, remaining: ip.remaining, saved_at: Date.now() });
    } else {
      ip.id = ip.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      ip.saved_at = Date.now();
      insert('inprogress', ip);
    }
  },
  removeInProgress: (uid, eid) => { db.exec(`DELETE FROM inprogress WHERE user_id = ? AND exam_id = ?`, [uid, eid]); save(); },
  // 操作日志
  getLogs: () => all('logs').sort((a, b) => b.created_at - a.created_at),
  addLog: (userId, userName, action, target, detail) => {
    const log = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      user_id: userId,
      user_name: userName,
      action,
      target: target || '',
      detail: detail || '',
      created_at: Date.now(),
    };
    insert('logs', log);
    return log;
  },
  // 重置
  resetAll: () => {
    ['logs','records','progress','inprogress','exams','questions','materials','categories','users'].forEach(t => db.exec(`DELETE FROM ${t}`));
    seed();
    save();
  },
};
