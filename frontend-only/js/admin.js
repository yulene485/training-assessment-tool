/* ============================================================
   管理员功能模块
   - 仪表盘概览
   - 培训资料管理（上传、分类、编辑、删除）
   - 题库管理（单选/多选/判断）
   - 考试配置（参与人员选择、时间设置、草稿/发布）
   - 管理员管理（总管理员专属）
   - 操作日志（总管理员专属）
   ============================================================ */

const Admin = (() => {

  // ---------- 仪表盘 ----------
  function dashboard() {
    const users = DB.getUsers().filter(u => u.role === 'employee');
    const materials = DB.getMaterials();
    const questions = DB.getQuestions();
    const exams = DB.getExams();
    const records = DB.getRecords();
    const passed = records.filter(r => r.passed).length;
    const avgScore = records.length ? Math.round(records.reduce((s, r) => s + r.score, 0) / records.length) : 0;
    const passRate = records.length ? Math.round(passed / records.length * 100) : 0;
    const isSuperAdmin = App.currentUser.role === 'super_admin';

    return `
      <div class="page-header">
        <div>
          <h2>管理后台概览</h2>
          <div class="subtitle">${isSuperAdmin ? '总管理员 · 最高权限' : '管理员 · ' + escapeHtml(App.currentUser.dept || '')}</div>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue">👥</div>
          <div><div class="stat-value">${users.length}</div><div class="stat-label">员工总数</div></div>
        </div>
        ${isSuperAdmin ? `<div class="stat-card"><div class="stat-icon purple">🛡️</div><div><div class="stat-value">${DB.getAdmins().length}</div><div class="stat-label">管理员数</div></div></div>` : ''}
        <div class="stat-card">
          <div class="stat-icon green">📚</div>
          <div><div class="stat-value">${materials.length}</div><div class="stat-label">培训资料</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange">📝</div>
          <div><div class="stat-value">${questions.length}</div><div class="stat-label">题库题目</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon cyan">📋</div>
          <div><div class="stat-value">${exams.length}</div><div class="stat-label">考试场次</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">✅</div>
          <div><div class="stat-value">${records.length}</div><div class="stat-label">考试记录</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange">📊</div>
          <div><div class="stat-value">${avgScore}</div><div class="stat-label">平均分</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon ${passRate >= 60 ? 'green' : 'red'}">🎯</div>
          <div><div class="stat-value">${passRate}%</div><div class="stat-label">及格率</div></div>
        </div>
      </div>
      <div class="chart-grid">
        <div class="chart-card">
          <h4>近 7 天考试趋势</h4>
          <div class="chart-wrapper"><canvas id="trendChart"></canvas></div>
        </div>
        <div class="chart-card">
          <h4>分类资料分布</h4>
          <div class="chart-wrapper"><canvas id="catChart"></canvas></div>
        </div>
      </div>
      <div style="margin-top:20px">
        <div class="card" style="padding:20px">
          <h4 style="margin-bottom:12px">快捷操作</h4>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="App.navigate('materials')">📚 管理培训资料</button>
            <button class="btn btn-primary" onclick="App.navigate('questions')">📝 管理题库</button>
            <button class="btn btn-primary" onclick="App.navigate('exams')">📋 配置考试</button>
            <button class="btn btn-primary" onclick="App.navigate('records')">📊 成绩管理</button>
            ${isSuperAdmin ? `<button class="btn btn-secondary" onclick="App.navigate('adminMgmt')">🛡️ 管理员管理</button>` : ''}
            ${isSuperAdmin ? `<button class="btn btn-secondary" onclick="App.navigate('logs')">📜 操作日志</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function renderDashboardCharts() {
    const records = DB.getRecords();
    const days = [];
    const labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toDateString();
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
      days.push(records.filter(r => new Date(r.submittedAt).toDateString() === key).length);
    }
    const tCtx = document.getElementById('trendChart');
    if (tCtx) {
      new Chart(tCtx, {
        type: 'line',
        data: { labels, datasets: [{ label: '考试人次', data: days, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
      });
    }
    const cats = DB.getCategories();
    const cCtx = document.getElementById('catChart');
    if (cCtx) {
      new Chart(cCtx, {
        type: 'doughnut',
        data: { labels: cats.map(c => c.name), datasets: [{ data: cats.map(c => DB.getMaterialsByCategory(c.id).length), backgroundColor: ['#2563eb', '#16a34a', '#d97706', '#0891b2', '#7c3aed', '#dc2626'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
      });
    }
  }

  // ---------- 管理员管理（总管理员专属） ----------
  function adminMgmt() {
    if (App.currentUser.role !== 'super_admin') {
      return emptyState('🛡️', '此功能仅总管理员可访问');
    }
    const admins = DB.getAdmins();
    const allDepts = DB.getDepartments();
    const cats = DB.getCategories();
    return `
      <div class="page-header">
        <div>
          <h2>管理员管理</h2>
          <div class="subtitle">创建、编辑下级管理员，分配管理范围</div>
        </div>
        <button class="btn btn-primary" onclick="Admin.adminModal()">➕ 添加管理员</button>
      </div>
      ${admins.length === 0 ? emptyState('🛡️', '暂无下级管理员，点击右上角添加') : `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>姓名</th><th>用户名</th><th>部门</th><th>职位</th><th>管理范围</th><th>操作日志</th><th>创建时间</th><th>操作</th></tr></thead>
          <tbody>
            ${admins.map(a => {
              const scopeText = a.scope === 'all' ? '全部分类' : (a.scope ? a.scope.split(',').map(sid => {
                const c = DB.getCategoryById(sid);
                return c ? c.icon + ' ' + c.name : sid;
              }).join('、') : '未分配');
              const logCount = DB.getLogs().filter(l => l.userId === a.id).length;
              return `<tr>
                <td><strong>${escapeHtml(a.name)}</strong></td>
                <td>${a.username}</td>
                <td>${escapeHtml(a.dept || '-')}</td>
                <td>${escapeHtml(a.position || '-')}</td>
                <td><span class="badge badge-info">${scopeText}</span></td>
                <td>${logCount} 条</td>
                <td>${formatDate(a.createdAt)}</td>
                <td><div class="actions">
                  <button class="btn btn-sm btn-secondary" onclick="Admin.adminModal('${a.id}')">✏️ 编辑</button>
                  <button class="btn btn-sm btn-danger" onclick="Admin.delAdmin('${a.id}')">🗑️ 删除</button>
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`}
    `;
  }

  function adminModal(id) {
    const a = id ? DB.getUserById(id) : null;
    const cats = DB.getCategories();
    const depts = DB.getDepartments();
    openModal({
      title: a ? '编辑管理员' : '添加管理员',
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">姓名 <span class="required">*</span></label>
            <input type="text" class="form-input" id="a_name" value="${a ? escapeAttr(a.name) : ''}" placeholder="管理员姓名" />
          </div>
          <div class="form-group">
            <label class="form-label">用户名 <span class="required">*</span></label>
            <input type="text" class="form-input" id="a_username" value="${a ? escapeAttr(a.username) : ''}" ${a ? 'readonly' : ''} placeholder="登录用户名" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">初始密码 <span class="required">*</span></label>
            <input type="text" class="form-input" id="a_password" value="${a ? escapeAttr(a.password) : 'admin123'}" placeholder="设置密码" />
          </div>
          <div class="form-group">
            <label class="form-label">部门</label>
            <input type="text" class="form-input" id="a_dept" value="${a ? escapeAttr(a.dept || '') : ''}" placeholder="如：人力资源部" list="dept_list" />
            <datalist id="dept_list">${depts.map(d => `<option value="${escapeAttr(d)}">`).join('')}</datalist>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">职位</label>
            <input type="text" class="form-input" id="a_position" value="${a ? escapeAttr(a.position || '') : ''}" placeholder="如：培训主管" />
          </div>
          <div class="form-group">
            <label class="form-label">工号</label>
            <input type="text" class="form-input" id="a_jobNumber" value="${a ? escapeAttr(a.jobNumber || '') : ''}" placeholder="如：A002" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">管理范围 <span class="required">*</span></label>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
              <input type="radio" name="a_scope_type" value="all" ${a && a.scope === 'all' ? 'checked' : ''} onchange="Admin.toggleScopeSelect()" style="width:18px;height:18px" />
              <span>全部分类</span>
            </label>
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
              <input type="radio" name="a_scope_type" value="select" ${!a || a.scope !== 'all' ? 'checked' : ''} onchange="Admin.toggleScopeSelect()" style="width:18px;height:18px" />
              <span>指定分类</span>
            </label>
          </div>
          <div id="a_scope_select" style="${a && a.scope === 'all' ? 'display:none' : ''}">
            ${cats.map(c => `
              <label style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border:1px solid var(--border);border-radius:6px;margin:4px;cursor:pointer">
                <input type="checkbox" class="a_scope_cat" value="${c.id}" ${a && a.scope && a.scope.split(',').includes(c.id) ? 'checked' : ''} style="width:16px;height:16px" />
                <span>${c.icon} ${c.name}</span>
              </label>
            `).join('')}
          </div>
          <div class="form-hint">管理范围决定该管理员可见和可操作的培训分类内容</div>
        </div>
      `,
      onOk: () => {
        const name = document.getElementById('a_name').value.trim();
        const username = document.getElementById('a_username').value.trim();
        const password = document.getElementById('a_password').value.trim();
        if (!name || !username) { toast('请填写姓名和用户名', 'error'); return false; }
        if (!password) { toast('请设置密码', 'error'); return false; }

        const scopeType = document.querySelector('input[name="a_scope_type"]:checked').value;
        let scope = '';
        if (scopeType === 'all') scope = 'all';
        else scope = Array.from(document.querySelectorAll('.a_scope_cat:checked')).map(c => c.value).join(',');

        const data = {
          name, username, password,
          role: 'admin',
          dept: document.getElementById('a_dept').value.trim(),
          position: document.getElementById('a_position').value.trim(),
          jobNumber: document.getElementById('a_jobNumber').value.trim(),
          scope,
        };
        if (a) { DB.updateUser(id, data); DB.addLog('update_admin', id, `编辑管理员「${name}」`); toast('管理员已更新', 'success'); }
        else {
          if (DB.getUsers().some(x => x.username === username)) { toast('用户名已存在', 'error'); return false; }
          DB.addUser(data); DB.addLog('create_admin', '', `创建管理员「${name}」`); toast('管理员已添加', 'success');
        }
        App.render();
        return true;
      }
    });
  }

  function toggleScopeSelect() {
    const type = document.querySelector('input[name="a_scope_type"]:checked').value;
    const el = document.getElementById('a_scope_select');
    if (el) el.style.display = type === 'all' ? 'none' : '';
  }

  function delAdmin(id) {
    const a = DB.getUserById(id);
    if (!a) return;
    confirmDialog(`确定删除管理员「${a.name}」吗？其操作日志将保留。`, () => {
      DB.deleteUser(id);
      DB.addLog('delete_admin', id, `删除管理员「${a.name}」`);
      toast('管理员已删除', 'success');
      App.render();
    });
  }

  // ---------- 操作日志（总管理员专属） ----------
  function logs() {
    if (App.currentUser.role !== 'super_admin') {
      return emptyState('📜', '此功能仅总管理员可访问');
    }
    const allLogs = DB.getLogs().sort((a, b) => b.createdAt - a.createdAt);
    const actionLabels = {
      create_admin: '创建管理员', update_admin: '编辑管理员', delete_admin: '删除管理员',
      create_exam: '创建考试', update_exam: '编辑考试', delete_exam: '删除考试',
      publish_exam: '发布考试', draft_exam: '保存草稿',
      create_material: '上传资料', update_material: '编辑资料', delete_material: '删除资料',
      create_question: '新增题目', update_question: '编辑题目', delete_question: '删除题目',
      login: '登录系统', logout: '退出系统',
    };
    return `
      <div class="page-header">
        <div>
          <h2>操作日志</h2>
          <div class="subtitle">查看所有管理员的操作记录</div>
        </div>
      </div>
      ${allLogs.length === 0 ? emptyState('📜', '暂无操作日志') : `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>时间</th><th>操作人</th><th>操作类型</th><th>操作详情</th></tr></thead>
          <tbody>
            ${allLogs.slice(0, 200).map(l => `
              <tr>
                <td>${formatDateTime(l.createdAt)}</td>
                <td><strong>${escapeHtml(l.userName)}</strong></td>
                <td><span class="badge badge-info">${actionLabels[l.action] || l.action}</span></td>
                <td>${escapeHtml(l.detail)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`}
    `;
  }

  // ---------- 培训资料管理 ----------
  let materialFilter = { category: '', keyword: '' };

  function materials() {
    let list = DB.getMaterials();
    if (materialFilter.category) list = list.filter(m => m.categoryId === materialFilter.category);
    if (materialFilter.keyword) {
      const kw = materialFilter.keyword.toLowerCase();
      list = list.filter(m => m.title.toLowerCase().includes(kw) || (m.desc || '').toLowerCase().includes(kw));
    }
    const cats = DB.getCategories();
    const typeIcon = { doc: '📄', pdf: '📕', video: '🎬', img: '🖼️', file: '📎' };

    return `
      <div class="page-header">
        <div>
          <h2>培训资料管理</h2>
          <div class="subtitle">上传、分类、管理培训内容（支持多附件上传）</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" onclick="Admin.categoryModal()">🗂️ 管理分类</button>
          <button class="btn btn-primary" onclick="Admin.materialModal()">➕ 上传资料</button>
        </div>
      </div>
      <div class="category-tabs">
        <span class="category-tab ${!materialFilter.category ? 'active' : ''}" onclick="Admin.setMaterialFilter('category','')">全部分类</span>
        ${cats.map(c => `<span class="category-tab ${materialFilter.category === c.id ? 'active' : ''}" onclick="Admin.setMaterialFilter('category','${c.id}')">${c.icon} ${c.name}</span>`).join('')}
      </div>
      <div class="toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="搜索资料标题或描述..." value="${materialFilter.keyword}" oninput="Admin.setMaterialFilter('keyword', this.value)" />
        </div>
        <span class="badge badge-gray">共 ${list.length} 项</span>
      </div>
      ${list.length === 0 ? emptyState('📚', '暂无培训资料，点击右上角上传') : `
      <div class="cards-grid">
        ${list.map(m => {
          const cat = DB.getCategoryById(m.categoryId);
          const size = m.fileSize ? formatSize(m.fileSize) : '-';
          const attachCount = m.attachments ? m.attachments.length : 0;
          const totalSize = m.attachments ? m.attachments.reduce((s, a) => s + (a.fileSize || 0), 0) : (m.fileSize || 0);
          return `
          <div class="material-card">
            <div class="material-thumb ${m.type}">
              ${m.cover
                ? `<img class="cover-img" src="${m.cover}" alt="${escapeAttr(m.title)}" /><span class="thumb-type-badge">${typeIcon[m.type] || '📎'} ${m.type.toUpperCase()}</span>`
                : `<div class="thumb-default">${typeIcon[m.type] || '📎'}</div>`}
            </div>
            <div class="material-body">
              <h4>${escapeHtml(m.title)}</h4>
              <div class="material-meta">
                <span>${cat ? cat.icon + ' ' + cat.name : '未分类'}</span>
                <span>${totalSize ? formatSize(totalSize) : '-'}</span>
                ${attachCount > 1 ? `<span class="badge badge-info">${attachCount} 个附件</span>` : ''}
                <span>${formatDate(m.createdAt)}</span>
              </div>
              <div class="material-desc">${escapeHtml(m.desc || '暂无描述')}</div>
              <div class="material-actions">
                <button class="btn btn-sm btn-secondary" onclick="Admin.previewMaterial('${m.id}')">👁️ 预览</button>
                ${FileUtil.canDownload(m) || (m.attachments && m.attachments.length > 0) ? `<button class="btn btn-sm btn-secondary" onclick="Admin.downloadMaterial('${m.id}')">⬇️ 下载</button>` : ''}
                <button class="btn btn-sm btn-secondary" onclick="Admin.materialModal('${m.id}')">✏️ 编辑</button>
                <button class="btn btn-sm btn-danger" onclick="Admin.delMaterial('${m.id}')">🗑️</button>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`}
    `;
  }

  function setMaterialFilter(key, val) {
    materialFilter[key] = val;
    App.render();
  }

  function materialModal(id) {
    const m = id ? DB.getMaterialById(id) : null;
    const cats = DB.getCategories();
    pendingFile = null;
    pendingAttachments = [];
    pendingCoverDataUrl = m && m.cover ? m.cover : '';
    // 如果编辑，加载已有附件
    if (m && m.attachments && m.attachments.length > 0) {
      pendingAttachments = m.attachments.map(a => ({ ...a, isNew: false }));
    }
    openModal({
      title: m ? '编辑培训资料' : '上传培训资料',
      size: 'lg',
      body: `
        <div class="form-group">
          <label class="form-label">封面图片（可选）</label>
          <div class="cover-upload-area" id="cover_preview_area">
            ${pendingCoverDataUrl
              ? `<img src="${pendingCoverDataUrl}" alt="封面预览" />`
              : `<div class="cover-upload-placeholder"><div class="placeholder-icon">🖼️</div><div>点击下方按钮选择图片</div></div>`}
          </div>
          <input type="file" id="m_cover" accept="image/*" onchange="Admin.handleCoverFile(this)" style="display:none" />
          <div class="cover-actions">
            <button class="btn btn-sm btn-secondary" onclick="document.getElementById('m_cover').click()">📷 选择图片</button>
            <button class="btn btn-sm btn-secondary" id="crop_cover_btn" onclick="Admin.cropCover()" style="${pendingCoverDataUrl ? '' : 'display:none'}">✂️ 裁剪图片</button>
            <button class="btn btn-sm btn-danger" id="remove_cover_btn" onclick="Admin.removeCover()" style="${pendingCoverDataUrl ? '' : 'display:none'}">🗑️ 移除封面</button>
          </div>
          <div class="form-hint">建议上传 16:9 比例的图片，支持裁剪调整。未上传时显示默认占位图。</div>
        </div>
        <div class="form-group">
          <label class="form-label">资料标题 <span class="required">*</span></label>
          <input type="text" class="form-input" id="m_title" value="${m ? escapeAttr(m.title) : ''}" placeholder="请输入资料标题" />
        </div>
        <div class="form-group">
          <label class="form-label">所属分类 <span class="required">*</span></label>
          <select class="form-select" id="m_category">
            ${cats.map(c => `<option value="${c.id}" ${m && m.categoryId === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">资料类型</label>
          <select class="form-select" id="m_type" onchange="Admin.toggleUpload()">
            <option value="doc" ${m && m.type === 'doc' ? 'selected' : ''}>📄 文档 (doc/docx/txt)</option>
            <option value="pdf" ${m && m.type === 'pdf' ? 'selected' : ''}>📕 PDF</option>
            <option value="video" ${m && m.type === 'video' ? 'selected' : ''}>🎬 视频 (mp4/webm)</option>
            <option value="img" ${m && m.type === 'img' ? 'selected' : ''}>🖼️ 图片</option>
            <option value="file" ${m && m.type === 'file' ? 'selected' : ''}>📎 其他文件</option>
          </select>
        </div>
        <!-- 多附件上传 -->
        <div class="form-group">
          <label class="form-label">上传附件（支持多文件）</label>
          <input type="file" id="m_files" multiple onchange="Admin.handleMultipleFiles(this)" style="display:none" />
          <div style="display:flex;gap:8px;margin-bottom:8px">
            <button class="btn btn-sm btn-secondary" onclick="document.getElementById('m_files').click()">📎 选择文件（可多选）</button>
            <span class="badge badge-gray" id="m_attach_count">${pendingAttachments.length} 个附件</span>
          </div>
          <div id="m_attachment_list" style="max-height:200px;overflow-y:auto">
            ${pendingAttachments.map((a, i) => `
              <div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border);border-radius:6px;margin-bottom:4px" class="m-attach-item">
                <span style="font-size:20px">${typeIcon[a.type] || '📎'}</span>
                <div style="flex:1">
                  <div style="font-weight:500">${escapeHtml(a.fileName || a.name || '附件')}</div>
                  <div style="font-size:12px;color:var(--text-muted)">${a.fileSize ? formatSize(a.fileSize) : '-'}${a.type ? ' · ' + a.type.toUpperCase() : ''}</div>
                </div>
                <button class="btn btn-sm btn-danger" onclick="Admin.removeAttachment(${i})">✕</button>
              </div>
            `).join('') || '<div style="color:var(--text-muted);font-size:13px;padding:8px">暂无附件，点击上方按钮选择文件</div>'}
          </div>
          <div class="form-hint">可同时上传多个附件文件，各类型均可。第一个附件将作为主文件用于预览和下载。</div>
        </div>
        <div class="form-group" id="url_group" style="display:none">
          <label class="form-label">视频在线地址</label>
          <input type="text" class="form-input" id="m_url" value="${m && m.url ? escapeAttr(m.url) : ''}" placeholder="https://..." />
        </div>
        <div class="form-group" id="content_group">
          <label class="form-label">文本内容（文档类可直接填写，作为预览内容）</label>
          <textarea class="form-textarea" id="m_content" rows="6" placeholder="可填写文档正文内容用于在线预览...">${m && m.content ? escapeHtml(m.content) : ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">资料描述</label>
          <textarea class="form-textarea" id="m_desc" rows="3" placeholder="简要描述资料内容...">${m && m.desc ? escapeHtml(m.desc) : ''}</textarea>
        </div>
      `,
      onOk: () => {
        const title = document.getElementById('m_title').value.trim();
        if (!title) { toast('请输入资料标题', 'error'); return false; }
        const type = document.getElementById('m_type').value;
        // 处理附件
        const processAttachments = () => {
          const attachments = pendingAttachments.map(a => {
            if (a.isNew && a._file) {
              return { fileName: a._file.name, fileSize: a._file.size, type: a.type, name: a._file.name };
            }
            return { fileName: a.fileName, fileSize: a.fileSize, type: a.type, fileData: a.fileData, url: a.url, content: a.content };
          });
          return attachments;
        };
        const attachments = processAttachments();
        // 使用 FormData 上传文件到后端 API
        const apiBase = window.API_BASE || '';
        const token = DB.getToken();
        const formData = new FormData();
        formData.append('title', title);
        formData.append('categoryId', document.getElementById('m_category').value);
        formData.append('type', type);
        formData.append('url', document.getElementById('m_url') ? document.getElementById('m_url').value.trim() : '');
        formData.append('content', document.getElementById('m_content').value);
        formData.append('desc', document.getElementById('m_desc').value.trim());
        formData.append('cover', pendingCoverDataUrl);
        formData.append('attachments', JSON.stringify(attachments));
        // 主文件（第一个附件）
        if (pendingAttachments.length > 0) {
          const mainAttach = pendingAttachments[0];
          if (mainAttach.isNew && mainAttach._file) {
            formData.append('file', mainAttach._file);
          }
        }
        // 异步上传
        const url = m ? apiBase + '/api/materials/' + id : apiBase + '/api/materials';
        const method = m ? 'PUT' : 'POST';
        fetch(url, {
          method,
          headers: { 'Authorization': 'Bearer ' + token },
          body: formData,
        }).then(res => {
          if (!res.ok) throw new Error('上传失败');
          return res.json();
        }).then(saved => {
          // 更新本地缓存
          if (m) {
            const i = DB.getAllMaterials().findIndex(x => x.id === id);
            if (i !== -1) Object.assign(DB.getAllMaterials()[i], saved);
            DB.addLog('update_material', id, `编辑资料「${title}」`);
            toast('资料已更新', 'success');
          } else {
            DB.getAllMaterials().push(saved);
            DB.addLog('create_material', '', `上传资料「${title}」`);
            toast('资料上传成功', 'success');
          }
          DB.reload().then(() => App.render());
        }).catch(err => {
          toast('资料上传失败: ' + err.message, 'error');
        });
        pendingFile = null;
        pendingAttachments = [];
        return true;
      }
    });
    toggleUpload();
    if (m && m.type === 'video') toggleUpload();
  }

  function toggleUpload() {
    const type = document.getElementById('m_type');
    if (!type) return;
    const v = type.value;
    document.getElementById('url_group').style.display = v === 'video' ? 'block' : 'none';
    document.getElementById('content_group').style.display = (v === 'doc' || v === 'pdf') ? 'block' : 'none';
  }

  let pendingFile = null;
  let pendingAttachments = [];
  function handleFile(input) {
    const file = input.files[0];
    if (!file) return;
    pendingFile = file;
    toast(`已选择: ${file.name} (${formatSize(file.size)})`, 'success');
  }

  function handleMultipleFiles(input) {
    const files = input.files;
    if (!files || files.length === 0) return;
    for (const file of files) {
      if (file.size > FileUtil.MAX_FILE_SIZE) { toast(`${file.name} 超过 50MB 限制，已跳过`, 'warning'); continue; }
      // 推断类型
      let type = 'file';
      if (file.type.startsWith('video/')) type = 'video';
      else if (file.type === 'application/pdf') type = 'pdf';
      else if (file.type.startsWith('image/')) type = 'img';
      else if (file.type.includes('word') || file.type.includes('text') || file.name.endsWith('.doc') || file.name.endsWith('.docx') || file.name.endsWith('.txt')) type = 'doc';
      pendingAttachments.push({ fileName: file.name, fileSize: file.size, type, name: file.name, isNew: true, _file: file });
    }
    renderAttachmentList();
    toast(`已添加 ${files.length} 个附件`, 'success');
  }

  function renderAttachmentList() {
    const listDiv = document.getElementById('m_attachment_list');
    if (!listDiv) return;
    const typeIconLocal = { doc: '📄', pdf: '📕', video: '🎬', img: '🖼️', file: '📎' };
    listDiv.innerHTML = pendingAttachments.map((a, i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border);border-radius:6px;margin-bottom:4px" class="m-attach-item">
        <span style="font-size:20px">${typeIconLocal[a.type] || '📎'}</span>
        <div style="flex:1">
          <div style="font-weight:500">${escapeHtml(a.fileName || a.name || '附件')}</div>
          <div style="font-size:12px;color:var(--text-muted)">${a.fileSize ? formatSize(a.fileSize) : '-'}${a.type ? ' · ' + a.type.toUpperCase() : ''}</div>
        </div>
        <button class="btn btn-sm btn-danger" onclick="Admin.removeAttachment(${i})">✕</button>
      </div>
    `).join('') || '<div style="color:var(--text-muted);font-size:13px;padding:8px">暂无附件</div>';
    const countBadge = document.getElementById('m_attach_count');
    if (countBadge) countBadge.textContent = `${pendingAttachments.length} 个附件`;
  }

  function removeAttachment(index) {
    pendingAttachments.splice(index, 1);
    renderAttachmentList();
  }

  // ---------- 封面图片 ----------
  let pendingCoverDataUrl = '';
  let cropperInstance = null;

  function handleCoverFile(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('封面图片不能超过 5MB', 'error'); return; }
    if (!file.type.startsWith('image/')) { toast('请选择图片文件', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      pendingCoverDataUrl = e.target.result;
      const area = document.getElementById('cover_preview_area');
      if (area) area.innerHTML = `<img src="${pendingCoverDataUrl}" alt="封面预览" />`;
      const cropBtn = document.getElementById('crop_cover_btn');
      const removeBtn = document.getElementById('remove_cover_btn');
      if (cropBtn) cropBtn.style.display = '';
      if (removeBtn) removeBtn.style.display = '';
      toast('图片已选择，建议点击裁剪调整比例', 'success');
    };
    reader.readAsDataURL(file);
  }

  function cropCover() {
    if (!pendingCoverDataUrl) return;
    openModal({
      title: '裁剪封面图片',
      size: 'lg',
      body: `<div class="crop-modal-body"><img id="crop_image" src="${pendingCoverDataUrl}" /></div>
             <div class="form-hint" style="margin-top:8px">拖动裁剪框调整范围，裁剪比例为 16:9，确保各页面展示比例统一</div>`,
      okText: '确认裁剪',
      cancelText: '取消',
      onOk: () => {
        if (!cropperInstance) return true;
        const canvas = cropperInstance.getCroppedCanvas({ width: 480, height: 270, maxWidth: 960, maxHeight: 540 });
        if (canvas) {
          pendingCoverDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const area = document.getElementById('cover_preview_area');
          if (area) area.innerHTML = `<img src="${pendingCoverDataUrl}" alt="封面预览" />`;
          toast('封面已裁剪', 'success');
        }
        cropperInstance.destroy();
        cropperInstance = null;
        return true;
      },
      onCancel: () => {
        if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
      },
      onShown: () => {
        const img = document.getElementById('crop_image');
        if (img && typeof Cropper !== 'undefined') {
          cropperInstance = new Cropper(img, {
            aspectRatio: 16 / 9,
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.9,
            responsive: true,
            background: false,
          });
        }
      }
    });
  }

  function removeCover() {
    pendingCoverDataUrl = '';
    const area = document.getElementById('cover_preview_area');
    if (area) area.innerHTML = `<div class="cover-upload-placeholder"><div class="placeholder-icon">🖼️</div><div>点击下方按钮选择图片</div></div>`;
    const cropBtn = document.getElementById('crop_cover_btn');
    const removeBtn = document.getElementById('remove_cover_btn');
    if (cropBtn) cropBtn.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'none';
    const fileInput = document.getElementById('m_cover');
    if (fileInput) fileInput.value = '';
    toast('封面已移除', 'info');
  }

  function previewMaterial(id) {
    const m = DB.getMaterialById(id);
    if (!m) return;
    const typeIcon = { doc: '📄', pdf: '📕', video: '🎬', img: '🖼️', file: '📎' };
    const cat = DB.getCategoryById(m.categoryId);
    const attachCount = m.attachments ? m.attachments.length : 0;
    openModal({
      title: m.title,
      size: 'lg',
      body: `
        <div style="margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <span class="badge badge-primary">${cat ? cat.icon + ' ' + cat.name : '未分类'}</span>
          <span class="badge badge-gray">${typeIcon[m.type]} ${m.type.toUpperCase()}</span>
          ${m.fileSize ? `<span class="badge badge-gray">${formatSize(m.fileSize)}</span>` : ''}
          ${m.fileName ? `<span class="badge badge-gray">📄 ${escapeHtml(m.fileName)}</span>` : ''}
          ${attachCount > 1 ? `<span class="badge badge-info">${attachCount} 个附件</span>` : ''}
        </div>
        ${FileUtil.previewHtml(m)}
        ${FileUtil.canDownload(m) ? `<div style="margin-top:14px;text-align:center"><button class="btn btn-secondary" onclick="Admin.downloadMaterial('${m.id}')">⬇️ 下载主文件</button></div>` : ''}
        ${attachCount > 1 ? `
        <div style="margin-top:16px">
          <h4 style="margin-bottom:10px">📎 全部附件列表</h4>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${m.attachments.map((a, i) => `
              <div style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid var(--border);border-radius:6px">
                <span style="font-size:18px">${typeIcon[a.type] || '📎'}</span>
                <div style="flex:1">
                  <div style="font-weight:500">${escapeHtml(a.fileName || '附件' + (i+1))}</div>
                  <div style="font-size:12px;color:var(--text-muted)">${a.fileSize ? formatSize(a.fileSize) : '-'} · ${a.type ? a.type.toUpperCase() : 'FILE'}</div>
                </div>
                ${(a.fileData || a.url || a.content) ? `<button class="btn btn-sm btn-secondary" onclick="Admin.downloadAttachment('${m.id}', ${i})">⬇️</button>` : ''}
              </div>
            `).join('')}
          </div>
        </div>` : ''}
      `,
      okText: '关闭',
      cancelHidden: true,
      onOk: () => true
    });
  }

  function downloadAttachment(materialId, attachIndex) {
    const m = DB.getMaterialById(materialId);
    if (!m || !m.attachments[attachIndex]) return;
    const a = m.attachments[attachIndex];
    if (a.fileData) {
      const blob = FileUtil.dataURLtoBlob ? FileUtil.dataURLtoBlob(a.fileData) : dataURLtoBlobLocal(a.fileData);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = a.fileName || '附件';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
      toast('开始下载', 'success');
    } else if (a.url) {
      const link = document.createElement('a');
      link.href = a.url;
      link.download = a.fileName || '附件';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast('开始下载', 'success');
    } else if (a.content) {
      const blob = new Blob([a.content], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = (a.fileName || '文档') + '.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
      toast('开始下载', 'success');
    } else {
      toast('该附件暂不支持下载', 'warning');
    }
  }

  function dataURLtoBlobLocal(dataURL) {
    const parts = dataURL.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const b64 = atob(parts[1]);
    const arr = new Uint8Array(b64.length);
    for (let i = 0; i < b64.length; i++) arr[i] = b64.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function downloadMaterial(id) {
    const m = DB.getMaterialById(id);
    if (!m) return;
    if (FileUtil.download(m)) toast('开始下载', 'success');
    else toast('该资料暂不支持下载', 'warning');
  }

  function delMaterial(id) {
    const m = DB.getMaterialById(id);
    confirmDialog(`确定删除资料「${m.title}」吗？删除后所有用户将不再看到此资料。`, () => {
      DB.softDeleteMaterial(id);
      DB.addLog('delete_material', id, `删除资料「${m.title}」`);
      toast('资料已删除，所有用户将不再可见', 'success');
      App.render();
    });
  }

  // ---------- 分类管理 ----------
  function categoryModal() {
    const cats = DB.getCategories();
    openModal({
      title: '管理分类',
      body: `
        <div id="cat_list">
          ${cats.map(c => `
            <div style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid var(--border);border-radius:6px;margin-bottom:8px">
              <input type="text" value="${c.icon}" style="width:40px;text-align:center" class="form-input cat-icon" data-id="${c.id}" />
              <input type="text" value="${escapeAttr(c.name)}" class="form-input cat-name" data-id="${c.id}" style="flex:1" />
              <button class="btn btn-sm btn-success" onclick="Admin.saveCat('${c.id}')">保存</button>
              <button class="btn btn-sm btn-danger" onclick="Admin.delCat('${c.id}')">删除</button>
            </div>
          `).join('')}
        </div>
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
          <h4 style="margin-bottom:10px">添加新分类</h4>
          <div style="display:flex;gap:8px">
            <input type="text" id="new_cat_icon" placeholder="🎯" class="form-input" style="width:60px;text-align:center" />
            <input type="text" id="new_cat_name" placeholder="分类名称" class="form-input" style="flex:1" />
            <button class="btn btn-primary" onclick="Admin.addCat()">添加</button>
          </div>
        </div>
      `,
      okText: '完成',
      cancelHidden: true,
      onOk: () => { App.render(); return true; }
    });
  }
  function addCat() {
    const icon = document.getElementById('new_cat_icon').value.trim() || '📁';
    const name = document.getElementById('new_cat_name').value.trim();
    if (!name) { toast('请输入分类名称', 'error'); return; }
    DB.addCategory({ icon, name, count: 0 });
    toast('分类已添加', 'success');
    categoryModal();
  }
  function saveCat(id) {
    const icon = document.querySelector(`.cat-icon[data-id="${id}"]`).value.trim() || '📁';
    const name = document.querySelector(`.cat-name[data-id="${id}"]`).value.trim();
    if (!name) { toast('分类名称不能为空', 'error'); return; }
    DB.updateCategory(id, { icon, name });
    toast('分类已更新', 'success');
  }
  function delCat(id) {
    const mats = DB.getMaterialsByCategory(id);
    if (mats.length) { toast(`该分类下有 ${mats.length} 个资料，无法删除`, 'error'); return; }
    confirmDialog('确定删除该分类吗？', () => { DB.deleteCategory(id); toast('已删除', 'success'); categoryModal(); });
  }

  // ---------- 题库管理 ----------
  let questionFilter = { category: '', type: '', keyword: '' };
  const typeLabels = { single: '单选题', multiple: '多选题', judge: '判断题', short_answer: '简答题', essay: '论述题' };
  const typeIcons = { single: '🔘', multiple: '☑️', judge: '⚖️', short_answer: '✍️', essay: '📝' };
  const subjectiveTypes = ['short_answer', 'essay'];

  function questions() {
    let list = DB.getQuestions();
    if (questionFilter.category) list = list.filter(q => q.categoryId === questionFilter.category);
    if (questionFilter.type) list = list.filter(q => q.type === questionFilter.type);
    if (questionFilter.keyword) {
      const kw = questionFilter.keyword.toLowerCase();
      list = list.filter(q => q.stem.toLowerCase().includes(kw));
    }
    const cats = DB.getCategories();
    return `
      <div class="page-header">
        <div>
          <h2>题库管理</h2>
          <div class="subtitle">管理考试题目，支持单选/多选/判断/简答/论述题</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" onclick="Admin.batchImportModal()">📥 批量导入</button>
          <button class="btn btn-primary" onclick="Admin.questionModal()">➕ 新增题目</button>
        </div>
      </div>
      <div class="toolbar">
        <select class="form-select" style="width:auto" onchange="Admin.setQFilter('category', this.value)">
          <option value="">全部分类</option>
          ${cats.map(c => `<option value="${c.id}" ${questionFilter.category === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
        <select class="form-select" style="width:auto" onchange="Admin.setQFilter('type', this.value)">
          <option value="">全部题型</option>
          <option value="single" ${questionFilter.type === 'single' ? 'selected' : ''}>单选题</option>
          <option value="multiple" ${questionFilter.type === 'multiple' ? 'selected' : ''}>多选题</option>
          <option value="judge" ${questionFilter.type === 'judge' ? 'selected' : ''}>判断题</option>
          <option value="short_answer" ${questionFilter.type === 'short_answer' ? 'selected' : ''}>简答题</option>
          <option value="essay" ${questionFilter.type === 'essay' ? 'selected' : ''}>论述题</option>
        </select>
        <div class="search-box" style="flex:1;max-width:300px">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="搜索题干..." value="${questionFilter.keyword}" oninput="Admin.setQFilter('keyword', this.value)" />
        </div>
        <button class="btn btn-sm btn-danger" onclick="Admin.batchDeleteQuestions()" id="batch_del_btn" style="display:none">🗑️ 批量删除选中</button>
        <span class="badge badge-gray">共 ${list.length} 题</span>
      </div>
      ${list.length === 0 ? emptyState('📝', '暂无题目，点击右上角新增或批量导入') : `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th><input type="checkbox" id="q_batch_all" onchange="Admin.toggleBatchAll()" style="width:18px;height:18px" /></th><th>题目</th><th>题型</th><th>分类</th><th>分值</th><th>参考答案</th><th>创建时间</th><th>操作</th></tr></thead>
          <tbody>
            ${list.map(q => {
              const cat = DB.getCategoryById(q.categoryId);
              const isSubjective = subjectiveTypes.includes(q.type);
              return `<tr>
                <td><input type="checkbox" class="q-batch-check" value="${q.id}" onchange="Admin.updateBatchBtn()" style="width:18px;height:18px" /></td>
                <td style="max-width:400px">${typeIcons[q.type]} ${escapeHtml(q.stem).slice(0, 50)}${q.stem.length > 50 ? '...' : ''}</td>
                <td><span class="badge badge-info">${typeLabels[q.type]}</span></td>
                <td>${cat ? cat.icon + ' ' + cat.name : '-'}</td>
                <td><strong>${q.score}</strong> 分</td>
                <td>${isSubjective ? (q.referenceAnswer ? escapeHtml(q.referenceAnswer).slice(0, 30) + '...' : '<span style="color:var(--text-muted)">未设置</span>') : '-'}</td>
                <td>${formatDate(q.createdAt)}</td>
                <td><div class="actions">
                  <button class="btn btn-sm btn-secondary" onclick="Admin.questionModal('${q.id}')">编辑</button>
                  <button class="btn btn-sm btn-danger" onclick="Admin.delQuestion('${q.id}')">删除</button>
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`}
    `;
  }
  function setQFilter(key, val) { questionFilter[key] = val; App.render(); }

  function questionModal(id) {
    const q = id ? DB.getQuestionById(id) : null;
    const cats = DB.getCategories();
    const type = q ? q.type : 'single';
    const optCount = q ? q.options.length : (type === 'judge' ? 2 : 4);
    const isSubjective = subjectiveTypes.includes(type);
    openModal({
      title: q ? '编辑题目' : '新增题目',
      size: 'lg',
      body: `
        <div class="form-group">
          <label class="form-label">题型 <span class="required">*</span></label>
          <select class="form-select" id="q_type" onchange="Admin.onTypeChange()">
            <option value="single" ${type === 'single' ? 'selected' : ''}>🔘 单选题</option>
            <option value="multiple" ${type === 'multiple' ? 'selected' : ''}>☑️ 多选题</option>
            <option value="judge" ${type === 'judge' ? 'selected' : ''}>⚖️ 判断题</option>
            <option value="short_answer" ${type === 'short_answer' ? 'selected' : ''}>✍️ 简答题</option>
            <option value="essay" ${type === 'essay' ? 'selected' : ''}>📝 论述题</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">所属分类 <span class="required">*</span></label>
          <select class="form-select" id="q_category">
            ${cats.map(c => `<option value="${c.id}" ${q && q.categoryId === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">题干 <span class="required">*</span></label>
          <textarea class="form-textarea" id="q_stem" rows="3" placeholder="请输入题目内容...">${q ? escapeHtml(q.stem) : ''}</textarea>
        </div>
        <div class="form-group" id="q_options_group" style="${isSubjective ? 'display:none' : ''}">
          <label class="form-label">选项 <span class="required">*</span></label>
          <div id="q_options">${renderOptions(q, type)}</div>
          ${!isSubjective && type !== 'judge' ? `<button class="btn btn-sm btn-secondary" onclick="Admin.addOption()" style="margin-top:8px">➕ 添加选项</button>` : ''}
          <div class="form-hint">${type === 'multiple' ? '多选题：勾选所有正确选项' : '单选题/判断题：选择一个正确答案'}</div>
        </div>
        <div class="form-group" id="q_reference_group" style="${isSubjective ? '' : 'display:none'}">
          <label class="form-label">参考答案 <span class="required">*</span></label>
          <textarea class="form-textarea" id="q_reference" rows="${type === 'essay' ? 6 : 4}" placeholder="请输入参考答案，供管理员评分参考...">${q && q.referenceAnswer ? escapeHtml(q.referenceAnswer) : ''}</textarea>
          <div class="form-hint">参考答案仅管理员可见，用于主观题手动评分时的参考依据</div>
        </div>
        <div class="form-group">
          <label class="form-label">分值 <span class="required">*</span></label>
          <input type="number" class="form-input" id="q_score" value="${q ? q.score : 10}" min="1" style="width:120px" /> 分
        </div>
        <div class="form-group">
          <label class="form-label">答案解析</label>
          <textarea class="form-textarea" id="q_analysis" rows="2" placeholder="选填，答题后展示...">${q ? escapeHtml(q.analysis || '') : ''}</textarea>
        </div>
      `,
      onOk: () => {
        const stem = document.getElementById('q_stem').value.trim();
        if (!stem) { toast('请输入题干', 'error'); return false; }
        const newType = document.getElementById('q_type').value;
        const isSubj = subjectiveTypes.includes(newType);

        if (!isSubj) {
          const optInputs = document.querySelectorAll('.opt-input');
          if (optInputs.length < 2) { toast('至少需要 2 个选项', 'error'); return false; }
          const options = Array.from(optInputs).map(i => i.value.trim()).filter(Boolean);
          if (options.length < 2) { toast('选项内容不能为空', 'error'); return false; }
          const answer = Array.from(document.querySelectorAll('.opt-correct:checked')).map(c => parseInt(c.value));
          if (answer.length === 0) { toast('请设置正确答案', 'error'); return false; }
          if (newType === 'single' && answer.length > 1) { toast('单选题只能有一个正确答案', 'error'); return false; }
          const score = parseInt(document.getElementById('q_score').value) || 10;
          const data = {
            type: newType,
            categoryId: document.getElementById('q_category').value,
            stem, options, answer, score,
            analysis: document.getElementById('q_analysis').value.trim(),
            referenceAnswer: '',
          };
          if (q) { DB.updateQuestion(id, data); DB.addLog('update_question', id, `编辑题目「${stem.slice(0,20)}」`); toast('题目已更新', 'success'); }
          else { DB.addQuestion(data); DB.addLog('create_question', '', `新增题目「${stem.slice(0,20)}」`); toast('题目已添加', 'success'); }
        } else {
          const referenceAnswer = document.getElementById('q_reference').value.trim();
          if (!referenceAnswer) { toast('请填写参考答案', 'error'); return false; }
          const score = parseInt(document.getElementById('q_score').value) || 20;
          const data = {
            type: newType,
            categoryId: document.getElementById('q_category').value,
            stem, options: [], answer: [], score,
            analysis: document.getElementById('q_analysis').value.trim(),
            referenceAnswer,
          };
          if (q) { DB.updateQuestion(id, data); DB.addLog('update_question', id, `编辑题目「${stem.slice(0,20)}」`); toast('题目已更新', 'success'); }
          else { DB.addQuestion(data); DB.addLog('create_question', '', `新增题目「${stem.slice(0,20)}」`); toast('题目已添加', 'success'); }
        }
        App.render();
        return true;
      }
    });
  }

  function renderOptions(q, type) {
    if (type === 'judge') {
      const opts = ['正确', '错误'];
      return opts.map((o, i) => optionRow(o, i, q, type, true)).join('');
    }
    const opts = q ? q.options : ['', '', '', ''];
    return opts.map((o, i) => optionRow(o, i, q, type, false)).join('');
  }
  function optionRow(val, i, q, type, fixed) {
    const checked = q && q.answer.includes(i) ? 'checked' : '';
    const inputType = type === 'multiple' ? 'checkbox' : 'radio';
    const letter = String.fromCharCode(65 + i);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <input type="${inputType}" name="q_correct" class="opt-correct" value="${i}" ${checked} style="width:18px;height:18px" />
      <span style="font-weight:600;width:24px">${letter}.</span>
      <input type="text" class="form-input opt-input" value="${escapeAttr(val)}" placeholder="选项内容" ${fixed ? 'readonly' : ''} style="flex:1" />
      ${!fixed ? `<button class="btn btn-sm btn-ghost" onclick="this.parentElement.remove()">✕</button>` : ''}
    </div>`;
  }
  function onTypeChange() {
    const type = document.getElementById('q_type').value;
    const isSubj = subjectiveTypes.includes(type);
    const optionsGroup = document.getElementById('q_options_group');
    const referenceGroup = document.getElementById('q_reference_group');
    if (optionsGroup) optionsGroup.style.display = isSubj ? 'none' : '';
    if (referenceGroup) referenceGroup.style.display = isSubj ? '' : 'none';
    if (!isSubj) {
      document.getElementById('q_options').innerHTML = renderOptions(null, type);
      const addBtn = document.querySelector('#q_options_group .btn');
      if (addBtn) addBtn.style.display = type === 'judge' ? 'none' : '';
    }
    // 更新参考答案 textarea rows
    const refTextarea = document.getElementById('q_reference');
    if (refTextarea) refTextarea.rows = type === 'essay' ? 6 : 4;
    // 更新默认分值
    const scoreInput = document.getElementById('q_score');
    if (scoreInput && !scoreInput.dataset.userSet) {
      scoreInput.value = isSubj ? (type === 'essay' ? 30 : 20) : 10;
    }
  }
  function addOption() {
    const type = document.getElementById('q_type').value;
    const container = document.getElementById('q_options');
    const i = container.children.length;
    container.insertAdjacentHTML('beforeend', optionRow('', i, null, type, false));
  }

  function delQuestion(id) {
    const q = DB.getQuestionById(id);
    const usedIn = DB.getExams().filter(e => e.questionIds.includes(id));
    if (usedIn.length) { toast(`该题目被 ${usedIn.length} 个考试引用，无法删除`, 'error'); return; }
    confirmDialog(`确定删除该题目吗？`, () => { DB.softDeleteQuestion(id); DB.addLog('delete_question', id, `删除题目「${q.stem.slice(0,20)}」`); toast('已删除', 'success'); App.render(); });
  }

  // ---------- 批量删除 ----------
  function toggleBatchAll() {
    const allCheck = document.getElementById('q_batch_all');
    const checks = document.querySelectorAll('.q-batch-check');
    checks.forEach(c => c.checked = allCheck.checked);
    updateBatchBtn();
  }
  function updateBatchBtn() {
    const checked = document.querySelectorAll('.q-batch-check:checked');
    const btn = document.getElementById('batch_del_btn');
    if (btn) btn.style.display = checked.length > 0 ? '' : 'none';
    if (btn && checked.length > 0) btn.textContent = `🗑️ 批量删除选中 (${checked.length})`;
  }
  function batchDeleteQuestions() {
    const ids = Array.from(document.querySelectorAll('.q-batch-check:checked')).map(c => c.value);
    if (ids.length === 0) { toast('请先选择要删除的题目', 'error'); return; }
    // 检查是否被考试引用
    const usedIds = ids.filter(id => DB.getExams().some(e => e.questionIds.includes(id)));
    if (usedIds.length) { toast(`${usedIds.length} 题被考试引用，无法删除`, 'error'); return; }
    confirmDialog(`确定删除选中的 ${ids.length} 题吗？`, () => {
      DB.softDeleteQuestionsBatch(ids);
      DB.addLog('batch_delete_questions', '', `批量删除 ${ids.length} 题题目`);
      toast(`已删除 ${ids.length} 题`, 'success');
      App.render();
    });
  }

  // ---------- Excel 批量导入 ----------
  function batchImportModal() {
    const cats = DB.getCategories();
    openModal({
      title: '📥 批量导入题目',
      size: 'lg',
      body: `
        <div class="form-group">
          <label class="form-label">导入方式</label>
          <div style="display:flex;gap:8px;margin-bottom:12px">
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
              <input type="radio" name="import_mode" value="excel" checked onchange="Admin.toggleImportMode()" style="width:18px;height:18px" />
              <span>Excel 文件导入</span>
            </label>
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
              <input type="radio" name="import_mode" value="text" onchange="Admin.toggleImportMode()" style="width:18px;height:18px" />
              <span>文本批量输入</span>
            </label>
          </div>
        </div>
        <div id="import_excel_group">
          <div class="form-group">
            <label class="form-label">上传 Excel 文件</label>
            <input type="file" id="import_file" accept=".xlsx,.xls,.csv" onchange="Admin.parseImportFile(this)" />
            <div class="form-hint">Excel 格式要求：第一行为表头，列顺序为 题干、题型(single/multiple/judge/short_answer/essay)、选项A、选项B、选项C、选项D、正确答案(如"2"或"0,2")、分值、参考答案、分类名称、答案解析</div>
          </div>
          <div id="import_preview" style="display:none">
            <div class="form-group">
              <label class="form-label">导入分类</label>
              <select class="form-select" id="import_category">
                ${cats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
              </select>
              <div class="form-hint">所有导入题目将归属此分类（也可在 Excel 中指定分类名称）</div>
            </div>
            <div style="border:1px solid var(--border);border-radius:8px;padding:12px;max-height:300px;overflow-y:auto" id="import_preview_list"></div>
          </div>
        </div>
        <div id="import_text_group" style="display:none">
          <div class="form-group">
            <label class="form-label">导入分类</label>
            <select class="form-select" id="import_text_category">
              ${cats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">批量输入题目</label>
            <textarea class="form-textarea" id="import_text_area" rows="10" placeholder="每行一道题，格式：题型|题干|选项A|选项B|选项C|选项D|答案|分值|参考答案
示例：
single|密码不少于几位？|6位|8位|10位|12位|1|10|
judge|离开工位须锁屏|正确|错误|||0|5|
short_answer|简述最小权限原则||||||20|仅赋予最低权限...
essay|论述信息安全体系||||||30|从技术和管理两方面论述..."></textarea>
            <div class="form-hint">主观题选项和答案列留空，答案写在"参考答案"列</div>
          </div>
        </div>
      `,
      okText: '确认导入',
      onOk: () => {
        const mode = document.querySelector('input[name="import_mode"]:checked').value;
        if (mode === 'excel') {
          if (!importParsedData || importParsedData.length === 0) { toast('请先上传并解析 Excel 文件', 'error'); return false; }
          const categoryId = document.getElementById('import_category').value;
          // 使用 Excel 中的分类名称或默认分类
          const questions = importParsedData.map(row => {
            let catId = categoryId;
            if (row.categoryName) {
              const cat = DB.getCategories().find(c => c.name === row.categoryName);
              if (cat) catId = cat.id;
            }
            return {
              type: row.type || 'single',
              stem: row.stem || '',
              options: row.options || [],
              answer: row.answer || [],
              score: row.score || 10,
              referenceAnswer: row.referenceAnswer || '',
              analysis: row.analysis || '',
              categoryId: catId,
            };
          }).filter(q => q.stem);
          DB.addQuestionsBatch(questions);
          DB.addLog('batch_import_questions', '', `批量导入 ${questions.length} 题题目`);
          toast(`成功导入 ${questions.length} 题`, 'success');
          importParsedData = null;
        } else {
          const categoryId = document.getElementById('import_text_category').value;
          const text = document.getElementById('import_text_area').value.trim();
          if (!text) { toast('请输入题目内容', 'error'); return false; }
          const lines = text.split('\n').filter(l => l.trim());
          const questions = [];
          lines.forEach(line => {
            const parts = line.split('|');
            const type = parts[0] || 'single';
            const stem = parts[1] || '';
            const isSubj = subjectiveTypes.includes(type);
            let options = [], answer = [];
            if (!isSubj && type !== 'judge') {
              options = [parts[2], parts[3], parts[4], parts[5]].filter(Boolean).map(o => o.trim());
              const ansStr = parts[6] || '0';
              answer = ansStr.split(',').map(a => parseInt(a.trim())).filter(a => !isNaN(a));
            } else if (type === 'judge') {
              options = [parts[2] || '正确', parts[3] || '错误'];
              answer = [parseInt(parts[6] || '0')];
            }
            const score = parseInt(parts[7]) || (isSubj ? (type === 'essay' ? 30 : 20) : 10);
            const referenceAnswer = isSubj ? (parts[8] || '') : '';
            if (stem) {
              questions.push({ type, stem, options, answer, score, referenceAnswer, analysis: parts[9] || '', categoryId });
            }
          });
          if (questions.length === 0) { toast('未解析到有效题目', 'error'); return false; }
          DB.addQuestionsBatch(questions);
          DB.addLog('batch_import_questions', '', `文本批量导入 ${questions.length} 题`);
          toast(`成功导入 ${questions.length} 题`, 'success');
        }
        App.render();
        return true;
      }
    });
  }

  let importParsedData = null;

  function toggleImportMode() {
    const mode = document.querySelector('input[name="import_mode"]:checked').value;
    document.getElementById('import_excel_group').style.display = mode === 'excel' ? '' : 'none';
    document.getElementById('import_text_group').style.display = mode === 'text' ? '' : 'none';
  }

  function parseImportFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) { toast('Excel 文件内容不足', 'error'); return; }
        const header = rows[0];
        importParsedData = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[0]) continue;
          const type = String(row[1] || 'single').trim();
          const isSubj = subjectiveTypes.includes(type);
          let options = [], answer = [];
          if (!isSubj && type !== 'judge') {
            options = [row[2], row[3], row[4], row[5]].filter(v => v != null && String(v).trim()).map(v => String(v).trim());
            const ansStr = String(row[6] || '0').trim();
            answer = ansStr.split(',').map(a => parseInt(a.trim())).filter(a => !isNaN(a));
          } else if (type === 'judge') {
            options = [String(row[2] || '正确').trim(), String(row[3] || '错误').trim()];
            answer = [parseInt(String(row[6] || '0').trim())];
          }
          importParsedData.push({
            stem: String(row[0]).trim(),
            type,
            options,
            answer,
            score: parseInt(row[7]) || (isSubj ? 20 : 10),
            referenceAnswer: isSubj ? String(row[8] || '').trim() : '',
            categoryName: String(row[9] || '').trim(),
            analysis: String(row[10] || '').trim(),
          });
        }
        // 显示预览
        const previewDiv = document.getElementById('import_preview');
        if (previewDiv) previewDiv.style.display = '';
        const listDiv = document.getElementById('import_preview_list');
        if (listDiv) {
          listDiv.innerHTML = `<div style="font-size:13px;color:var(--text-muted);margin-bottom:8px">已解析 ${importParsedData.length} 题：</div>` +
            importParsedData.slice(0, 20).map((q, i) => `
              <div style="padding:6px;border-bottom:1px solid var(--border);font-size:13px">
                <span class="badge badge-info" style="font-size:11px">${typeLabels[q.type] || q.type}</span>
                ${escapeHtml(q.stem.slice(0, 40))}
                <span style="color:var(--text-muted)">${q.score}分</span>
              </div>
            `).join('') +
            (importParsedData.length > 20 ? `<div style="text-align:center;color:var(--text-muted);font-size:12px">...还有 ${importParsedData.length - 20} 题</div>` : '');
        }
        toast(`已解析 ${importParsedData.length} 题题目`, 'success');
      } catch (err) {
        toast('Excel 解析失败：' + err.message, 'error');
        importParsedData = null;
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // ---------- 考试配置（增强版：参与人员选择、草稿/发布、时间设置） ----------
  function exams() {
    const list = DB.getExams();
    const cats = DB.getCategories();
    const statusLabels = { draft: '草稿', published: '已发布', active: '进行中', ended: '已结束', inactive: '已停用' };
    const statusColors = { draft: 'badge-gray', published: 'badge-success', active: 'badge-success', ended: 'badge-warning', inactive: 'badge-danger' };
    // 考试看板统计
    const allEmployees = DB.getUsers().filter(u => u.role === 'employee');
    const totalEmployees = allEmployees.length;
    const publishedExams = list.filter(e => e.status === 'published' || e.status === 'active');
    const dashboardStats = publishedExams.map(e => {
      const participants = e.participants && e.participants.length > 0 ? e.participants : allEmployees.map(u => u.id);
      const records = DB.getRecordsByExam(e.id);
      const participantIds = records.map(r => r.userId);
      const notParticipated = participants.filter(pid => !participantIds.includes(pid));
      const passed = records.filter(r => r.passed).length;
      const passRate = records.length ? Math.round(passed / records.length * 100) : 0;
      return { exam: e, participantCount: participants.length, participatedCount: records.length, notParticipated, passed, passRate };
    });

    return `
      <div class="page-header">
        <div>
          <h2>考试配置</h2>
          <div class="subtitle">配置考试任务、指定参与人员、设置时间规则</div>
        </div>
        <button class="btn btn-primary" onclick="Admin.examModal()">➕ 创建考试</button>
      </div>
      <!-- 考试看板 -->
      ${dashboardStats.length > 0 ? `
      <div class="card" style="padding:20px;margin-bottom:20px">
        <h4 style="margin-bottom:14px">📊 考试看板（已发布考试统计）</h4>
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-icon blue">📋</div><div><div class="stat-value">${publishedExams.length}</div><div class="stat-label">已发布考试</div></div></div>
          <div class="stat-card"><div class="stat-icon green">✅</div><div><div class="stat-value">${dashboardStats.reduce((s, d) => s + d.participatedCount, 0)}</div><div class="stat-label">总参考人次</div></div></div>
          <div class="stat-card"><div class="stat-icon orange">👥</div><div><div class="stat-value">${dashboardStats.reduce((s, d) => s + d.notParticipated.length, 0)}</div><div class="stat-label">未参考人数</div></div></div>
          <div class="stat-card"><div class="stat-icon cyan">🎯</div><div><div class="stat-value">${dashboardStats.length ? Math.round(dashboardStats.reduce((s, d) => s + d.passRate, 0) / dashboardStats.length) : 0}%</div><div class="stat-label">平均通过率</div></div></div>
        </div>
        ${dashboardStats.length > 0 ? `
        <div style="margin-top:16px">
          <table class="data-table">
            <thead><tr><th>考试名称</th><th>应参与人数</th><th>已参考人次</th><th>通过率</th><th>未参考人员</th></tr></thead>
            <tbody>
              ${dashboardStats.map(d => `<tr>
                <td><strong>${escapeHtml(d.exam.title)}</strong></td>
                <td>${d.participantCount}</td>
                <td>${d.participatedCount}</td>
                <td><span class="badge ${d.passRate >= 60 ? 'badge-success' : 'badge-warning'}">${d.passRate}%</span></td>
                <td style="max-width:200px;font-size:13px">${d.notParticipated.length > 0 ? d.notParticipated.map(uid => { const u = DB.getUserById(uid); return u ? escapeHtml(u.name) : uid; }).join('、') : '<span style="color:var(--success)">全部已参考</span>'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}
      </div>` : ''}
      ${list.length === 0 ? emptyState('📋', '暂无考试，点击右上角创建') : `
      <div class="cards-grid">
        ${list.map(e => {
          const cat = DB.getCategoryById(e.categoryId);
          const records = DB.getRecordsByExam(e.id);
          const passed = records.filter(r => r.passed).length;
          const participantCount = e.participants ? e.participants.length : 0;
          const participantText = participantCount === 0 ? '全员可考' : `${participantCount} 人`;
          const hasSubjective = e.questionIds.some(qid => { const q = DB.getQuestionById(qid); return q && subjectiveTypes.includes(q.type); });
          return `
          <div class="exam-card">
            <div class="exam-thumb">📋</div>
            <div class="exam-body">
              <h4>${escapeHtml(e.title)}</h4>
              <div class="exam-meta">
                <span>${cat ? cat.icon + ' ' + cat.name : '-'}</span>
                <span>${e.questionIds.length} 题</span>
                <span>${e.duration} 分钟</span>
                <span>及格 ${e.passScore} 分</span>
                ${hasSubjective ? '<span class="badge badge-warning">含主观题</span>' : ''}
              </div>
              <div class="exam-desc">${escapeHtml(e.desc || '暂无描述')}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;display:flex;gap:6px;flex-wrap:wrap">
                <span class="badge ${statusColors[e.status] || 'badge-gray'}">${statusLabels[e.status] || e.status}</span>
                <span>参与: ${participantText}</span>
                <span>最多 ${e.maxAttempts} 次</span>
                ${e.randomOrder ? '<span>随机顺序</span>' : ''}
                ${e.startTime ? `<span>开始: ${formatDateTime(e.startTime)}</span>` : ''}
                ${e.deadline ? `<span>截止: ${formatDateTime(e.deadline)}</span>` : ''}
              </div>
              <div class="exam-actions">
                <button class="btn btn-sm btn-secondary" onclick="Admin.examRecords('${e.id}')">📊 ${records.length} 人次</button>
                <button class="btn btn-sm btn-secondary" onclick="Admin.examModal('${e.id}')">✏️ 编辑</button>
                ${e.status === 'draft' ? `<button class="btn btn-sm btn-success" onclick="Admin.publishExam('${e.id}')">📢 发布</button>` : ''}
                ${e.status === 'published' || e.status === 'active' ? `<button class="btn btn-sm btn-warning" onclick="Admin.unpublishExam('${e.id}')">⏸️ 停用</button>` : ''}
                <button class="btn btn-sm btn-danger" onclick="Admin.delExam('${e.id}')">🗑️</button>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`}
    `;
  }

  function examModal(id) {
    const e = id ? DB.getExamById(id) : null;
    const cats = DB.getCategories();
    const questions = DB.getQuestions();
    const employees = DB.getUsers().filter(u => u.role === 'employee');
    const depts = DB.getDepartments();
    const selectedParticipants = e && e.participants ? e.participants : [];

    openModal({
      title: e ? '编辑考试' : '创建考试',
      size: 'xl',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="form-group">
            <label class="form-label">考试名称 <span class="required">*</span></label>
            <input type="text" class="form-input" id="e_title" value="${e ? escapeAttr(e.title) : ''}" placeholder="如：信息安全基础考核" />
          </div>
          <div class="form-group">
            <label class="form-label">所属分类</label>
            <select class="form-select" id="e_category">
              ${cats.map(c => `<option value="${c.id}" ${e && e.categoryId === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">考试描述</label>
          <textarea class="form-textarea" id="e_desc" rows="2" placeholder="简要描述考试目的...">${e ? escapeHtml(e.desc || '') : ''}</textarea>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
          <div class="form-group">
            <label class="form-label">考试时长(分钟) <span class="required">*</span></label>
            <input type="number" class="form-input" id="e_duration" value="${e ? e.duration : 30}" min="1" />
          </div>
          <div class="form-group">
            <label class="form-label">及格分(%) <span class="required">*</span></label>
            <input type="number" class="form-input" id="e_pass" value="${e ? e.passScore : 60}" min="0" max="100" />
            <div class="form-hint">占总分百分比</div>
          </div>
          <div class="form-group">
            <label class="form-label">考试次数限制</label>
            <input type="number" class="form-input" id="e_attempts" value="${e ? e.maxAttempts : 3}" min="1" />
          </div>
          <div class="form-group">
            <label class="form-label">考试状态</label>
            <select class="form-select" id="e_status">
              <option value="draft" ${e && e.status === 'draft' ? 'selected' : ''}>草稿</option>
              <option value="published" ${e && (e.status === 'published' || e.status === 'active') ? 'selected' : ''}>已发布</option>
              <option value="inactive" ${e && e.status === 'inactive' ? 'selected' : ''}>已停用</option>
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">考试开始时间</label>
            <input type="datetime-local" class="form-input" id="e_startTime" value="${e && e.startTime ? new Date(e.startTime).toISOString().slice(0,16) : ''}" />
            <div class="form-hint">不设置则立即开始</div>
          </div>
          <div class="form-group">
            <label class="form-label">截止提交时间</label>
            <input type="datetime-local" class="form-input" id="e_deadline" value="${e && e.deadline ? new Date(e.deadline).toISOString().slice(0,16) : ''}" />
            <div class="form-hint">不设置则无限期</div>
          </div>
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="e_random" ${e && e.randomOrder ? 'checked' : ''} style="width:18px;height:18px" />
            <span class="form-label" style="margin:0">题目随机排序（每位考生题目顺序不同）</span>
          </label>
        </div>

        <!-- 参与人员选择 -->
        <div class="form-group">
          <label class="form-label">参与人员 <span class="required">*</span></label>
          <div style="display:flex;gap:8px;margin-bottom:10px;align-items:center">
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
              <input type="radio" name="e_ptype" value="all" ${selectedParticipants.length === 0 ? 'checked' : ''} onchange="Admin.toggleParticipantSelect()" style="width:18px;height:18px" />
              <span>全员可考</span>
            </label>
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
              <input type="radio" name="e_ptype" value="select" ${selectedParticipants.length > 0 ? 'checked' : ''} onchange="Admin.toggleParticipantSelect()" style="width:18px;height:18px" />
              <span>指定人员</span>
            </label>
          </div>
          <div id="e_pselect" style="${selectedParticipants.length === 0 ? 'display:none' : ''}">
            <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
              <select class="form-select" style="width:auto" id="e_pdept" onchange="Admin.filterParticipantsByDept()">
                <option value="">按部门筛选</option>
                ${depts.map(d => `<option value="${escapeAttr(d)}">${escapeHtml(d)}</option>`).join('')}
              </select>
              <button class="btn btn-sm btn-secondary" onclick="Admin.selectAllDeptEmployees()">选中当前部门全部员工</button>
              <span class="badge badge-primary" id="e_pcount">${selectedParticipants.length} 人已选</span>
            </div>
            <div id="e_plist" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:8px">
              ${employees.map(emp => `
                <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid var(--border);cursor:pointer" class="e-pitem" data-dept="${escapeAttr(emp.dept || '')}">
                  <input type="checkbox" class="e-pcheck" value="${emp.id}" ${selectedParticipants.includes(emp.id) ? 'checked' : ''} onchange="Admin.updateParticipantCount()" style="width:18px;height:18px" />
                  <div style="flex:1">
                    <span style="font-weight:500">${escapeHtml(emp.name)}</span>
                    <span style="font-size:12px;color:var(--text-muted);margin-left:8px">${escapeHtml(emp.dept || '')} · ${escapeHtml(emp.position || '')}</span>
                  </div>
                </label>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 选择考试题目 -->
        <div class="form-group">
          <label class="form-label">选择考试题目 <span class="required">*</span></label>
          <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;flex-wrap:wrap">
            <input type="text" class="form-input" id="e_qsearch" placeholder="搜索题目..." oninput="Admin.filterExamQuestions()" style="flex:1;max-width:200px" />
            <select class="form-select" style="width:auto" id="e_qcat_filter" onchange="Admin.filterExamQuestionsByCat()">
              <option value="">按分类批量添加</option>
              ${cats.map(c => `<option value="${c.id}">${c.icon} ${c.name} (${DB.getQuestionsByCategory(c.id).length}题)</option>`).join('')}
            </select>
            <button class="btn btn-sm btn-success" onclick="Admin.batchAddQuestionsByCategory()">➕ 添加该分类全部题目</button>
            <button class="btn btn-sm btn-ghost" onclick="Admin.clearAllQuestions()">✕ 清空选择</button>
            <span class="badge badge-primary" id="e_qcount">${e ? e.questionIds.length : 0} 题已选</span>
            <span class="badge badge-gray" id="e_totalscore">总分 ${e ? e.totalScore : 0}</span>
          </div>
          <div id="e_qlist" style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:8px">
            ${questions.map(q => {
              const cat = DB.getCategoryById(q.categoryId);
              const checked = e && e.questionIds.includes(q.id) ? 'checked' : '';
              const isSubj = subjectiveTypes.includes(q.type);
              return `<label style="display:flex;align-items:flex-start;gap:8px;padding:8px;border-bottom:1px solid var(--border);cursor:pointer" class="e-qitem" data-score="${q.score}" data-stem="${escapeAttr(q.stem)}" data-category="${q.categoryId}">
                <input type="checkbox" class="e-qcheck" value="${q.id}" ${checked} onchange="Admin.updateExamSummary()" style="margin-top:3px;width:18px;height:18px" />
                <div style="flex:1">
                  <div>${typeIcons[q.type]} ${escapeHtml(q.stem).slice(0,60)}</div>
                  <div style="font-size:12px;color:var(--text-muted)">${cat ? cat.name : '-'} · ${q.score}分 · ${typeLabels[q.type]}${isSubj ? '（主观题）' : ''}</div>
                </div>
              </label>`;
            }).join('')}
          </div>
        </div>
      `,
      onOk: () => {
        const title = document.getElementById('e_title').value.trim();
        if (!title) { toast('请输入考试名称', 'error'); return false; }
        const qids = Array.from(document.querySelectorAll('.e-qcheck:checked')).map(c => c.value);
        if (qids.length === 0) { toast('请至少选择一道题目', 'error'); return false; }

        // 参与人员
        const ptype = document.querySelector('input[name="e_ptype"]:checked').value;
        let participants = [];
        if (ptype === 'select') {
          participants = Array.from(document.querySelectorAll('.e-pcheck:checked')).map(c => c.value);
          if (participants.length === 0) { toast('请选择参与人员或改为全员可考', 'error'); return false; }
        }

        const allQ = DB.getQuestions();
        const totalScore = qids.reduce((s, id) => s + (allQ.find(q => q.id === id).score), 0);

        // 时间字段
        const startTimeEl = document.getElementById('e_startTime');
        const deadlineEl = document.getElementById('e_deadline');
        const startTime = startTimeEl.value ? new Date(startTimeEl.value).getTime() : null;
        const deadline = deadlineEl.value ? new Date(deadlineEl.value).getTime() : null;

        const data = {
          title,
          categoryId: document.getElementById('e_category').value,
          desc: document.getElementById('e_desc').value.trim(),
          duration: parseInt(document.getElementById('e_duration').value) || 30,
          passScore: parseInt(document.getElementById('e_pass').value) || 60,
          maxAttempts: parseInt(document.getElementById('e_attempts').value) || 3,
          status: document.getElementById('e_status').value,
          randomOrder: document.getElementById('e_random').checked,
          questionIds: qids,
          totalScore,
          participants,
          startTime,
          deadline,
        };
        if (e) { DB.updateExam(id, data); DB.addLog('update_exam', id, `编辑考试「${title}」`); toast('考试已更新', 'success'); }
        else { DB.addExam(data); DB.addLog('create_exam', '', `创建考试「${title}」`); toast('考试已创建', 'success'); }
        App.render();
        return true;
      }
    });
  }

  function toggleParticipantSelect() {
    const type = document.querySelector('input[name="e_ptype"]:checked').value;
    const el = document.getElementById('e_pselect');
    if (el) el.style.display = type === 'all' ? 'none' : '';
  }

  function filterParticipantsByDept() {
    const dept = document.getElementById('e_pdept').value;
    document.querySelectorAll('.e-pitem').forEach(item => {
      item.style.display = !dept || item.dataset.dept === dept ? '' : 'none';
    });
  }

  function selectAllDeptEmployees() {
    const dept = document.getElementById('e_pdept').value;
    document.querySelectorAll('.e-pitem').forEach(item => {
      if (!dept || item.dataset.dept === dept) {
        const checkbox = item.querySelector('.e-pcheck');
        if (checkbox) checkbox.checked = true;
      }
    });
    updateParticipantCount();
  }

  function updateParticipantCount() {
    const count = document.querySelectorAll('.e-pcheck:checked').length;
    const el = document.getElementById('e_pcount');
    if (el) el.textContent = `${count} 人已选`;
  }

  function filterExamQuestions() {
    const kw = document.getElementById('e_qsearch').value.toLowerCase();
    const catFilter = document.getElementById('e_qcat_filter') ? document.getElementById('e_qcat_filter').value : '';
    document.querySelectorAll('.e-qitem').forEach(item => {
      const stem = item.dataset.stem.toLowerCase();
      const cat = item.dataset.category || '';
      const matchKw = stem.includes(kw);
      const matchCat = !catFilter || cat === catFilter;
      item.style.display = matchKw && matchCat ? '' : 'none';
    });
  }
  function filterExamQuestionsByCat() {
    filterExamQuestions();
  }
  function batchAddQuestionsByCategory() {
    const catId = document.getElementById('e_qcat_filter').value;
    if (!catId) { toast('请先选择一个分类', 'error'); return; }
    document.querySelectorAll('.e-qitem').forEach(item => {
      if (item.dataset.category === catId) {
        const checkbox = item.querySelector('.e-qcheck');
        if (checkbox && !checkbox.checked) checkbox.checked = true;
      }
    });
    updateExamSummary();
    toast(`已添加「${DB.getCategoryById(catId).name}」分类全部题目`, 'success');
  }
  function clearAllQuestions() {
    document.querySelectorAll('.e-qcheck').forEach(c => c.checked = false);
    updateExamSummary();
  }
  function updateExamSummary() {
    const checks = document.querySelectorAll('.e-qcheck:checked');
    let total = 0;
    checks.forEach(c => { total += parseInt(c.closest('.e-qitem').dataset.score); });
    document.getElementById('e_qcount').textContent = `${checks.length} 题已选`;
    document.getElementById('e_totalscore').textContent = `总分 ${total}`;
  }

  function publishExam(id) {
    const e = DB.getExamById(id);
    if (!e) return;
    if (!e.participants || e.participants.length === 0) {
      // 默认全员可考
    }
    DB.updateExam(id, { status: 'published' });
    DB.addLog('publish_exam', id, `发布考试「${e.title}」`);
    toast('考试已发布，员工可开始参加', 'success');
    App.render();
  }

  function unpublishExam(id) {
    const e = DB.getExamById(id);
    if (!e) return;
    DB.updateExam(id, { status: 'inactive' });
    DB.addLog('draft_exam', id, `停用考试「${e.title}」`);
    toast('考试已停用', 'success');
    App.render();
  }

  function delExam(id) {
    const e = DB.getExamById(id);
    const records = DB.getRecordsByExam(id);
    if (records.length) {
      confirmDialog(`该考试已有 ${records.length} 条考试记录。删除后所有用户将不再看到此考试。确定删除吗？`, () => {
        DB.softDeleteExam(id);
        DB.addLog('delete_exam', id, `删除考试「${e.title}」`);
        toast('考试已删除，所有用户将不再可见', 'success');
        App.render();
      });
    } else {
      confirmDialog('删除后所有用户将不再看到此考试。确定删除吗？', () => { DB.softDeleteExam(id); DB.addLog('delete_exam', id, `删除考试「${e.title}」`); toast('已删除', 'success'); App.render(); });
    }
  }

  function examRecords(examId) {
    App.navigate('records', { examId });
  }

  // ---------- 用户管理 ----------
  function users() {
    const list = DB.getUsers();
    const roleLabels = { super_admin: '总管理员', admin: '管理员', employee: '员工' };
    const roleColors = { super_admin: 'badge-purple', admin: 'badge-primary', employee: 'badge-info' };
    return `
      <div class="page-header">
        <div>
          <h2>用户管理</h2>
          <div class="subtitle">管理系统用户与角色权限</div>
        </div>
        ${App.currentUser.role === 'super_admin' ? `<button class="btn btn-primary" onclick="Admin.userModal()">➕ 添加用户</button>` : ''}
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>姓名</th><th>用户名</th><th>角色</th><th>部门</th><th>职位</th><th>工号</th><th>考试记录</th><th>注册时间</th><th>操作</th></tr></thead>
          <tbody>
            ${list.map(u => {
              const records = DB.getRecordsByUser(u.id);
              return `<tr>
                <td><strong>${escapeHtml(u.name)}</strong></td>
                <td>${u.username}</td>
                <td><span class="badge ${roleColors[u.role] || 'badge-gray'}">${roleLabels[u.role] || u.role}</span></td>
                <td>${escapeHtml(u.dept || '-')}</td>
                <td>${escapeHtml(u.position || '-')}</td>
                <td>${u.jobNumber || '-'}</td>
                <td>${records.length} 次</td>
                <td>${formatDate(u.createdAt)}</td>
                <td><div class="actions">
                  ${u.role !== 'super_admin' || App.currentUser.role === 'super_admin' ? `<button class="btn btn-sm btn-secondary" onclick="Admin.userModal('${u.id}')">编辑</button>` : ''}
                  ${u.id !== App.currentUser.id && u.role !== 'super_admin' ? `<button class="btn btn-sm btn-danger" onclick="Admin.delUser('${u.id}')">删除</button>` : ''}
                  ${u.id === App.currentUser.id ? '<span style="color:var(--text-muted);font-size:12px">当前用户</span>' : ''}
                  ${u.role === 'super_admin' && u.id !== App.currentUser.id ? '<span style="color:var(--text-muted);font-size:12px">总管理员</span>' : ''}
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function userModal(id) {
    const u = id ? DB.getUserById(id) : null;
    openModal({
      title: u ? '编辑用户' : '添加用户',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">姓名 <span class="required">*</span></label>
            <input type="text" class="form-input" id="u_name" value="${u ? escapeAttr(u.name) : ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">用户名 <span class="required">*</span></label>
            <input type="text" class="form-input" id="u_username" value="${u ? escapeAttr(u.username) : ''}" ${u ? 'readonly' : ''} />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">密码 <span class="required">*</span></label>
            <input type="text" class="form-input" id="u_password" value="${u ? escapeAttr(u.password) : '123456'}" />
          </div>
          <div class="form-group">
            <label class="form-label">角色</label>
            <select class="form-select" id="u_role">
              <option value="employee" ${u && u.role === 'employee' ? 'selected' : ''}>员工</option>
              <option value="admin" ${u && u.role === 'admin' ? 'selected' : ''}>管理员</option>
              ${App.currentUser.role === 'super_admin' ? `<option value="super_admin" ${u && u.role === 'super_admin' ? 'selected' : ''}>总管理员</option>` : ''}
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">部门</label>
            <input type="text" class="form-input" id="u_dept" value="${u ? escapeAttr(u.dept || '') : ''}" placeholder="如：研发部" />
          </div>
          <div class="form-group">
            <label class="form-label">职位</label>
            <input type="text" class="form-input" id="u_position" value="${u ? escapeAttr(u.position || '') : ''}" placeholder="如：前端工程师" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">工号</label>
          <input type="text" class="form-input" id="u_jobNumber" value="${u ? escapeAttr(u.jobNumber || '') : ''}" placeholder="如：E001" />
        </div>
      `,
      onOk: () => {
        const name = document.getElementById('u_name').value.trim();
        const username = document.getElementById('u_username').value.trim();
        if (!name || !username) { toast('请填写姓名和用户名', 'error'); return false; }
        const data = {
          name, username,
          password: document.getElementById('u_password').value.trim(),
          role: document.getElementById('u_role').value,
          dept: document.getElementById('u_dept').value.trim(),
          position: document.getElementById('u_position').value.trim(),
          jobNumber: document.getElementById('u_jobNumber').value.trim(),
        };
        if (u) { DB.updateUser(id, data); DB.addLog('update_user', id, `编辑用户「${name}」`); toast('用户已更新', 'success'); }
        else {
          if (DB.getUsers().some(x => x.username === username)) { toast('用户名已存在', 'error'); return false; }
          DB.addUser(data); DB.addLog('create_user', '', `添加用户「${name}」`); toast('用户已添加', 'success');
        }
        App.render();
        return true;
      }
    });
  }

  function delUser(id) {
    const u = DB.getUserById(id);
    if (u.role === 'super_admin') { toast('总管理员不可删除', 'error'); return; }
    if (u.role === 'admin' && DB.getAdmins().length <= 1) {
      toast('至少保留一个管理员', 'error'); return;
    }
    confirmDialog(`删除用户「${u.name}」后，该用户将无法再登录系统。确定删除吗？`, () => {
      DB.softDeleteUser(id);
      DB.addLog('delete_user', id, `删除用户「${u.name}」`);
      toast('用户已删除，将无法再登录', 'success');
      App.render();
    });
  }

  return {
    dashboard, renderDashboardCharts,
    adminMgmt, adminModal, toggleScopeSelect, delAdmin,
    logs,
    materials, setMaterialFilter, materialModal, toggleUpload, handleFile, handleMultipleFiles, removeAttachment, renderAttachmentList, handleCoverFile, cropCover, removeCover, previewMaterial, downloadMaterial, downloadAttachment, delMaterial,
    categoryModal, addCat, saveCat, delCat,
    questions, setQFilter, questionModal, onTypeChange, addOption, delQuestion, toggleBatchAll, updateBatchBtn, batchDeleteQuestions, batchImportModal, toggleImportMode, parseImportFile,
    exams, examModal, filterExamQuestions, filterExamQuestionsByCat, batchAddQuestionsByCategory, clearAllQuestions, updateExamSummary, publishExam, unpublishExam, toggleParticipantSelect, filterParticipantsByDept, selectAllDeptEmployees, updateParticipantCount, delExam, examRecords,
    users, userModal, delUser,
  };
})();
