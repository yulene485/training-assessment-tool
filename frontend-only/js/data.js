/* ============================================================
   数据层 - API 通信模式（跨设备同步版）
   - 所有数据存储在服务端数据库
   - 前端缓存 + 乐观更新 + fire-and-forget API 调用
   - JWT 认证
   - 支持三级角色：super_admin / admin / employee
   - 支持主观题、软删除、多附件、批量操作
   - 跨设备数据实时同步
   ============================================================ */

const DB = (() => {
  // API 基础 URL - 自动检测（同源或配置）
  const API_BASE = window.API_BASE || '';

  // 内存缓存
  let cache = {
    categories: [],
    materials: [],
    questions: [],
    exams: [],
    records: [],
    progress: [],
    inprogress: [],
    users: [],
    allUsers: [],
    allMaterials: [],
    allQuestions: [],
    allExams: [],
    logs: [],
    departments: [],
    admins: [],
  };

  // ---------- JWT Token 管理 ----------
  function getToken() {
    return localStorage.getItem('etms_token') || '';
  }
  function setToken(token) {
    localStorage.setItem('etms_token', token);
  }
  function clearToken() {
    localStorage.removeItem('etms_token');
    localStorage.removeItem('etms_session');
  }

  // ---------- API 请求封装 ----------
  async function api(method, url, body) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken(),
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API_BASE + url, opts);
    if (res.status === 401) {
      clearToken();
      if (App && App.render) App.render();
      throw new Error('未登录或登录已过期');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '请求失败' }));
      throw new Error(err.error || '请求失败');
    }
    return res.json();
  }

  // 乐观更新：先更新缓存，异步调 API，失败则 toast 提示
  function fireAndForget(method, url, body, errorMsg) {
    api(method, url, body).catch(err => {
      toast(errorMsg || err.message, 'error');
    });
  }

  // ---------- 初始化：从服务端加载全量数据 ----------
  async function init() {
    try {
      const data = await api('GET', '/api/init');
      // 将服务端 snake_case 字段转为前端 camelCase
      cache.categories = data.categories.map(mapCategory);
      cache.materials = (data.materials || []).map(mapMaterial);
      cache.questions = (data.questions || []).map(mapQuestion);
      cache.exams = (data.exams || []).map(mapExam);
      cache.records = (data.records || []).map(mapRecord);
      cache.progress = (data.progress || []).map(mapProgress);
      cache.inprogress = (data.inprogress || []).map(mapInProgress);
      cache.users = (data.users || []).map(mapUser);
      cache.allUsers = (data.allUsers || []).map(mapUser);
      cache.allMaterials = (data.allMaterials || []).map(mapMaterial);
      cache.allQuestions = (data.allQuestions || []).map(mapQuestion);
      cache.allExams = (data.allExams || []).map(mapExam);
      cache.logs = (data.logs || []).map(mapLog);
      cache.departments = data.departments || [];
      cache.admins = (data.admins || []).map(mapUser);
      return true;
    } catch (err) {
      toast('数据加载失败: ' + err.message, 'error');
      return false;
    }
  }

  // ---------- 字段映射（snake_case → camelCase） ----------
  function mapCategory(c) {
    return {
      id: c.id, name: c.name, icon: c.icon || '📁',
      sortOrder: c.sort_order || c.sortOrder || 0,
    };
  }
  function mapMaterial(m) {
    return {
      id: m.id, title: m.title, desc: m.desc || m.description || '',
      cover: m.cover || '', categoryId: m.category_id || m.categoryId,
      type: m.type, fileName: m.file_name || m.fileName || '',
      fileSize: m.file_size || m.fileSize || 0,
      filePath: m.file_path || m.filePath || '',
      url: m.url || '', content: m.content || '',
      attachments: m.attachments || [],
      uploader: m.uploader || '', deleted: !!m.deleted,
      deletedAt: m.deleted_at || m.deletedAt || null,
      createdAt: m.created_at || m.createdAt || 0,
    };
  }
  function mapQuestion(q) {
    return {
      id: q.id, type: q.type, stem: q.stem,
      options: q.options || [], answer: q.answer || [],
      score: q.score, analysis: q.analysis || '',
      referenceAnswer: q.referenceAnswer || q.reference_answer || '',
      categoryId: q.category_id || q.categoryId,
      deleted: !!q.deleted, deletedAt: q.deleted_at || q.deletedAt || null,
      createdAt: q.created_at || q.createdAt || 0,
    };
  }
  function mapExam(e) {
    return {
      id: e.id, title: e.title, desc: e.desc || e.description || '',
      categoryId: e.category_id || e.categoryId,
      questionIds: e.questionIds || e.question_ids || [],
      duration: e.duration, passScore: e.pass_score || e.passScore || 60,
      maxAttempts: e.max_attempts || e.maxAttempts || 3,
      randomOrder: !!e.randomOrder || !!e.random_order,
      totalScore: e.total_score || e.totalScore || 0,
      status: e.status, participants: e.participants || [],
      startTime: e.start_time || e.startTime || null,
      deadline: e.deadline || null,
      deleted: !!e.deleted, deletedAt: e.deleted_at || e.deletedAt || null,
      createdAt: e.created_at || e.createdAt || 0,
    };
  }
  function mapRecord(r) {
    return {
      id: r.id, examId: r.exam_id || r.examId,
      examTitle: r.exam_title || r.examTitle || '',
      userId: r.user_id || r.userId, userName: r.user_name || r.userName || '',
      dept: r.dept || '', score: r.score || 0,
      totalScore: r.total_score || r.totalScore || 0,
      passScore: r.pass_score || r.passScore || 60,
      passed: !!r.passed, answers: r.answers || {}, details: r.details || [],
      duration: r.duration || 0, startedAt: r.started_at || r.startedAt || 0,
      submittedAt: r.submitted_at || r.submittedAt || 0, attempt: r.attempt || 1,
      subjectiveGraded: !!r.subjective_graded || !!r.subjectiveGraded,
      subjectiveScore: r.subjective_score || r.subjectiveScore || 0,
    };
  }
  function mapProgress(p) {
    return {
      id: p.id, userId: p.user_id || p.userId,
      materialId: p.material_id || p.materialId,
      completed: !!p.completed, completedAt: p.completed_at || p.completedAt || 0,
      createdAt: p.created_at || p.createdAt || 0,
    };
  }
  function mapInProgress(ip) {
    return {
      id: ip.id, userId: ip.user_id || ip.userId,
      examId: ip.exam_id || ip.examId,
      answers: ip.answers || {}, remaining: ip.remaining || 0,
      startedAt: ip.started_at || ip.startedAt || 0, savedAt: ip.saved_at || ip.savedAt || 0,
    };
  }
  function mapUser(u) {
    return {
      id: u.id, username: u.username, name: u.name,
      role: u.role, dept: u.dept || '', scope: u.scope || '',
      jobNumber: u.job_number || u.jobNumber || '',
      position: u.position || '', status: u.status || 'active',
      createdAt: u.created_at || u.createdAt || 0,
    };
  }
  function mapLog(l) {
    return {
      id: l.id, userId: l.user_id || l.userId,
      userName: l.user_name || l.userName || '',
      action: l.action, target: l.target || '',
      detail: l.detail || '', createdAt: l.created_at || l.createdAt || 0,
    };
  }

  // ---------- 反向映射（camelCase → snake_case，用于发送到 API） ----------
  function toSnakeCase(obj) {
    const map = {
      categoryId: 'category_id', fileName: 'file_name', fileSize: 'file_size',
      filePath: 'file_path', referenceAnswer: 'reference_answer',
      questionIds: 'question_ids', passScore: 'pass_score',
      maxAttempts: 'max_attempts', randomOrder: 'random_order',
      totalScore: 'total_score', startTime: 'start_time',
      subjectiveGraded: 'subjective_graded', subjectiveScore: 'subjective_score',
      jobNumber: 'job_number', startedAt: 'started_at', submittedAt: 'submitted_at',
      examTitle: 'exam_title', userName: 'user_name',
      materialId: 'material_id', userId: 'user_id', completedAt: 'completed_at',
      sortOrder: 'sort_order',
    };
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
      result[map[key] || key] = val;
    }
    return result;
  }

  // ---------- 通用辅助 ----------
  function findById(arr, id) { return arr.find(x => x.id === id); }

  // ---------- 分类 ----------
  function getCategories() { return cache.categories; }
  function getCategoryById(id) { return findById(cache.categories, id); }
  function addCategory(c) {
    const mapped = toSnakeCase(c);
    mapped.id = mapped.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const local = mapCategory(mapped);
    cache.categories.push(local);
    fireAndForget('POST', '/api/categories', mapped, '添加分类失败');
    return local;
  }
  function updateCategory(id, p) {
    const i = cache.categories.findIndex(x => x.id === id);
    if (i !== -1) cache.categories[i] = { ...cache.categories[i], ...mapCategory(toSnakeCase(p)) };
    fireAndForget('PUT', '/api/categories/' + id, toSnakeCase(p), '更新分类失败');
    return cache.categories[i];
  }
  function deleteCategory(id) {
    cache.categories = cache.categories.filter(x => x.id !== id);
    fireAndForget('DELETE', '/api/categories/' + id, null, '删除分类失败');
  }

  // ---------- 资料（支持软删除 + attachments） ----------
  function getMaterials() { return cache.materials.filter(m => !m.deleted); }
  function getAllMaterials() { return cache.allMaterials.length > 0 ? cache.allMaterials : cache.materials; }
  function getMaterialById(id) { return findById(cache.materials, id) || findById(cache.allMaterials, id); }
  function getMaterialsByCategory(cid) { return cache.materials.filter(m => m.categoryId === cid && !m.deleted); }
  function addMaterial(m) {
    m.id = m.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    m.createdAt = m.createdAt || Date.now();
    m.deleted = false;
    m.attachments = m.attachments || [];
    const local = { ...m };
    cache.materials.push(local);
    fireAndForget('POST', '/api/materials', toSnakeCase(m), '添加资料失败');
    return local;
  }
  function updateMaterial(id, p) {
    const i = cache.materials.findIndex(x => x.id === id);
    if (i !== -1) cache.materials[i] = { ...cache.materials[i], ...p };
    fireAndForget('PUT', '/api/materials/' + id, toSnakeCase(p), '更新资料失败');
    return cache.materials[i];
  }
  function softDeleteMaterial(id) {
    const m = getMaterialById(id);
    if (m) { m.deleted = true; m.deletedAt = Date.now(); }
    fireAndForget('PATCH', '/api/materials/' + id + '/soft-delete', null, '删除资料失败');
  }
  function deleteMaterial(id) {
    cache.materials = cache.materials.filter(x => x.id !== id);
    fireAndForget('DELETE', '/api/materials/' + id, null, '删除资料失败');
  }

  // ---------- 题库（支持软删除 + 主观题） ----------
  function getQuestions() { return cache.questions.filter(q => !q.deleted); }
  function getAllQuestions() { return cache.allQuestions.length > 0 ? cache.allQuestions : cache.questions; }
  function getQuestionById(id) { return findById(cache.questions, id) || findById(cache.allQuestions, id); }
  function getQuestionsByCategory(cid) { return cache.questions.filter(q => q.categoryId === cid && !q.deleted); }
  function addQuestion(q) {
    q.id = q.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    q.createdAt = q.createdAt || Date.now();
    q.deleted = false;
    q.referenceAnswer = q.referenceAnswer || '';
    const local = { ...q };
    cache.questions.push(local);
    fireAndForget('POST', '/api/questions', toSnakeCase(q), '添加题目失败');
    return local;
  }
  function addQuestionsBatch(arr) {
    const locals = [];
    arr.forEach(q => {
      q.id = q.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      q.createdAt = q.createdAt || Date.now();
      q.deleted = false;
      q.referenceAnswer = q.referenceAnswer || '';
      const local = { ...q };
      cache.questions.push(local);
      locals.push(local);
    });
    fireAndForget('POST', '/api/questions/batch', arr.map(toSnakeCase), '批量导入题目失败');
    return locals;
  }
  function updateQuestion(id, p) {
    const i = cache.questions.findIndex(x => x.id === id);
    if (i !== -1) cache.questions[i] = { ...cache.questions[i], ...p };
    fireAndForget('PUT', '/api/questions/' + id, toSnakeCase(p), '更新题目失败');
    return cache.questions[i];
  }
  function deleteQuestion(id) {
    cache.questions = cache.questions.filter(x => x.id !== id);
    fireAndForget('DELETE', '/api/questions/' + id, null, '删除题目失败');
  }
  function softDeleteQuestion(id) {
    const q = getQuestionById(id);
    if (q) { q.deleted = true; q.deletedAt = Date.now(); }
    fireAndForget('PATCH', '/api/questions/' + id + '/soft-delete', null, '删除题目失败');
  }
  function softDeleteQuestionsBatch(ids) {
    ids.forEach(id => {
      const q = getQuestionById(id);
      if (q) { q.deleted = true; q.deletedAt = Date.now(); }
    });
    fireAndForget('POST', '/api/questions/batch-soft-delete', { ids }, '批量删除题目失败');
  }

  // ---------- 考试（支持软删除） ----------
  function getExams() { return cache.exams.filter(e => !e.deleted); }
  function getAllExams() { return cache.allExams.length > 0 ? cache.allExams : cache.exams; }
  function getExamById(id) { return findById(cache.exams, id) || findById(cache.allExams, id); }
  function getActiveExams() { return cache.exams.filter(e => (e.status === 'published' || e.status === 'active') && !e.deleted); }
  function getPublishedExams() { return getActiveExams(); }
  function getExamsForEmployee(uid) {
    return getPublishedExams().filter(e => {
      if (!e.participants || e.participants.length === 0) return true;
      return e.participants.includes(uid);
    });
  }
  function addExam(e) {
    e.id = e.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    e.createdAt = e.createdAt || Date.now();
    e.deleted = false;
    const local = { ...e };
    cache.exams.push(local);
    fireAndForget('POST', '/api/exams', toSnakeCase(e), '添加考试失败');
    return local;
  }
  function updateExam(id, p) {
    const i = cache.exams.findIndex(x => x.id === id);
    if (i !== -1) cache.exams[i] = { ...cache.exams[i], ...p };
    fireAndForget('PUT', '/api/exams/' + id, toSnakeCase(p), '更新考试失败');
    return cache.exams[i];
  }
  function deleteExam(id) {
    cache.exams = cache.exams.filter(x => x.id !== id);
    fireAndForget('DELETE', '/api/exams/' + id, null, '删除考试失败');
  }
  function softDeleteExam(id) {
    const e = getExamById(id);
    if (e) { e.deleted = true; e.deletedAt = Date.now(); }
    fireAndForget('PATCH', '/api/exams/' + id + '/soft-delete', null, '删除考试失败');
  }

  // ---------- 考试记录（支持主观题评分更新） ----------
  function getRecords() { return cache.records; }
  function getRecordById(id) { return findById(cache.records, id); }
  function getRecordsByUser(uid) { return cache.records.filter(r => r.userId === uid); }
  function getRecordsByExam(eid) { return cache.records.filter(r => r.examId === eid); }
  function addRecord(r) {
    r.id = r.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    r.subjectiveGraded = r.subjectiveGraded || false;
    r.subjectiveScore = r.subjectiveScore || 0;
    const local = { ...r };
    cache.records.push(local);
    fireAndForget('POST', '/api/records', toSnakeCase(r), '提交考试记录失败');
    return local;
  }
  function updateRecord(id, p) {
    const i = cache.records.findIndex(x => x.id === id);
    if (i !== -1) cache.records[i] = { ...cache.records[i], ...p };
    fireAndForget('PUT', '/api/records/' + id, toSnakeCase(p), '更新记录失败');
    return cache.records[i];
  }
  function deleteRecord(id) {
    cache.records = cache.records.filter(x => x.id !== id);
    fireAndForget('DELETE', '/api/records/' + id, null, '删除记录失败');
  }

  // ---------- 学习进度 ----------
  function getProgress() { return cache.progress; }
  function getProgressByUser(uid) { return cache.progress.filter(p => p.userId === uid); }
  function upsertProgress(p) {
    p.userId = p.userId || (App.currentUser ? App.currentUser.id : '');
    const i = cache.progress.findIndex(x => x.userId === p.userId && x.materialId === p.materialId);
    if (i !== -1) cache.progress[i] = { ...cache.progress[i], ...p };
    else { p.id = p.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7); p.createdAt = Date.now(); cache.progress.push(p); }
    fireAndForget('POST', '/api/progress', toSnakeCase(p), '保存进度失败');
  }

  // ---------- 断线续考 ----------
  function getInProgress(uid) { return cache.inprogress.filter(ip => ip.userId === uid); }
  function getInProgressByExam(uid, eid) { return cache.inprogress.find(ip => ip.userId === uid && ip.examId === eid); }
  function saveInProgress(ip) {
    ip.userId = ip.userId || (App.currentUser ? App.currentUser.id : '');
    const i = cache.inprogress.findIndex(x => x.userId === ip.userId && x.examId === ip.examId);
    if (i !== -1) cache.inprogress[i] = { ...cache.inprogress[i], ...ip };
    else { ip.id = ip.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7); ip.savedAt = Date.now(); cache.inprogress.push(ip); }
    fireAndForget('POST', '/api/inprogress', toSnakeCase(ip), '保存续考进度失败');
  }
  function removeInProgress(uid, eid) {
    cache.inprogress = cache.inprogress.filter(x => !(x.userId === uid && x.examId === eid));
    fireAndForget('DELETE', '/api/inprogress/' + eid, null, '清除续考进度失败');
  }

  // ---------- 用户（支持软删除） ----------
  function getUsers() { return cache.users.filter(u => u.status !== 'deleted'); }
  function getAllUsers() { return cache.allUsers.length > 0 ? cache.allUsers : cache.users; }
  function getUserById(id) { return findById(cache.users, id) || findById(cache.allUsers, id); }
  function addUser(u) {
    u.id = u.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    u.createdAt = u.createdAt || Date.now();
    const local = { ...u };
    cache.users.push(local);
    fireAndForget('POST', '/api/users', toSnakeCase(u), '添加用户失败');
    return local;
  }
  function updateUser(id, p) {
    const i = cache.users.findIndex(x => x.id === id);
    if (i !== -1) cache.users[i] = { ...cache.users[i], ...p };
    // Also update allUsers if present
    const j = cache.allUsers.findIndex(x => x.id === id);
    if (j !== -1) cache.allUsers[j] = { ...cache.allUsers[j], ...p };
    fireAndForget('PUT', '/api/users/' + id, toSnakeCase(p), '更新用户失败');
    return cache.users[i];
  }
  function deleteUser(id) {
    cache.users = cache.users.filter(x => x.id !== id);
    cache.allUsers = cache.allUsers.filter(x => x.id !== id);
    fireAndForget('DELETE', '/api/users/' + id, null, '删除用户失败');
  }
  function softDeleteUser(id) {
    const u = getUserById(id);
    if (u) { u.status = 'deleted'; }
    fireAndForget('PATCH', '/api/users/' + id + '/soft-delete', null, '删除用户失败');
  }
  function getDepartments() { return cache.departments; }
  function getAdmins() { return cache.admins; }

  // ---------- 操作日志 ----------
  function getLogs() { return cache.logs; }
  function addLog(action, target, detail) {
    const log = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      userId: App.currentUser ? App.currentUser.id : 'system',
      userName: App.currentUser ? App.currentUser.name : '系统',
      action, target: target || '', detail: detail || '',
      createdAt: Date.now(),
    };
    cache.logs.push(log);
    fireAndForget('POST', '/api/logs', toSnakeCase(log), '记录日志失败');
    return log;
  }

  // ---------- 会话 ----------
  function getSession() {
    const userStr = localStorage.getItem('etms_session');
    if (userStr) try { return JSON.parse(userStr); } catch {}
    return null;
  }
  function setSession(s) { localStorage.setItem('etms_session', JSON.stringify(s)); }
  function clearSession() { localStorage.removeItem('etms_session'); clearToken(); }

  // ---------- 重置 ----------
  function resetAll() {
    api('POST', '/api/reset', {}).then(() => init().then(() => App.render())).catch(err => toast(err.message, 'error'));
  }

  // ---------- 重新加载（从服务端刷新缓存） ----------
  async function reload() {
    return init();
  }

  return {
    init, getToken, setToken, clearToken,
    getCategories, getCategoryById, addCategory, updateCategory, deleteCategory,
    getMaterials, getAllMaterials, getMaterialById, getMaterialsByCategory, addMaterial, updateMaterial, softDeleteMaterial, deleteMaterial,
    getQuestions, getAllQuestions, getQuestionById, getQuestionsByCategory, addQuestion, addQuestionsBatch, updateQuestion, deleteQuestion, softDeleteQuestion, softDeleteQuestionsBatch,
    getExams, getAllExams, getExamById, getActiveExams, getPublishedExams, getExamsForEmployee, addExam, updateExam, deleteExam, softDeleteExam,
    getRecords, getRecordById, getRecordsByUser, getRecordsByExam, addRecord, updateRecord, deleteRecord,
    getProgress, getProgressByUser, upsertProgress,
    getInProgress, getInProgressByExam, saveInProgress, removeInProgress,
    getUsers, getAllUsers, getUserById, addUser, updateUser, deleteUser, softDeleteUser, getDepartments, getAdmins,
    getLogs, addLog,
    getSession, setSession, clearSession,
    resetAll, reload,
  };
})();
