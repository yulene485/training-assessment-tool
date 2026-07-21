/* ============================================================
   数据层 - API 通信 + 内存缓存（乐观更新模式）
   - 初始化：从服务器一次性加载数据到内存
   - 读取：从缓存（同步），与其他前端文件完全兼容
   - 写入：同步更新缓存 + 异步调 API（fire-and-forget）
     → UI 立即反映变化，API 失败时 toast 错误并回滚
   ============================================================ */

const DB = (() => {
  let cache = {
    categories: [], materials: [], questions: [], exams: [],
    records: [], progress: [], inprogress: [], users: [],
  };
  let _loaded = false;

  // ---------- API 工具 ----------
  function getToken() { return localStorage.getItem('etms_token') || ''; }
  function authHeaders() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() }; }

  async function api(method, path, body) {
    const opts = { method, headers: authHeaders() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch('/api' + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '请求失败');
    return data;
  }

  // Fire-and-forget：异步调 API，失败时 toast 错误
  function fireAndForget(promise, rollback) {
    promise.catch(e => {
      toast('数据保存失败: ' + e.message, 'error');
      if (rollback) rollback();
    });
  }

  // uid 生成
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // 规范化字段名（后端 snake_case → 前端 camelCase）
  function norm(m) {
    if (!m) return m;
    return {
      ...m,
      categoryId: m.categoryId || m.category_id,
      fileName: m.fileName || m.file_name,
      fileSize: m.fileSize || m.file_size,
      filePath: m.filePath || m.file_path,
      createdAt: m.createdAt || m.created_at,
    };
  }
  function normArr(arr) { return arr.map(norm); }

  // ---------- 初始化 ----------
  async function init() {
    if (_loaded) return;
    const data = await api('GET', '/init');
    cache.categories = data.categories || [];
    cache.materials = normArr(data.materials || []);
    cache.questions = normArr(data.questions || []);
    cache.exams = (data.exams || []).map(e => ({
      ...e, questionIds: e.questionIds || e.question_ids, randomOrder: e.randomOrder || !!e.random_order,
      categoryId: e.categoryId || e.category_id, createdAt: e.createdAt || e.created_at,
    }));
    cache.records = (data.records || []).map(r => ({ ...r, passed: !!r.passed, userId: r.userId || r.user_id }));
    cache.progress = (data.progress || []).map(p => ({ ...p, completed: !!p.completed, userId: p.userId || p.user_id }));
    cache.inprogress = (data.inprogress || []).map(ip => ({ ...ip, userId: ip.userId || ip.user_id }));
    cache.users = (data.users || []).map(u => ({ ...u, createdAt: u.createdAt || u.created_at }));
    _loaded = true;
  }

  // ---------- 同步读取（从缓存） ----------
  function getCategories() { return cache.categories; }
  function getCategoryById(id) { return cache.categories.find(c => c.id === id); }
  function getMaterials() { return cache.materials; }
  function getMaterialById(id) { return cache.materials.find(m => m.id === id); }
  function getMaterialsByCategory(cid) { return cache.materials.filter(m => (m.categoryId || m.category_id) === cid); }
  function getQuestions() { return cache.questions; }
  function getQuestionById(id) { return cache.questions.find(q => q.id === id); }
  function getQuestionsByCategory(cid) { return cache.questions.filter(q => (q.categoryId || q.category_id) === cid); }
  function getExams() { return cache.exams; }
  function getExamById(id) { return cache.exams.find(e => e.id === id); }
  function getActiveExams() { return cache.exams.filter(e => e.status === 'active'); }
  function getRecords() { return cache.records; }
  function getRecordById(id) { return cache.records.find(r => r.id === id); }
  function getRecordsByUser(uid) { return cache.records.filter(r => (r.userId || r.user_id) === uid); }
  function getRecordsByExam(eid) { return cache.records.filter(r => r.examId === eid); }
  function getProgress() { return cache.progress; }
  function getProgressByUser(uid) { return cache.progress.filter(p => (p.userId || p.user_id) === uid); }
  function getInProgress(uid) { return cache.inprogress.filter(ip => (ip.userId || ip.user_id) === uid); }
  function getInProgressByExam(uid, eid) { return cache.inprogress.find(ip => (ip.userId || ip.user_id) === uid && ip.examId === eid); }
  function getUsers() { return cache.users; }
  function getUserById(id) { return cache.users.find(u => u.id === id); }

  // ---------- 写入（乐观更新：同步更新缓存 + 异步调 API） ----------

  // 分类
  function addCategory(c) {
    c.id = c.id || uid();
    cache.categories.push(c);
    fireAndForget(api('POST', '/categories', c), () => { cache.categories = cache.categories.filter(x => x.id !== c.id); });
    return c;
  }
  function updateCategory(id, p) {
    const i = cache.categories.findIndex(x => x.id === id);
    const old = i !== -1 ? { ...cache.categories[i] } : null;
    if (i !== -1) cache.categories[i] = { ...cache.categories[i], ...p };
    fireAndForget(api('PUT', '/categories/' + id, p), () => { if (old && i !== -1) cache.categories[i] = old; });
    return cache.categories[i];
  }
  function deleteCategory(id) {
    const old = cache.categories.find(x => x.id === id);
    cache.categories = cache.categories.filter(x => x.id !== id);
    fireAndForget(api('DELETE', '/categories/' + id), () => { if (old) cache.categories.push(old); });
  }

  // 资料（特殊处理：支持文件上传 FormData）
  function addMaterial(m) {
    m.id = m.id || uid();
    m.createdAt = m.createdAt || Date.now();
    // 规范化字段名
    const normalized = norm(m);
    cache.materials.push(normalized);

    // 如果有文件（_file 是原始 File 对象），用 FormData 上传
    if (m._file) {
      const fd = new FormData();
      fd.append('title', m.title || '');
      fd.append('desc', m.desc || '');
      fd.append('categoryId', m.categoryId || m.category_id || '');
      fd.append('type', m.type || 'doc');
      fd.append('content', m.content || '');
      fd.append('url', m.url || '');
      fd.append('file', m._file);

      fireAndForget(
        fetch('/api/materials', { method: 'POST', headers: { 'Authorization': 'Bearer ' + getToken() }, body: fd })
          .then(res => res.json()).then(r => { if (r.error) throw new Error(r.error); const idx = cache.materials.findIndex(x => x.id === m.id); if (idx !== -1) cache.materials[idx] = norm(r); }),
        () => { cache.materials = cache.materials.filter(x => x.id !== m.id); }
      );
    } else {
      fireAndForget(api('POST', '/materials', normalized), () => { cache.materials = cache.materials.filter(x => x.id !== m.id); });
    }
    return normalized;
  }

  function updateMaterial(id, p) {
    const i = cache.materials.findIndex(x => x.id === id);
    const old = i !== -1 ? { ...cache.materials[i] } : null;
    const normalized = norm(p);
    if (i !== -1) cache.materials[i] = { ...cache.materials[i], ...normalized };

    if (p._file) {
      const fd = new FormData();
      if (p.title) fd.append('title', p.title);
      if (p.desc) fd.append('desc', p.desc);
      fd.append('categoryId', p.categoryId || p.category_id || cache.materials[i]?.categoryId || '');
      if (p.type) fd.append('type', p.type);
      if (p.content) fd.append('content', p.content);
      if (p.url) fd.append('url', p.url);
      fd.append('file', p._file);

      fireAndForget(
        fetch('/api/materials/' + id, { method: 'PUT', headers: { 'Authorization': 'Bearer ' + getToken() }, body: fd })
          .then(res => res.json()).then(r => { if (r.error) throw new Error(r.error); const idx = cache.materials.findIndex(x => x.id === id); if (idx !== -1) cache.materials[idx] = norm({ ...cache.materials[idx], ...r }); }),
        () => { if (old && i !== -1) cache.materials[i] = old; }
      );
    } else {
      fireAndForget(api('PUT', '/materials/' + id, normalized), () => { if (old && i !== -1) cache.materials[i] = old; });
    }
    return cache.materials[i];
  }

  function deleteMaterial(id) {
    const old = cache.materials.find(x => x.id === id);
    cache.materials = cache.materials.filter(x => x.id !== id);
    fireAndForget(api('DELETE', '/materials/' + id), () => { if (old) cache.materials.push(old); });
  }

  // 题库
  function addQuestion(q) {
    q.id = q.id || uid();
    q.createdAt = q.createdAt || Date.now();
    cache.questions.push(q);
    fireAndForget(api('POST', '/questions', q), () => { cache.questions = cache.questions.filter(x => x.id !== q.id); });
    return q;
  }
  function updateQuestion(id, p) {
    const i = cache.questions.findIndex(x => x.id === id);
    const old = i !== -1 ? { ...cache.questions[i] } : null;
    if (i !== -1) cache.questions[i] = { ...cache.questions[i], ...p };
    fireAndForget(api('PUT', '/questions/' + id, p), () => { if (old && i !== -1) cache.questions[i] = old; });
    return cache.questions[i];
  }
  function deleteQuestion(id) {
    const old = cache.questions.find(x => x.id === id);
    cache.questions = cache.questions.filter(x => x.id !== id);
    fireAndForget(api('DELETE', '/questions/' + id), () => { if (old) cache.questions.push(old); });
  }

  // 考试
  function addExam(e) {
    e.id = e.id || uid();
    e.createdAt = e.createdAt || Date.now();
    if (e.questionIds && !e.question_ids) e.question_ids = e.questionIds;
    cache.exams.push({ ...e, questionIds: e.questionIds || e.question_ids, randomOrder: e.randomOrder || !!e.random_order });
    fireAndForget(api('POST', '/exams', e).then(r => { const idx = cache.exams.findIndex(x => x.id === e.id); if (idx !== -1) cache.exams[idx] = { ...cache.exams[idx], ...r, questionIds: r.questionIds || r.question_ids, randomOrder: r.randomOrder || !!r.random_order }; }), () => { cache.exams = cache.exams.filter(x => x.id !== e.id); });
    return e;
  }
  function updateExam(id, p) {
    const i = cache.exams.findIndex(x => x.id === id);
    const old = i !== -1 ? { ...cache.exams[i] } : null;
    if (i !== -1) cache.exams[i] = { ...cache.exams[i], ...p, questionIds: p.questionIds || p.question_ids, randomOrder: p.randomOrder || !!p.random_order };
    fireAndForget(api('PUT', '/exams/' + id, p), () => { if (old && i !== -1) cache.exams[i] = old; });
    return cache.exams[i];
  }
  function deleteExam(id) {
    const old = cache.exams.find(x => x.id === id);
    cache.exams = cache.exams.filter(x => x.id !== id);
    fireAndForget(api('DELETE', '/exams/' + id), () => { if (old) cache.exams.push(old); });
  }

  // 考试记录
  function addRecord(r) {
    r.id = r.id || uid();
    r.createdAt = r.createdAt || Date.now();
    cache.records.push({ ...r, passed: !!r.passed });
    fireAndForget(api('POST', '/records', r).then(data => { const idx = cache.records.findIndex(x => x.id === r.id); if (idx !== -1) cache.records[idx] = { ...cache.records[idx], ...data, passed: !!data.passed }; }), () => { cache.records = cache.records.filter(x => x.id !== r.id); });
    return r;
  }
  function deleteRecord(id) {
    const old = cache.records.find(x => x.id === id);
    cache.records = cache.records.filter(x => x.id !== id);
    fireAndForget(api('DELETE', '/records/' + id), () => { if (old) cache.records.push(old); });
  }

  // 学习进度
  function upsertProgress(p) {
    const uid = p.userId || p.user_id;
    const mid = p.materialId || p.material_id;
    const i = cache.progress.findIndex(x => (x.userId || x.user_id) === uid && (x.materialId || x.material_id) === mid);
    if (i !== -1) cache.progress[i] = { ...cache.progress[i], ...p, completed: !!p.completed };
    else cache.progress.push({ ...p, id: p.id || uid(), createdAt: Date.now(), completed: !!p.completed });
    fireAndForget(api('POST', '/progress', p));
  }

  // 断线续考
  function saveInProgress(ip) {
    const uid = ip.userId || ip.user_id;
    const eid = ip.examId || ip.exam_id;
    const i = cache.inprogress.findIndex(x => (x.userId || x.user_id) === uid && (x.examId || x.exam_id) === eid);
    if (i !== -1) cache.inprogress[i] = { ...cache.inprogress[i], ...ip };
    else cache.inprogress.push({ ...ip, id: ip.id || uid(), savedAt: Date.now() });
    fireAndForget(api('POST', '/inprogress', ip));
  }
  function removeInProgress(uid, eid) {
    cache.inprogress = cache.inprogress.filter(x => !((x.userId || x.user_id) === uid && (x.examId || x.exam_id) === eid));
    fireAndForget(api('DELETE', '/inprogress/' + eid));
  }

  // 用户
  function addUser(u) {
    u.id = u.id || uid();
    u.createdAt = u.createdAt || Date.now();
    cache.users.push(u);
    fireAndForget(api('POST', '/users', u), () => { cache.users = cache.users.filter(x => x.id !== u.id); });
    return u;
  }
  function updateUser(id, p) {
    const i = cache.users.findIndex(x => x.id === id);
    const old = i !== -1 ? { ...cache.users[i] } : null;
    if (i !== -1) cache.users[i] = { ...cache.users[i], ...p };
    fireAndForget(api('PUT', '/users/' + id, p), () => { if (old && i !== -1) cache.users[i] = old; });
    return cache.users[i];
  }
  function deleteUser(id) {
    const old = cache.users.find(x => x.id === id);
    cache.users = cache.users.filter(x => x.id !== id);
    fireAndForget(api('DELETE', '/users/' + id), () => { if (old) cache.users.push(old); });
  }

  // 重置
  function resetAll() { console.warn('resetAll 需要在服务器端操作'); }

  // 会话（保持兼容）
  function getSession() {
    const token = getToken();
    const userStr = localStorage.getItem('etms_user');
    if (token && userStr) return { token, user: JSON.parse(userStr) };
    return null;
  }
  function setSession(s) {
    localStorage.setItem('etms_token', s.token);
    localStorage.setItem('etms_user', JSON.stringify(s.user));
  }
  function clearSession() {
    localStorage.removeItem('etms_token');
    localStorage.removeItem('etms_user');
  }

  return {
    init, uid, norm,
    getSession, setSession, clearSession,
    getCategories, getCategoryById, addCategory, updateCategory, deleteCategory,
    getMaterials, getMaterialById, getMaterialsByCategory, addMaterial, updateMaterial, deleteMaterial,
    getQuestions, getQuestionById, getQuestionsByCategory, addQuestion, updateQuestion, deleteQuestion,
    getExams, getExamById, getActiveExams, addExam, updateExam, deleteExam,
    getRecords, getRecordById, getRecordsByUser, getRecordsByExam, addRecord, deleteRecord,
    getProgress, getProgressByUser, upsertProgress,
    getInProgress, getInProgressByExam, saveInProgress, removeInProgress,
    getUsers, getUserById, addUser, updateUser, deleteUser,
    resetAll,
  };
})();
