/* ============================================================
   员工功能模块
   - 员工首页概览
   - 在线学习培训资料（学习中心列表 + 资料查看）
   - 考试列表（含次数限制判断、断线续考）
   - 我的成绩
   ============================================================ */

const Employee = (() => {

  const typeIconMap = { doc: '📄', pdf: '📕', video: '🎬', img: '🖼️', file: '📎' };

  // ---------- 员工首页 ----------
  function home() {
    const uid = App.currentUser.id;
    const materials = DB.getMaterials();
    const exams = DB.getActiveExams();
    const myRecords = DB.getRecordsByUser(uid);
    const myProgress = DB.getProgressByUser(uid);
    const passed = myRecords.filter(r => r.passed).length;
    const avgScore = myRecords.length ? Math.round(myRecords.reduce((s, r) => s + (r.score / r.totalScore * 100), 0) / myRecords.length) : 0;

    return `
      <div class="page-header">
        <div>
          <h2>你好，${escapeHtml(App.currentUser.name)} 👋</h2>
          <div class="subtitle">${App.currentUser.dept || ''} · 开始你的学习之旅</div>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue">📚</div>
          <div><div class="stat-value">${materials.length}</div><div class="stat-label">可学资料</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">📖</div>
          <div><div class="stat-value">${myProgress.filter(p => p.completed).length}</div><div class="stat-label">已学资料</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange">📋</div>
          <div><div class="stat-value">${exams.length}</div><div class="stat-label">可参加考试</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon cyan">✅</div>
          <div><div class="stat-value">${passed}</div><div class="stat-label">已通过考试</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon ${avgScore >= 60 ? 'green' : 'red'}">📊</div>
          <div><div class="stat-value">${avgScore}%</div><div class="stat-label">平均得分率</div></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="card" style="padding:20px">
          <h4 style="margin-bottom:14px">📘 推荐学习</h4>
          ${materials.slice(0, 3).map(m => {
            const cat = DB.getCategoryById(m.categoryId);
            return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:22px">${typeIconMap[m.type]}</span>
              <div style="flex:1;min-width:0">
                <div style="font-weight:500;font-size:14px">${escapeHtml(m.title)}</div>
                <div style="font-size:12px;color:var(--text-muted)">${cat ? cat.name : ''}</div>
              </div>
              <button class="btn btn-sm btn-primary" onclick="Employee.openMaterial('${m.id}')">学习</button>
            </div>`;
          }).join('') || '<div class="empty-state">暂无资料</div>'}
          <button class="btn btn-secondary btn-block" style="margin-top:12px" onclick="App.navigate('learnCenter')">查看全部 →</button>
        </div>
        <div class="card" style="padding:20px">
          <h4 style="margin-bottom:14px">📝 待参加考试</h4>
          ${exams.slice(0, 3).map(e => {
            const attempts = myRecords.filter(r => r.examId === e.id).length;
            const canTake = attempts < e.maxAttempts;
            return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:22px">📋</span>
              <div style="flex:1;min-width:0">
                <div style="font-weight:500;font-size:14px">${escapeHtml(e.title)}</div>
                <div style="font-size:12px;color:var(--text-muted)">${e.duration}分钟 · ${e.questionIds.length}题 · 已考 ${attempts}/${e.maxAttempts} 次</div>
              </div>
              <button class="btn btn-sm ${canTake ? 'btn-primary' : 'btn-secondary'}" onclick="App.navigate('exams')">${canTake ? '参加' : '已满'}</button>
            </div>`;
          }).join('') || '<div class="empty-state">暂无考试</div>'}
          <button class="btn btn-secondary btn-block" style="margin-top:12px" onclick="App.navigate('exams')">查看全部 →</button>
        </div>
      </div>
    `;
  }

  // ---------- 学习中心（列表） ----------
  let learnFilter = { category: '', keyword: '' };
  function learnCenter() {
    let list = DB.getMaterials();
    if (learnFilter.category) list = list.filter(m => m.categoryId === learnFilter.category);
    if (learnFilter.keyword) {
      const kw = learnFilter.keyword.toLowerCase();
      list = list.filter(m => m.title.toLowerCase().includes(kw) || (m.desc || '').toLowerCase().includes(kw));
    }
    const cats = DB.getCategories();
    const uid = App.currentUser.id;
    const progress = DB.getProgressByUser(uid);

    return `
      <div class="page-header">
        <div>
          <h2>学习中心</h2>
          <div class="subtitle">浏览并学习培训资料</div>
        </div>
      </div>
      <div class="category-tabs">
        <span class="category-tab ${!learnFilter.category ? 'active' : ''}" onclick="Employee.setLearnFilter('category','')">全部分类</span>
        ${cats.map(c => `<span class="category-tab ${learnFilter.category === c.id ? 'active' : ''}" onclick="Employee.setLearnFilter('category','${c.id}')">${c.icon} ${c.name}</span>`).join('')}
      </div>
      <div class="toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="搜索资料..." value="${learnFilter.keyword}" oninput="Employee.setLearnFilter('keyword', this.value)" />
        </div>
        <span class="badge badge-gray">共 ${list.length} 项</span>
      </div>
      ${list.length === 0 ? emptyState('📚', '暂无可学习的资料') : `
      <div class="cards-grid">
        ${list.map(m => {
          const cat = DB.getCategoryById(m.categoryId);
          const p = progress.find(x => x.materialId === m.id);
          const isCompleted = p && p.completed;
          return `
          <div class="material-card">
            <div class="material-thumb ${m.type}">${typeIconMap[m.type]}
              ${isCompleted ? '<span class="badge badge-success" style="position:absolute;top:8px;right:8px">✓ 已学完</span>' : ''}
            </div>
            <div class="material-body">
              <h4>${escapeHtml(m.title)}</h4>
              <div class="material-meta">
                <span>${cat ? cat.icon + ' ' + cat.name : '未分类'}</span>
                <span>${formatDate(m.createdAt)}</span>
              </div>
              <div class="material-desc">${escapeHtml(m.desc || '暂无描述')}</div>
              <div class="material-actions">
                <button class="btn btn-sm btn-primary" onclick="Employee.openMaterial('${m.id}')">${isCompleted ? '📖 再次学习' : '▶️ 开始学习'}</button>
                ${FileUtil.canDownload(m) ? `<button class="btn btn-sm btn-secondary" onclick="Employee.downloadMaterial('${m.id}')">⬇️ 下载</button>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`}
    `;
  }
  function setLearnFilter(key, val) { learnFilter[key] = val; App.render(); }

  // ---------- 打开单个资料学习 ----------
  function openMaterial(id) {
    const m = DB.getMaterialById(id);
    if (!m) return;
    const uid = App.currentUser.id;
    const cat = DB.getCategoryById(m.categoryId);
    const p = DB.getProgressByUser(uid).find(x => x.materialId === id);

    openModal({
      title: m.title,
      size: 'lg',
      body: `
        <div style="margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <span class="badge badge-primary">${cat ? cat.icon + ' ' + cat.name : '未分类'}</span>
          <span class="badge badge-gray">${typeIconMap[m.type]} ${m.type.toUpperCase()}</span>
          ${m.fileSize ? `<span class="badge badge-gray">${formatSize(m.fileSize)}</span>` : ''}
          ${m.fileName ? `<span class="badge badge-gray">📄 ${escapeHtml(m.fileName)}</span>` : ''}
          ${p && p.completed ? '<span class="badge badge-success">✓ 已完成学习</span>' : '<span class="badge badge-warning">学习中</span>'}
        </div>
        ${FileUtil.previewHtml(m)}
        ${FileUtil.canDownload(m) ? `<div style="margin-top:14px;text-align:center"><button class="btn btn-secondary" onclick="Employee.downloadMaterial('${m.id}')">⬇️ 下载到本地</button></div>` : ''}
      `,
      okText: p && p.completed ? '已学完' : '标记为已学完',
      cancelText: '关闭',
      onOk: () => {
        DB.upsertProgress({ userId: uid, materialId: id, completed: true, completedAt: Date.now() });
        toast('学习进度已记录', 'success');
        App.render();
        return true;
      }
    });
  }

  function downloadMaterial(id) {
    const m = DB.getMaterialById(id);
    if (!m) return;
    if (FileUtil.download(m)) toast('开始下载', 'success');
    else toast('该资料暂不支持下载', 'warning');
  }

  // ---------- 考试列表 ----------
  function exams() {
    const uid = App.currentUser.id;
    const list = DB.getActiveExams();
    const myRecords = DB.getRecordsByUser(uid);
    return `
      <div class="page-header">
        <div>
          <h2>考试中心</h2>
          <div class="subtitle">参加考核，检验学习成果</div>
        </div>
      </div>
      ${list.length === 0 ? emptyState('📋', '暂无可参加的考试') : `
      <div class="cards-grid">
        ${list.map(e => {
          const cat = DB.getCategoryById(e.categoryId);
          const attempts = myRecords.filter(r => r.examId === e.id);
          const bestScore = attempts.length ? Math.max(...attempts.map(r => r.score)) : 0;
          const bestPercent = attempts.length ? Math.round(bestScore / e.totalScore * 100) : 0;
          const canTake = attempts.length < e.maxAttempts;
          const inProgress = DB.getInProgressByExam(uid, e.id);
          return `
          <div class="exam-card">
            <div class="exam-thumb">📋
              ${attempts.length > 0 ? `<span class="badge ${bestPercent >= e.passScore ? 'badge-success' : 'badge-danger'}" style="position:absolute;top:8px;right:8px">最高 ${bestScore}/${e.totalScore}</span>` : ''}
            </div>
            <div class="exam-body">
              <h4>${escapeHtml(e.title)}</h4>
              <div class="exam-meta">
                <span>${cat ? cat.icon + ' ' + cat.name : '-'}</span>
                <span>${e.questionIds.length} 题</span>
                <span>⏱️ ${e.duration} 分钟</span>
                <span>及格 ${e.passScore}%</span>
              </div>
              <div class="exam-desc">${escapeHtml(e.desc || '暂无描述')}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
                已考 ${attempts.length}/${e.maxAttempts} 次
                ${attempts.length ? `· 最高得分率 ${bestPercent}%` : ''}
                ${e.randomOrder ? '· 随机出题' : ''}
              </div>
              <div class="exam-actions">
                ${inProgress ? `<button class="btn btn-sm btn-success" onclick="Employee.resumeExam('${e.id}')">▶️ 继续考试</button>` : ''}
                ${canTake ? `<button class="btn btn-sm ${inProgress ? 'btn-secondary' : 'btn-primary'}" onclick="Employee.startExam('${e.id}')">${inProgress ? '重新开始' : '▶️ 开始考试'}</button>` : '<span class="badge badge-gray">次数已用完</span>'}
                ${attempts.length ? `<button class="btn btn-sm btn-secondary" onclick="Employee.viewHistory('${e.id}')">📜 历史</button>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`}
    `;
  }

  function startExam(examId) {
    const e = DB.getExamById(examId);
    if (!e) return;
    const uid = App.currentUser.id;
    const attempts = DB.getRecordsByUser(uid).filter(r => r.examId === examId);
    if (attempts.length >= e.maxAttempts) {
      toast(`考试次数已达上限（${e.maxAttempts} 次）`, 'error'); return;
    }
    const inProgress = DB.getInProgressByExam(uid, examId);
    if (inProgress) {
      confirmDialog('您有未完成的考试，是否继续上次进度？重新开始将清除已答内容。', () => {
        DB.removeInProgress(uid, examId);
        _beginExam(e);
      }, () => {
        Exam.resume(e, inProgress);
      }, '重新开始', '继续上次');
      return;
    }
    _beginExam(e);
  }

  function _beginExam(e) {
    openModal({
      title: '考试须知',
      body: `
        <div style="line-height:2">
          <h3 style="margin-bottom:12px">${escapeHtml(e.title)}</h3>
          <p>📌 考试时长：<strong>${e.duration} 分钟</strong></p>
          <p>📌 题目数量：<strong>${e.questionIds.length} 题</strong></p>
          <p>📌 总分：<strong>${e.totalScore} 分</strong>，及格线：<strong>${e.passScore}%</strong></p>
          <p>📌 剩余考试次数：<strong>${e.maxAttempts - DB.getRecordsByUser(App.currentUser.id).filter(r => r.examId === e.id).length} 次</strong></p>
          ${e.randomOrder ? '<p>📌 题目顺序将随机打乱</p>' : ''}
          <p>📌 支持断线续考：如意外关闭，可重新进入继续答题</p>
          <p>📌 倒计时结束将自动提交</p>
        </div>
        <div style="margin-top:16px;padding:12px;background:var(--warning-light);border-radius:8px;color:var(--warning);font-size:13px">
          ⚠️ 请确保网络稳定，关闭页面不会丢失已答内容（自动保存）。
        </div>
      `,
      okText: '开始考试',
      cancelText: '取消',
      onOk: () => {
        Exam.start(e);
        return true;
      }
    });
  }

  function resumeExam(examId) {
    const e = DB.getExamById(examId);
    const ip = DB.getInProgressByExam(App.currentUser.id, examId);
    if (e && ip) Exam.resume(e, ip);
  }

  function viewHistory(examId) {
    const e = DB.getExamById(examId);
    const records = DB.getRecordsByUser(App.currentUser.id).filter(r => r.examId === examId).sort((a, b) => b.submittedAt - a.submittedAt);
    openModal({
      title: `「${e.title}」考试历史`,
      size: 'lg',
      body: `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>次序</th><th>得分</th><th>得分率</th><th>结果</th><th>用时</th><th>提交时间</th><th>操作</th></tr></thead>
            <tbody>
              ${records.map((r, i) => {
                const pct = Math.round(r.score / r.totalScore * 100);
                const mins = Math.round(r.duration / 60);
                return `<tr>
                  <td>第 ${i + 1} 次</td>
                  <td><strong>${r.score}</strong> / ${r.totalScore}</td>
                  <td>${pct}%</td>
                  <td><span class="badge ${r.passed ? 'badge-success' : 'badge-danger'}">${r.passed ? '通过' : '未通过'}</span></td>
                  <td>${mins} 分钟</td>
                  <td>${formatDateTime(r.submittedAt)}</td>
                  <td><button class="btn btn-sm btn-secondary" onclick="Employee.viewRecord('${r.id}')">查看</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `,
      okText: '关闭',
      cancelHidden: true,
      onOk: () => true
    });
  }

  // ---------- 我的成绩 ----------
  function myResults() {
    const uid = App.currentUser.id;
    const records = DB.getRecordsByUser(uid).sort((a, b) => b.submittedAt - a.submittedAt);
    const passed = records.filter(r => r.passed).length;
    const avgScore = records.length ? Math.round(records.reduce((s, r) => s + (r.score / r.totalScore * 100), 0) / records.length) : 0;
    const passRate = records.length ? Math.round(passed / records.length * 100) : 0;

    return `
      <div class="page-header">
        <div>
          <h2>我的成绩</h2>
          <div class="subtitle">查看历史考试记录与成绩分析</div>
        </div>
        <button class="btn btn-secondary" onclick="Employee.exportMyResults()">⬇️ 导出成绩单</button>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon blue">📊</div><div><div class="stat-value">${records.length}</div><div class="stat-label">考试次数</div></div></div>
        <div class="stat-card"><div class="stat-icon green">✅</div><div><div class="stat-value">${passed}</div><div class="stat-label">通过次数</div></div></div>
        <div class="stat-card"><div class="stat-icon ${avgScore >= 60 ? 'green' : 'red'}">📈</div><div><div class="stat-value">${avgScore}%</div><div class="stat-label">平均得分率</div></div></div>
        <div class="stat-card"><div class="stat-icon ${passRate >= 60 ? 'green' : 'orange'}">🎯</div><div><div class="stat-value">${passRate}%</div><div class="stat-label">通过率</div></div></div>
      </div>
      ${records.length === 0 ? emptyState('📊', '暂无考试记录，去参加一场考试吧') : `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>考试名称</th><th>得分</th><th>得分率</th><th>结果</th><th>用时</th><th>提交时间</th><th>操作</th></tr></thead>
          <tbody>
            ${records.map(r => {
              const pct = Math.round(r.score / r.totalScore * 100);
              const mins = Math.round(r.duration / 60);
              return `<tr>
                <td><strong>${escapeHtml(r.examTitle)}</strong></td>
                <td>${r.score} / ${r.totalScore}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <div style="width:80px;height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">
                      <div style="width:${pct}%;height:100%;background:${pct >= r.passScore ? 'var(--success)' : 'var(--danger)'}"></div>
                    </div>
                    ${pct}%
                  </div>
                </td>
                <td><span class="badge ${r.passed ? 'badge-success' : 'badge-danger'}">${r.passed ? '通过' : '未通过'}</span></td>
                <td>${mins} 分</td>
                <td>${formatDateTime(r.submittedAt)}</td>
                <td><button class="btn btn-sm btn-secondary" onclick="Employee.viewRecord('${r.id}')">📋 详情</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`}
    `;
  }

  function viewRecord(recordId) {
    Reports.viewRecord(recordId);
  }

  function exportMyResults() {
    const records = DB.getRecordsByUser(App.currentUser.id);
    if (!records.length) { toast('暂无成绩可导出', 'error'); return; }
    Reports.exportRecords(records, `我的成绩单_${App.currentUser.name}`);
  }

  return {
    home, learnCenter, setLearnFilter, openMaterial, downloadMaterial,
    exams, startExam, resumeExam, viewHistory,
    myResults, viewRecord, exportMyResults,
  };
})();
