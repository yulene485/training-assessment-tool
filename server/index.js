/* ============================================================
   Express 服务器入口
   - 静态文件服务
   - RESTful API 路由
   - JWT 认证中间件
   - 文件上传
   ============================================================ */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const DB = require('./database');
const DingTalk = require('./dingtalk');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'etms_jwt_secret';
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- 中间件 ----------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// ---------- Multer 文件上传配置 ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ---------- JWT 认证中间件 ----------
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token 无效或已过期' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ error: '需要管理员权限' });
  next();
}
function superAdminOnly(req, res, next) {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: '需要总管理员权限' });
  next();
}

// ---------- 认证 API ----------
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = DB.findUser(username, password);
  if (!user) return res.status(401).json({ error: '用户名或密码错误' });

  const token = jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role, dept: user.dept },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  const { password: _, ...safe } = user;
  res.json({ token, user: safe });
});

// 钉钉扫码登录
app.post('/api/auth/dingtalk', async (req, res) => {
  try {
    const { authCode } = req.body;
    if (!authCode) return res.status(400).json({ error: '缺少 authCode' });

    const dtUser = await DingTalk.getUserByAuthCode(authCode);
    const user = await DingTalk.loginOrCreateUser(dtUser);

    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role, dept: user.dept },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    const { password: _, ...safe } = user;
    res.json({ token, user: safe });
  } catch (err) {
    console.error('钉钉登录失败:', err.message);
    res.status(500).json({ error: '钉钉登录失败: ' + err.message });
  }
});

app.get('/api/auth/me', auth, (req, res) => {
  const user = DB.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const { password: _, ...safe } = user;
  res.json(safe);
});

// 钉钉配置状态
app.get('/api/auth/dingtalk/status', (req, res) => {
  res.json({
    configured: DingTalk.isConfigured(),
    loginUrl: DingTalk.getLoginUrl(process.env.DINGTALK_CALLBACK_URL || ''),
    corpId: process.env.DINGTALK_CORP_ID || '',
    appKey: process.env.DINGTALK_APP_KEY || '',
  });
});

// ---------- 操作日志 API ----------
app.get('/api/logs', auth, superAdminOnly, (req, res) => res.json(DB.getLogs()));
app.post('/api/logs', auth, (req, res) => {
  const log = DB.addLog(req.user.id, req.user.name, req.body.action, req.body.target || '', req.body.detail || '');
  res.json(log);
});

