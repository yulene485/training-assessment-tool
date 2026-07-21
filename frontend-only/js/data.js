/* ============================================================
   数据层 - localStorage 持久化（纯前端版）
   - 所有数据存储在 localStorage
   - 刷新页面数据不丢失
   - 与其他前端文件完全兼容（同步读写）
   - 支持三级角色：super_admin / admin / employee
   - 操作日志记录
   - 考试支持参与人员指定、草稿/发布状态
   - 题型扩展：简答题(short_answer) / 论述题(essay)
   - 多资料上传：attachments[] 数组
   - 软删除：deleted 标记，已删除项不再展示
   - 跨标签页数据同步：storage 事件
   ============================================================ */

const DB = (() => {
  const STORAGE_KEY = 'etms_data';
  let data = null;

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { data = JSON.parse(raw); } catch { data = null; }
    }
    if (!data) {
      data = createSeedData();
      save();
    }
    // 兼容旧数据：补充缺失字段
    if (!data.logs) data.logs = [];
    data.exams.forEach(e => {
      if (!e.participants) e.participants = [];
      if (!e.startTime) e.startTime = null;
      if (!e.deadline) e.deadline = null;
      if (!e.status) e.status = 'active';
    });
    data.users.forEach(u => {
      if (!u.scope) u.scope = u.role === 'super_admin' ? 'all' : '';
      if (!u.jobNumber) u.jobNumber = '';
      if (!u.position) u.position = '';
      if (u.role === 'admin' && u.id === 'u_admin') u.role = 'super_admin';
      if (!u.deleted) u.deleted = false;
    });
    data.questions.forEach(q => {
      if (!q.referenceAnswer) q.referenceAnswer = '';
    });
    data.materials.forEach(m => {
      if (!m.attachments) m.attachments = [];
      if (!m.deleted) m.deleted = false;
    });
    data.questions.forEach(q => { if (!q.deleted) q.deleted = false; });
    data.exams.forEach(e => { if (!e.deleted) e.deleted = false; });
    data.records.forEach(r => {
      if (!r.subjectiveGraded) r.subjectiveGraded = false;
      if (!r.subjectiveScore) r.subjectiveScore = 0;
    });
    save();
    return data;
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ---------- 种子数据 ----------
  function createSeedData() {
    const now = Date.now();
    const categories = [
      { id: 'c1', name: '入职培训', icon: '🎯', sortOrder: 0 },
      { id: 'c2', name: '安全规范', icon: '🛡️', sortOrder: 1 },
      { id: 'c3', name: '产品知识', icon: '📦', sortOrder: 2 },
      { id: 'c4', name: '技术培训', icon: '💻', sortOrder: 3 },
    ];
    const materials = [
      { id: 'm1', title: '新员工入职指南', desc: '介绍公司文化、组织架构、规章制度等入职必读内容。', categoryId: 'c1', type: 'doc', cover: '', fileName: '新员工入职指南.docx', fileSize: 1024000, content: '欢迎使用新员工入职指南。\n\n本指南涵盖：\n1. 公司简介与发展历程\n2. 组织架构与各部门职能\n3. 员工行为规范\n4. 薪酬福利体系\n5. 晋升发展通道\n\n请仔细阅读并理解各项内容，这将帮助你快速融入团队。', url: '', uploader: '总管理员', createdAt: now - 86400000 * 7 },
      { id: 'm2', title: '信息安全管理制度', desc: '公司信息安全管理规范，包括数据保护、密码策略等。', categoryId: 'c2', type: 'pdf', cover: '', fileName: '信息安全管理制度.pdf', fileSize: 2048000, content: '信息安全管理制度\n\n一、数据保护原则\n- 最小权限原则\n- 数据分类分级管理\n- 定期备份机制\n\n二、密码安全策略\n- 密码长度不少于8位\n- 包含大小写字母、数字、特殊字符\n- 每90天更换一次\n- 禁止使用弱密码\n\n三、终端安全\n- 安装杀毒软件并定期更新\n- 离开工位须锁屏\n- 禁止安装未经审批的软件', url: '', uploader: '总管理员', createdAt: now - 86400000 * 5 },
      { id: 'm3', title: '产品功能演示视频', desc: '公司核心产品的功能介绍与操作演示。', categoryId: 'c3', type: 'video', cover: '', fileName: '产品演示.mp4', fileSize: 51200000, content: '', url: 'https://www.w3schools.com/html/mov_bbb.mp4', uploader: '总管理员', createdAt: now - 86400000 * 3 },
      { id: 'm4', title: '前端开发规范', desc: '团队前端代码规范与最佳实践。', categoryId: 'c4', type: 'doc', cover: '', fileName: '前端开发规范.docx', fileSize: 8192000, content: '前端开发规范\n\n一、命名规范\n- 组件名使用 PascalCase\n- 变量名使用 camelCase\n- 常量名使用 UPPER_SNAKE_CASE\n\n二、代码结构\n- 单文件不超过 300 行\n- 函数单一职责\n- 必要的注释\n\n三、Git 提交规范\n- feat: 新功能\n- fix: 修复 bug\n- docs: 文档变更\n- refactor: 重构', url: '', uploader: '总管理员', createdAt: now - 86400000 * 2 },
    ];
    const questions = [
      { id: 'q1', type: 'single', stem: '公司员工行为规范中，下列哪项是正确的？', options: ['可以随意泄露公司机密', '离职后可带走公司数据', '遵守保密协议，保护公司信息', '可在社交媒体随意发表公司内部信息'], answer: [2], score: 10, analysis: '员工应严格遵守保密协议，保护公司信息资产安全。', categoryId: 'c2', createdAt: now },
      { id: 'q2', type: 'single', stem: '公司密码安全策略要求密码长度不少于多少位？', options: ['6位', '8位', '10位', '12位'], answer: [1], score: 10, analysis: '根据信息安全管理制度，密码长度不少于8位。', categoryId: 'c2', createdAt: now },
      { id: 'q3', type: 'multiple', stem: '以下哪些属于强密码的特征？（多选）', options: ['包含大小写字母', '包含数字', '包含特殊字符', '使用生日或姓名'], answer: [0, 1, 2], score: 15, analysis: '强密码应包含大小写字母、数字和特殊字符，不应使用生日等易猜信息。', categoryId: 'c2', createdAt: now },
      { id: 'q4', type: 'judge', stem: '员工离开工位时必须锁屏。', options: ['正确', '错误'], answer: [0], score: 5, analysis: '离开工位锁屏是基本的信息安全要求。', categoryId: 'c2', createdAt: now },
      { id: 'q5', type: 'single', stem: '前端组件命名应使用哪种命名法？', options: ['kebab-case', 'PascalCase', 'camelCase', 'snake_case'], answer: [1], score: 10, analysis: '根据前端开发规范，组件名使用 PascalCase。', categoryId: 'c4', createdAt: now },
      { id: 'q6', type: 'multiple', stem: '以下哪些是 Git 提交规范的前缀？（多选）', options: ['feat', 'fix', 'docs', 'random'], answer: [0, 1, 2], score: 15, analysis: '规范的前缀包括 feat、fix、docs、refactor 等。', categoryId: 'c4', createdAt: now },
      { id: 'q7', type: 'judge', stem: '单文件代码可以超过 300 行，无需拆分。', options: ['正确', '错误'], answer: [1], score: 5, analysis: '规范要求单文件不超过 300 行。', categoryId: 'c4', createdAt: now },
      { id: 'q8', type: 'single', stem: '新员工入职指南中不包括以下哪项内容？', options: ['公司简介', '组织架构', '个人家庭信息', '薪酬福利'], answer: [2], score: 10, analysis: '入职指南涵盖公司简介、组织架构、行为规范、薪酬福利等，不涉及个人家庭信息。', categoryId: 'c1', createdAt: now },
      { id: 'q9', type: 'multiple', stem: '信息安全管理遵循的原则包括？（多选）', options: ['最小权限原则', '数据分类分级管理', '定期备份机制', '随意共享数据'], answer: [0, 1, 2], score: 15, analysis: '信息安全应遵循最小权限、分类分级、定期备份等原则。', categoryId: 'c2', createdAt: now },
      { id: 'q10', type: 'judge', stem: '员工可以在工作电脑上安装任何来源的软件。', options: ['正确', '错误'], answer: [1], score: 5, analysis: '禁止安装未经审批的软件。', categoryId: 'c2', createdAt: now, referenceAnswer: '' },
      { id: 'q11', type: 'short_answer', stem: '请简述信息安全中"最小权限原则"的含义及其重要性。', options: [], answer: [], score: 20, analysis: '最小权限原则要求每位员工仅获取完成工作所需的最低权限。', categoryId: 'c2', createdAt: now, referenceAnswer: '最小权限原则是指仅赋予用户完成其工作职责所需的最低限度权限。其重要性在于：1) 减少误操作风险；2) 降低数据泄露可能性；3) 限制恶意行为的影响范围；4) 符合合规审计要求。' },
      { id: 'q12', type: 'essay', stem: '结合公司实际情况，论述如何建立一个有效的信息安全管理体系，包括技术手段和管理制度两个层面。', options: [], answer: [], score: 30, analysis: '需从技术和管理两个层面论述。', categoryId: 'c2', createdAt: now, referenceAnswer: '技术层面：1) 建立防火墙和入侵检测系统；2) 实施数据加密传输和存储；3) 定期漏洞扫描和安全评估；4) 部署终端安全管控工具。管理层面：1) 制定信息安全管理制度和操作规范；2) 建立安全事件响应机制；3) 开展定期安全培训和考核；4) 实施权限分级和审计追踪；5) 建立安全问责机制。' },
    ];
    const exams = [
      { id: 'ex1', title: '信息安全基础考核', desc: '检验员工对信息安全管理制度的掌握程度。', categoryId: 'c2', questionIds: ['q1','q2','q3','q4','q9','q10'], duration: 20, passScore: 60, maxAttempts: 3, randomOrder: true, totalScore: 70, status: 'published', startTime: now - 86400000 * 10, deadline: now + 86400000 * 30, participants: ['u_e1','u_e2','u_e3'], createdAt: now },
      { id: 'ex2', title: '前端开发规范考核', desc: '测试团队前端开发规范掌握情况。', categoryId: 'c4', questionIds: ['q5','q6','q7'], duration: 10, passScore: 60, maxAttempts: 2, randomOrder: false, totalScore: 30, status: 'published', startTime: now - 86400000 * 5, deadline: now + 86400000 * 30, participants: ['u_e1'], createdAt: now },
      { id: 'ex3', title: '新员工入职考核', desc: '新员工入职培训综合考核。', categoryId: 'c1', questionIds: ['q8'], duration: 10, passScore: 60, maxAttempts: 1, randomOrder: false, totalScore: 10, status: 'draft', startTime: null, deadline: null, participants: [], createdAt: now },
    ];
    const users = [
      { id: 'u_super', username: 'superadmin', password: 'super123', name: '总管理员', role: 'super_admin', dept: '总管理部', scope: 'all', jobNumber: 'SA001', position: '总管理员', createdAt: now },
      { id: 'u_admin', username: 'admin', password: 'admin123', name: '张主管', role: 'admin', dept: '人力资源部', scope: 'c1,c2', jobNumber: 'A001', position: '培训主管', createdAt: now },
      { id: 'u_e1', username: 'employee', password: '123456', name: '张明', role: 'employee', dept: '研发部', scope: '', jobNumber: 'E001', position: '前端工程师', createdAt: now },
      { id: 'u_e2', username: 'lina', password: '123456', name: '李娜', role: 'employee', dept: '市场部', scope: '', jobNumber: 'E002', position: '市场专员', createdAt: now },
      { id: 'u_e3', username: 'wangwu', password: '123456', name: '王五', role: 'employee', dept: '研发部', scope: '', jobNumber: 'E003', position: '后端工程师', createdAt: now },
    ];
    const records = [
      { id: 'r1', examId: 'ex1', examTitle: '信息安全基础考核', userId: 'u_e1', userName: '张明', dept: '研发部', score: 85, totalScore: 70, passScore: 60, passed: true, answers: {}, details: [], duration: 980000, startedAt: now - 86400000 * 3, submittedAt: now - 86400000 * 3 + 980000, attempt: 1 },
      { id: 'r2', examId: 'ex1', examTitle: '信息安全基础考核', userId: 'u_e2', userName: '李娜', dept: '市场部', score: 55, totalScore: 70, passScore: 60, passed: false, answers: {}, details: [], duration: 1200000, startedAt: now - 86400000 * 2, submittedAt: now - 86400000 * 2 + 1200000, attempt: 1 },
      { id: 'r3', examId: 'ex2', examTitle: '前端开发规范考核', userId: 'u_e1', userName: '张明', dept: '研发部', score: 30, totalScore: 30, passScore: 60, passed: true, answers: {}, details: [], duration: 420000, startedAt: now - 86400000, submittedAt: now - 86400000 + 420000, attempt: 1 },
      { id: 'r4', examId: 'ex1', examTitle: '信息安全基础考核', userId: 'u_e3', userName: '王五', dept: '研发部', score: 70, totalScore: 70, passScore: 60, passed: true, answers: {}, details: [], duration: 760000, startedAt: now - 86400000, submittedAt: now - 86400000 + 760000, attempt: 1 },
      { id: 'r5', examId: 'ex3', examTitle: '新员工入职考核', userId: 'u_e2', userName: '李娜', dept: '市场部', score: 10, totalScore: 10, passScore: 60, passed: true, answers: {}, details: [], duration: 180000, startedAt: now - 3600000, submittedAt: now - 3600000 + 180000, attempt: 1 },
    ];
    const logs = [
      { id: 'l1', userId: 'u_super', userName: '总管理员', action: 'create_exam', target: 'ex1', detail: '创建考试「信息安全基础考核」', createdAt: now - 86400000 * 10 },
      { id: 'l2', userId: 'u_super', userName: '总管理员', action: 'publish_exam', target: 'ex1', detail: '发布考试「信息安全基础考核」', createdAt: now - 86400000 * 10 },
      { id: 'l3', userId: 'u_admin', userName: '张主管', action: 'create_material', target: 'm2', detail: '上传资料「信息安全管理制度」', createdAt: now - 86400000 * 5 },
    ];
    return { categories, materials, questions, exams, users, records, progress: [], inprogress: [], logs };
  }

  // 初始化
  data = load();

  // ---------- 通用辅助 ----------
  function findById(arr, id) { return arr.find(x => x.id === id); }

  // ---------- 分类 ----------
  function getCategories() { return data.categories; }
  function getCategoryById(id) { return findById(data.categories, id); }
  function addCategory(c) { c.id = c.id || uid(); data.categories.push(c); save(); return c; }
  function updateCategory(id, p) { const i = data.categories.findIndex(x => x.id === id); if (i !== -1) data.categories[i] = { ...data.categories[i], ...p }; save(); return data.categories[i]; }
  function deleteCategory(id) { data.categories = data.categories.filter(x => x.id !== id); save(); }

  // ---------- 资料（支持软删除 + attachments） ----------
  function getMaterials() { return data.materials.filter(m => !m.deleted); }
  function getAllMaterials() { return data.materials; }
  function getMaterialById(id) { return findById(data.materials, id); }
  function getMaterialsByCategory(cid) { return data.materials.filter(m => m.categoryId === cid && !m.deleted); }
  function addMaterial(m) { m.id = m.id || uid(); m.createdAt = m.createdAt || Date.now(); m.deleted = false; m.attachments = m.attachments || []; data.materials.push(m); save(); return m; }
  function updateMaterial(id, p) { const i = data.materials.findIndex(x => x.id === id); if (i !== -1) data.materials[i] = { ...data.materials[i], ...p }; save(); return data.materials[i]; }
  function softDeleteMaterial(id) { const m = getMaterialById(id); if (m) { m.deleted = true; m.deletedAt = Date.now(); save(); } }

  // ---------- 题库（支持软删除 + 主观题） ----------
  function getQuestions() { return data.questions.filter(q => !q.deleted); }
  function getAllQuestions() { return data.questions; }
  function getQuestionById(id) { return findById(data.questions, id); }
  function getQuestionsByCategory(cid) { return data.questions.filter(q => q.categoryId === cid && !q.deleted); }
  function addQuestion(q) { q.id = q.id || uid(); q.createdAt = q.createdAt || Date.now(); q.deleted = false; q.referenceAnswer = q.referenceAnswer || ''; data.questions.push(q); save(); return q; }
  function addQuestionsBatch(arr) { arr.forEach(q => { q.id = q.id || uid(); q.createdAt = q.createdAt || Date.now(); q.deleted = false; q.referenceAnswer = q.referenceAnswer || ''; data.questions.push(q); }); save(); return arr; }
  function updateQuestion(id, p) { const i = data.questions.findIndex(x => x.id === id); if (i !== -1) data.questions[i] = { ...data.questions[i], ...p }; save(); return data.questions[i]; }
  function deleteQuestion(id) { data.questions = data.questions.filter(x => x.id !== id); save(); }
  function softDeleteQuestion(id) { const q = getQuestionById(id); if (q) { q.deleted = true; q.deletedAt = Date.now(); save(); } }
  function softDeleteQuestionsBatch(ids) { ids.forEach(id => softDeleteQuestion(id)); save(); }

  // ---------- 考试（支持软删除） ----------
  function getExams() { return data.exams.filter(e => !e.deleted); }
  function getAllExams() { return data.exams; }
  function getExamById(id) { return findById(data.exams, id); }
  function getActiveExams() { return data.exams.filter(e => (e.status === 'published' || e.status === 'active') && !e.deleted); }
  function getPublishedExams() { return data.exams.filter(e => (e.status === 'published' || e.status === 'active') && !e.deleted); }
  // 获取某员工可参加的考试
  function getExamsForEmployee(uid) {
    return getPublishedExams().filter(e => {
      if (!e.participants || e.participants.length === 0) return true; // 未指定=全员可考
      return e.participants.includes(uid);
    });
  }
  function addExam(e) { e.id = e.id || uid(); e.createdAt = e.createdAt || Date.now(); e.deleted = false; data.exams.push(e); save(); return e; }
  function updateExam(id, p) { const i = data.exams.findIndex(x => x.id === id); if (i !== -1) data.exams[i] = { ...data.exams[i], ...p }; save(); return data.exams[i]; }
  function deleteExam(id) { data.exams = data.exams.filter(x => x.id !== id); save(); }
  function softDeleteExam(id) { const e = getExamById(id); if (e) { e.deleted = true; e.deletedAt = Date.now(); save(); } }

  // ---------- 考试记录（支持主观题评分更新） ----------
  function getRecords() { return data.records; }
  function getRecordById(id) { return findById(data.records, id); }
  function getRecordsByUser(uid) { return data.records.filter(r => r.userId === uid); }
  function getRecordsByExam(eid) { return data.records.filter(r => r.examId === eid); }
  function addRecord(r) { r.id = r.id || uid(); r.createdAt = r.createdAt || Date.now(); r.subjectiveGraded = r.subjectiveGraded || false; r.subjectiveScore = r.subjectiveScore || 0; data.records.push(r); save(); return r; }
  function updateRecord(id, p) { const i = data.records.findIndex(x => x.id === id); if (i !== -1) data.records[i] = { ...data.records[i], ...p }; save(); return data.records[i]; }
  function deleteRecord(id) { data.records = data.records.filter(x => x.id !== id); save(); }

  // ---------- 学习进度 ----------
  function getProgress() { return data.progress; }
  function getProgressByUser(uid) { return data.progress.filter(p => p.userId === uid); }
  function upsertProgress(p) {
    p.userId = p.userId || App.currentUser.id;
    const i = data.progress.findIndex(x => x.userId === p.userId && x.materialId === p.materialId);
    if (i !== -1) data.progress[i] = { ...data.progress[i], ...p };
    else { p.id = p.id || uid(); p.createdAt = Date.now(); data.progress.push(p); }
    save();
  }

  // ---------- 断线续考 ----------
  function getInProgress(uid) { return data.inprogress.filter(ip => ip.userId === uid); }
  function getInProgressByExam(uid, eid) { return data.inprogress.find(ip => ip.userId === uid && ip.examId === eid); }
  function saveInProgress(ip) {
    ip.userId = ip.userId || App.currentUser.id;
    const i = data.inprogress.findIndex(x => x.userId === ip.userId && x.examId === ip.examId);
    if (i !== -1) data.inprogress[i] = { ...data.inprogress[i], ...ip };
    else { ip.id = ip.id || uid(); ip.savedAt = Date.now(); data.inprogress.push(ip); }
    save();
  }
  function removeInProgress(uid, eid) { data.inprogress = data.inprogress.filter(x => !(x.userId === uid && x.examId === eid)); save(); }

  // ---------- 用户（支持软删除） ----------
  function getUsers() { return data.users.filter(u => !u.deleted); }
  function getAllUsers() { return data.users; }
  function getUserById(id) { return findById(data.users, id); }
  function addUser(u) { u.id = u.id || uid(); u.createdAt = u.createdAt || Date.now(); u.deleted = false; data.users.push(u); save(); return u; }
  function updateUser(id, p) { const i = data.users.findIndex(x => x.id === id); if (i !== -1) data.users[i] = { ...data.users[i], ...p }; save(); return data.users[i]; }
  function deleteUser(id) { data.users = data.users.filter(x => x.id !== id); save(); }
  function softDeleteUser(id) { const u = getUserById(id); if (u) { u.deleted = true; u.deletedAt = Date.now(); save(); } }
  // 获取所有部门列表
  function getDepartments() {
    const depts = [...new Set(data.users.filter(u => !u.deleted).map(u => u.dept).filter(Boolean))];
    return depts;
  }
  // 获取管理员列表（不含总管理员）
  function getAdmins() { return data.users.filter(u => u.role === 'admin' && !u.deleted); }

  // ---------- 操作日志 ----------
  function getLogs() { return data.logs; }
  function addLog(action, target, detail) {
    const log = {
      id: uid(),
      userId: App.currentUser ? App.currentUser.id : 'system',
      userName: App.currentUser ? App.currentUser.name : '系统',
      action,
      target: target || '',
      detail: detail || '',
      createdAt: Date.now(),
    };
    data.logs.push(log);
    save();
    return log;
  }

  // ---------- 会话 ----------
  function getSession() {
    const userStr = localStorage.getItem('etms_session');
    if (userStr) try { return JSON.parse(userStr); } catch {}
    return null;
  }
  function setSession(s) { localStorage.setItem('etms_session', JSON.stringify(s)); }
  function clearSession() { localStorage.removeItem('etms_session'); }

  // ---------- 重置 ----------
  function resetAll() { data = createSeedData(); save(); }

  // ---------- 跨标签页数据同步 ----------
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try { data = JSON.parse(e.newValue); } catch { return; }
      // 如果当前有活跃页面，重新渲染
      if (App && App.render) App.render();
    }
  });

  return {
    getCategories, getCategoryById, addCategory, updateCategory, deleteCategory,
    getMaterials, getAllMaterials, getMaterialById, getMaterialsByCategory, addMaterial, updateMaterial, softDeleteMaterial,
    getQuestions, getAllQuestions, getQuestionById, getQuestionsByCategory, addQuestion, addQuestionsBatch, updateQuestion, deleteQuestion, softDeleteQuestion, softDeleteQuestionsBatch,
    getExams, getAllExams, getExamById, getActiveExams, getPublishedExams, getExamsForEmployee, addExam, updateExam, deleteExam, softDeleteExam,
    getRecords, getRecordById, getRecordsByUser, getRecordsByExam, addRecord, updateRecord, deleteRecord,
    getProgress, getProgressByUser, upsertProgress,
    getInProgress, getInProgressByExam, saveInProgress, removeInProgress,
    getUsers, getAllUsers, getUserById, addUser, updateUser, deleteUser, softDeleteUser, getDepartments, getAdmins,
    getLogs, addLog,
    getSession, setSession, clearSession,
    resetAll,
  };
})();