// ---------- 钉钉部门同步 ----------
app.post('/api/dingtalk/sync-dept', auth, adminOnly, async (req, res) => {
  try {
    if (!DingTalk.isConfigured()) return res.status(400).json({ error: '钉钉未配置' });
    const synced = await DingTalk.syncDepartmentInfo();
    res.json({ ok: true, synced });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- 初始化数据（前端首次加载） ----------
app.get('/api/init', auth, (req, res) => {
  res.json({
    categories: DB.getCategories(),
    materials: DB.getMaterials(),
    questions: DB.getQuestions(),
    exams: DB.getExams(),
    records: DB.getRecords(),
    progress: DB.getProgress(),
    inprogress: DB.getInProgressByUser(req.user.id),
    users: (req.user.role === 'admin' || req.user.role === 'super_admin') ? DB.getUsers() : [],
    logs: req.user.role === 'super_admin' ? DB.getLogs() : [],
    dingtalk: { configured: DingTalk.isConfigured() },
  });
});

// ---------- 分类 API ----------
app.get('/api/categories', auth, (req, res) => res.json(DB.getCategories()));
app.post('/api/categories', auth, adminOnly, (req, res) => res.json(DB.addCategory(req.body)));
app.put('/api/categories/:id', auth, adminOnly, (req, res) => res.json(DB.updateCategory(req.params.id, req.body)));
app.delete('/api/categories/:id', auth, adminOnly, (req, res) => { DB.deleteCategory(req.params.id); res.json({ ok: true }); });

// ---------- 资料 API ----------
app.get('/api/materials', auth, (req, res) => res.json(DB.getMaterials()));
app.get('/api/materials/:id', auth, (req, res) => {
  const m = DB.getMaterialById(req.params.id);
  if (!m) return res.status(404).json({ error: '资料不存在' });
  res.json(m);
});

// 上传资料（multipart/form-data）
app.post('/api/materials', auth, adminOnly, upload.single('file'), (req, res) => {
  const data = {
    title: req.body.title,
    desc: req.body.desc || '',
    category_id: req.body.categoryId || req.body.category_id,
    type: req.body.type || 'doc',
    content: req.body.content || '',
    url: req.body.url || '',
    uploader: req.user.name,
  };
  if (req.file) {
    data.file_name = req.file.originalname;
    data.file_size = req.file.size;
    data.file_path = req.file.filename; // 服务器端存储的文件名
  }
  res.json(DB.addMaterial(data));
});

app.put('/api/materials/:id', auth, adminOnly, upload.single('file'), (req, res) => {
  const patch = {
    title: req.body.title,
    desc: req.body.desc,
    category_id: req.body.categoryId || req.body.category_id,
    type: req.body.type,
    content: req.body.content,
    url: req.body.url,
  };
  if (req.file) {
    patch.file_name = req.file.originalname;
    patch.file_size = req.file.size;
    patch.file_path = req.file.filename;
  }
  // 清理 undefined 值
  Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);
  res.json(DB.updateMaterial(req.params.id, patch));
});

app.delete('/api/materials/:id', auth, adminOnly, (req, res) => {
  const m = DB.getMaterialById(req.params.id);
  if (m && m.file_path) {
    const fp = path.join(UPLOAD_DIR, m.file_path);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  DB.deleteMaterial(req.params.id);
  res.json({ ok: true });
});

// 下载资料文件
app.get('/api/materials/:id/download', auth, (req, res) => {
  const m = DB.getMaterialById(req.params.id);
  if (!m) return res.status(404).json({ error: '资料不存在' });

  if (m.file_path) {
    const fp = path.join(UPLOAD_DIR, m.file_path);
    if (fs.existsSync(fp)) {
      res.download(fp, m.file_name || m.title);
      return;
    }
  }
  if (m.url) {
    return res.redirect(m.url);
  }
  res.status(404).json({ error: '文件不存在' });
});

// ---------- 题库 API ----------
app.get('/api/questions', auth, (req, res) => res.json(DB.getQuestions()));
app.get('/api/questions/:id', auth, (req, res) => {
  const q = DB.getQuestionById(req.params.id);
  if (!q) return res.status(404).json({ error: '题目不存在' });
  res.json(q);
});
app.post('/api/questions', auth, adminOnly, (req, res) => res.json(DB.addQuestion(req.body)));
app.put('/api/questions/:id', auth, adminOnly, (req, res) => res.json(DB.updateQuestion(req.params.id, req.body)));
app.delete('/api/questions/:id', auth, adminOnly, (req, res) => { DB.deleteQuestion(req.params.id); res.json({ ok: true }); });

// ---------- 考试 API ----------
app.get('/api/exams', auth, (req, res) => res.json(DB.getExams()));
app.get('/api/exams/:id', auth, (req, res) => {
  const e = DB.getExamById(req.params.id);
  if (!e) return res.status(404).json({ error: '考试不存在' });
  res.json(e);
});
app.post('/api/exams', auth, adminOnly, async (req, res) => {
  const exam = DB.addExam(req.body);
  // 钉钉通知
  try {
    if (DingTalk.isConfigured() && exam.status === 'active') {
      const employees = DB.getUsers().filter(u => u.role === 'employee');
      DingTalk.notifyExamCreated(exam, employees.map(u => u.id)).catch(e => console.error('钉钉通知失败:', e.message));
    }
  } catch (e) { /* 通知失败不影响创建 */ }
  res.json(exam);
});
app.put('/api/exams/:id', auth, adminOnly, (req, res) => res.json(DB.updateExam(req.params.id, req.body)));
app.delete('/api/exams/:id', auth, adminOnly, (req, res) => { DB.deleteExam(req.params.id); res.json({ ok: true }); });

// ---------- 考试记录 API ----------
app.get('/api/records', auth, (req, res) => {
  // 员工只能看自己的记录
  if (req.user.role === 'employee') return res.json(DB.getRecordsByUser(req.user.id));
  res.json(DB.getRecords());
});
app.get('/api/records/:id', auth, (req, res) => {
  const r = DB.getRecordById(req.params.id);
  if (!r) return res.status(404).json({ error: '记录不存在' });
  // 员工只能看自己的
  if (req.user.role === 'employee' && r.userId !== req.user.id) return res.status(403).json({ error: '无权查看' });
  res.json(r);
});
app.post('/api/records', auth, async (req, res) => {
  const record = DB.addRecord(req.body);
  // 钉钉成绩通知
  try {
    if (DingTalk.isConfigured()) {
      DingTalk.notifyExamResult(record).catch(e => console.error('钉钉成绩通知失败:', e.message));
    }
  } catch (e) { /* 通知失败不影响提交 */ }
  res.json(record);
});
app.delete('/api/records/:id', auth, adminOnly, (req, res) => { DB.deleteRecord(req.params.id); res.json({ ok: true }); });

// ---------- 用户 API ----------
app.get('/api/users', auth, adminOnly, (req, res) => res.json(DB.getUsers()));
app.post('/api/users', auth, adminOnly, (req, res) => res.json(DB.addUser(req.body)));
app.put('/api/users/:id', auth, adminOnly, (req, res) => res.json(DB.updateUser(req.params.id, req.body)));
app.delete('/api/users/:id', auth, adminOnly, (req, res) => { DB.deleteUser(req.params.id); res.json({ ok: true }); });

// ---------- 学习进度 API ----------
app.get('/api/progress', auth, (req, res) => res.json(DB.getProgressByUser(req.user.id)));
app.post('/api/progress', auth, (req, res) => {
  DB.upsertProgress({ ...req.body, userId: req.user.id });
  res.json({ ok: true });
});

// ---------- 断线续考 API ----------
app.get('/api/inprogress', auth, (req, res) => res.json(DB.getInProgressByUser(req.user.id)));
app.post('/api/inprogress', auth, (req, res) => {
  DB.saveInProgress({ ...req.body, userId: req.user.id });
  res.json({ ok: true });
});
app.delete('/api/inprogress/:examId', auth, (req, res) => {
  DB.removeInProgress(req.user.id, req.params.examId);
  res.json({ ok: true });
});

// ---------- 钉钉消息推送 API ----------
app.post('/api/dingtalk/notify', auth, adminOnly, async (req, res) => {
  try {
    const { userIds, message } = req.body;
    const taskId = await DingTalk.sendWorkNotification(userIds, message);
    res.json({ ok: true, taskId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- SPA 路由兜底 ----------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ---------- 启动 ----------
async function start() {
  await DB.initDB();
  app.listen(PORT, () => {
    console.log(`\n🚀 员工培训考核系统已启动`);
    console.log(`   本地访问: http://localhost:${PORT}`);
    console.log(`   钉钉集成: ${DingTalk.isConfigured() ? '✅ 已配置' : '⚠️ 未配置（参考 .env.example）'}\n`);
  });
}
start().catch(err => { console.error('启动失败:', err); process.exit(1); });
