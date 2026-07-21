/* ============================================================
   管理员功能模块
   - 仪表盘概览
   - 培训资料管理（上传、分类、编辑、删除）
   - 题库管理（单选/多选/判断）
   - 考试配置（及格线、次数、随机抽题）
   - 用户管理
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

    return `
      <div class="page-header">
        <div>
          <h2>管理后台概览</h2>
          <div class="subtitle">系统数据总览与关键指标</div>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue">👥</div>
          <div><div class="stat-value">${users.length}</div><div class="stat-label">员工总数</div></div>
        </div>
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
        <div class="stat-card">
          <div class="stat-icon blue">📈</div>
          <div><div class="stat-value">${passed}</div><div class="stat-label">及格人次</div></div>
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
            <button class="btn btn-secondary" onclick="App.navigate('users')">👥 用户管理</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderDashboardCharts() {
    const records = DB.getRecords();
    // 近 7 天趋势
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
    // 分类资料分布
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
          <div class="subtitle">上传、分类、管理培训内容</div>
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
          return `
          <div class="material-card">
            <div class="material-thumb ${m.type}">${typeIcon[m.type] || '📎'}</div>
            <div class="material-body">
              <h4>${escapeHtml(m.title)}</h4>
              <div class="material-meta">
                <span>${cat ? cat.icon + ' ' + cat.name : '未分类'}</span>
                <span>${size}</span>
                <span>${formatDate(m.createdAt)}</span>
              </div>
              <div class="material-desc">${escapeHtml(m.desc || '暂无描述')}</div>
              <div class="material-actions">
                <button class="btn btn-sm btn-secondary" onclick="Admin.previewMaterial('${m.id}')">👁️ 预览</button>
                ${FileUtil.canDownload(m) ? `<button class="btn btn-sm btn-secondary" onclick="Admin.downloadMaterial('${m.id}')">⬇️ 下载</button>` : ''}
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
    pendingFile = null; // 重置待上传文件
    openModal({
      title: m ? '编辑培训资料' : '上传培训资料',
      size: 'lg',
      body: `
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
        <div class="form-group" id="upload_group">
          <label class="form-label">上传文件</label>
          <input type="file" id="m_file" onchange="Admin.handleFile(this)" />
          <div class="form-hint">选择本地文件，或直接在下方填写文本内容（文档类）。视频支持填写在线地址。</div>
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
        const data = {
          title,
          categoryId: document.getElementById('m_category').value,
          type,
          url: document.getElementById('m_url') ? document.getElementById('m_url').value.trim() : '',
          content: document.getElementById('m_content').value,
          desc: document.getElementById('m_desc').value.trim(),
        };
        const fileInput = document.getElementById('m_file');
        if (pendingFile) {
          // 新选择了本地文件：传 File 对象给 DB（走 multipart 上传到服务器）
          data.fileName = pendingFile.name;
          data.fileSize = pendingFile.size;
          data._file = pendingFile;
          data.url = '';
        } else if (m) {
          // 编辑模式未换文件：保留原文件数据
          data.fileName = m.fileName; data.fileSize = m.fileSize;
          data.filePath = m.filePath;
          if (!data.url) data.url = m.url;
        }
        if (m) { DB.updateMaterial(id, data); toast('资料已更新', 'success'); }
        else { data.uploader = App.currentUser.name; DB.addMaterial(data); toast('资料上传成功', 'success'); }
        pendingFile = null;
        App.render();
        return true;
      }
    });
    toggleUpload();
    // 回填视频 URL 显示
    if (m && m.type === 'video') toggleUpload();
  }

  function toggleUpload() {
    const type = document.getElementById('m_type');
    if (!type) return;
    const v = type.value;
    document.getElementById('url_group').style.display = v === 'video' ? 'block' : 'none';
    document.getElementById('content_group').style.display = (v === 'doc' || v === 'pdf') ? 'block' : 'none';
  }

  let pendingFile = null; // 原始 File 对象
  function handleFile(input) {
    const file = input.files[0];
    if (!file) return;
    pendingFile = file;
    toast(`已选择: ${file.name} (${formatSize(file.size)})`, 'success');
  }

  function previewMaterial(id) {
    const m = DB.getMaterialById(id);
    if (!m) return;
    const typeIcon = { doc: '📄', pdf: '📕', video: '🎬', img: '🖼️', file: '📎' };
    const cat = DB.getCategoryById(m.categoryId);
    openModal({
      title: m.title,
      size: 'lg',
      body: `
        <div style="margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <span class="badge badge-primary">${cat ? cat.icon + ' ' + cat.name : '未分类'}</span>
          <span class="badge badge-gray">${typeIcon[m.type]} ${m.type.toUpperCase()}</span>
          ${m.fileSize ? `<span class="badge badge-gray">${formatSize(m.fileSize)}</span>` : ''}
          ${m.fileName ? `<span class="badge badge-gray">📄 ${escapeHtml(m.fileName)}</span>` : ''}
        </div>
        ${FileUtil.previewHtml(m)}
        ${FileUtil.canDownload(m) ? `<div style="margin-top:14px;text-align:center"><button class="btn btn-secondary" onclick="Admin.downloadMaterial('${m.id}')">⬇️ 下载文件</button></div>` : ''}
      `,
      okText: '关闭',
      cancelHidden: true,
      onOk: () => true
    });
  }

  function downloadMaterial(id) {
    const m = DB.getMaterialById(id);
    if (!m) return;
    if (FileUtil.download(m)) toast('开始下载', 'success');
    else toast('该资料暂不支持下载', 'warning');
  }

  function delMaterial(id) {
    const m = DB.getMaterialById(id);
    confirmDialog(`确定删除资料「${m.title}」吗？此操作不可撤销。`, () => {
      DB.deleteMaterial(id);
      toast('资料已删除', 'success');
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
  const typeLabels = { single: '单选题', multiple: '多选题', judge: '判断题' };
  const typeIcons = { single: '🔘', multiple: '☑️', judge: '⚖️' };

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
          <div class="subtitle">管理考试题目，支持单选/多选/判断题</div>
        </div>
        <button class="btn btn-primary" onclick="Admin.questionModal()">➕ 新增题目</button>
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
        </select>
        <div class="search-box" style="flex:1;max-width:300px">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="搜索题干..." value="${questionFilter.keyword}" oninput="Admin.setQFilter('keyword', this.value)" />
        </div>
        <span class="badge badge-gray">共 ${list.length} 题</span>
      </div>
      ${list.length === 0 ? emptyState('📝', '暂无题目，点击右上角新增') : `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>题目</th><th>题型</th><th>分类</th><th>分值</th><th>创建时间</th><th>操作</th></tr></thead>
          <tbody>
            ${list.map(q => {
              const cat = DB.getCategoryById(q.categoryId);
              return `<tr>
                <td style="max-width:400px">${typeIcons[q.type]} ${escapeHtml(q.stem).slice(0, 50)}${q.stem.length > 50 ? '...' : ''}</td>
                <td><span class="badge badge-info">${typeLabels[q.type]}</span></td>
                <td>${cat ? cat.icon + ' ' + cat.name : '-'}</td>
                <td><strong>${q.score}</strong> 分</td>
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
        <div class="form-group" id="q_options_group">
          <label class="form-label">选项 <span class="required">*</span></label>
          <div id="q_options">${renderOptions(q, type)}</div>
          ${type !== 'judge' ? `<button class="btn btn-sm btn-secondary" onclick="Admin.addOption()" style="margin-top:8px">➕ 添加选项</button>` : ''}
          <div class="form-hint">${type === 'multiple' ? '多选题：勾选所有正确选项' : '单选题/判断题：选择一个正确答案'}</div>
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
        };
        if (q) { DB.updateQuestion(id, data); toast('题目已更新', 'success'); }
        else { DB.addQuestion(data); toast('题目已添加', 'success'); }
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
    document.getElementById('q_options').innerHTML = renderOptions(null, type);
    const addBtn = document.querySelector('#q_options_group .btn');
    if (addBtn) addBtn.style.display = type === 'judge' ? 'none' : '';
  }
  function addOption() {
    const type = document.getElementById('q_type').value;
    const container = document.getElementById('q_options');
    const i = container.children.length;
    container.insertAdjacentHTML('beforeend', optionRow('', i, null, type, false));
  }

  function delQuestion(id) {
    const q = DB.getQuestionById(id);
    // 检查是否被考试引用
    const usedIn = DB.getExams().filter(e => e.questionIds.includes(id));
    if (usedIn.length) { toast(`该题目被 ${usedIn.length} 个考试引用，无法删除`, 'error'); return; }
    confirmDialog(`确定删除该题目吗？`, () => { DB.deleteQuestion(id); toast('已删除', 'success'); App.render(); });
  }

  // ---------- 考试配置 ----------
  function exams() {
    const list = DB.getExams();
    const cats = DB.getCategories();
    return `
      <div class="page-header">
        <div>
          <h2>考试配置</h2>
          <div class="subtitle">配置考试规则，组装题目</div>
        </div>
        <button class="btn btn-primary" onclick="Admin.examModal()">➕ 创建考试</button>
      </div>
      ${list.length === 0 ? emptyState('📋', '暂无考试，点击右上角创建') : `
      <div class="cards-grid">
        ${list.map(e => {
          const cat = DB.getCategoryById(e.categoryId);
          const records = DB.getRecordsByExam(e.id);
          const passed = records.filter(r => r.passed).length;
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
              </div>
              <div class="exam-desc">${escapeHtml(e.desc || '暂无描述')}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
                <span class="badge ${e.status === 'active' ? 'badge-success' : 'badge-gray'}">${e.status === 'active' ? '进行中' : '已停用'}</span>
                <span style="margin-left:6px">最多 ${e.maxAttempts} 次 · ${e.randomOrder ? '随机顺序' : '固定顺序'}</span>
              </div>
              <div class="exam-actions">
                <button class="btn btn-sm btn-secondary" onclick="Admin.examRecords('${e.id}')">📊 ${records.length} 人次</button>
                <button class="btn btn-sm btn-secondary" onclick="Admin.examModal('${e.id}')">✏️ 编辑</button>
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
              <option value="active" ${e && e.status === 'active' ? 'selected' : ''}>进行中</option>
              <option value="inactive" ${e && e.status === 'inactive' ? 'selected' : ''}>已停用</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="e_random" ${e && e.randomOrder ? 'checked' : ''} style="width:18px;height:18px" />
            <span class="form-label" style="margin:0">题目随机排序（每位考生题目顺序不同）</span>
          </label>
        </div>
        <div class="form-group">
          <label class="form-label">选择考试题目 <span class="required">*</span></label>
          <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
            <input type="text" class="form-input" id="e_qsearch" placeholder="搜索题目..." oninput="Admin.filterExamQuestions()" style="flex:1" />
            <span class="badge badge-primary" id="e_qcount">${e ? e.questionIds.length : 0} 题已选</span>
            <span class="badge badge-gray" id="e_totalscore">总分 ${e ? e.totalScore : 0}</span>
          </div>
          <div id="e_qlist" style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:8px">
            ${questions.map(q => {
              const cat = DB.getCategoryById(q.categoryId);
              const checked = e && e.questionIds.includes(q.id) ? 'checked' : '';
              return `<label style="display:flex;align-items:flex-start;gap:8px;padding:8px;border-bottom:1px solid var(--border);cursor:pointer" class="e-qitem" data-score="${q.score}" data-stem="${escapeAttr(q.stem)}">
                <input type="checkbox" class="e-qcheck" value="${q.id}" ${checked} onchange="Admin.updateExamSummary()" style="margin-top:3px;width:18px;height:18px" />
                <div style="flex:1">
                  <div>${typeIcons[q.type]} ${escapeHtml(q.stem).slice(0,60)}</div>
                  <div style="font-size:12px;color:var(--text-muted)">${cat ? cat.name : '-'} · ${q.score}分 · ${typeLabels[q.type]}</div>
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
        const allQ = DB.getQuestions();
        const totalScore = qids.reduce((s, id) => s + (allQ.find(q => q.id === id).score), 0);
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
        };
        if (e) { DB.updateExam(id, data); toast('考试已更新', 'success'); }
        else { DB.addExam(data); toast('考试已创建', 'success'); }
        App.render();
        return true;
      }
    });
  }
  function filterExamQuestions() {
    const kw = document.getElementById('e_qsearch').value.toLowerCase();
    document.querySelectorAll('.e-qitem').forEach(item => {
      const stem = item.dataset.stem.toLowerCase();
      item.style.display = stem.includes(kw) ? '' : 'none';
    });
  }
  function updateExamSummary() {
    const checks = document.querySelectorAll('.e-qcheck:checked');
    let total = 0;
    checks.forEach(c => { total += parseInt(c.closest('.e-qitem').dataset.score); });
    document.getElementById('e_qcount').textContent = `${checks.length} 题已选`;
    document.getElementById('e_totalscore').textContent = `总分 ${total}`;
  }

  function delExam(id) {
    const records = DB.getRecordsByExam(id);
    if (records.length) {
      confirmDialog(`该考试已有 ${records.length} 条考试记录，删除后记录也将消失。确定删除吗？`, () => {
        records.forEach(r => DB.deleteRecord(r.id));
        DB.deleteExam(id);
        toast('考试已删除', 'success');
        App.render();
      });
    } else {
      confirmDialog('确定删除该考试吗？', () => { DB.deleteExam(id); toast('已删除', 'success'); App.render(); });
    }
  }

  function examRecords(examId) {
    App.navigate('records', { examId });
  }

  // ---------- 用户管理 ----------
  function users() {
    const list = DB.getUsers();
    return `
      <div class="page-header">
        <div>
          <h2>用户管理</h2>
          <div class="subtitle">管理系统用户与角色权限</div>
        </div>
        <button class="btn btn-primary" onclick="Admin.userModal()">➕ 添加用户</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>姓名</th><th>用户名</th><th>角色</th><th>部门</th><th>考试记录</th><th>注册时间</th><th>操作</th></tr></thead>
          <tbody>
            ${list.map(u => {
              const records = DB.getRecordsByUser(u.id);
              return `<tr>
                <td><strong>${escapeHtml(u.name)}</strong></td>
                <td>${u.username}</td>
                <td><span class="badge ${u.role === 'admin' ? 'badge-primary' : 'badge-info'}">${u.role === 'admin' ? '管理员' : '员工'}</span></td>
                <td>${u.dept || '-'}</td>
                <td>${records.length} 次</td>
                <td>${formatDate(u.createdAt)}</td>
                <td><div class="actions">
                  <button class="btn btn-sm btn-secondary" onclick="Admin.userModal('${u.id}')">编辑</button>
                  ${u.id !== App.currentUser.id ? `<button class="btn btn-sm btn-danger" onclick="Admin.delUser('${u.id}')">删除</button>` : '<span style="color:var(--text-muted);font-size:12px">当前用户</span>'}
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
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">部门</label>
          <input type="text" class="form-input" id="u_dept" value="${u ? escapeAttr(u.dept || '') : ''}" placeholder="如：研发部" />
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
        };
        if (u) { DB.updateUser(id, data); toast('用户已更新', 'success'); }
        else {
          if (DB.getUsers().some(x => x.username === username)) { toast('用户名已存在', 'error'); return false; }
          DB.addUser(data); toast('用户已添加', 'success');
        }
        App.render();
        return true;
      }
    });
  }

  function delUser(id) {
    const u = DB.getUserById(id);
    if (u.role === 'admin' && DB.getUsers().filter(x => x.role === 'admin').length <= 1) {
      toast('至少保留一个管理员', 'error'); return;
    }
    confirmDialog(`确定删除用户「${u.name}」吗？相关考试记录将保留。`, () => {
      DB.deleteUser(id); toast('用户已删除', 'success'); App.render();
    });
  }

  return {
    dashboard, renderDashboardCharts,
    materials, setMaterialFilter, materialModal, toggleUpload, handleFile, previewMaterial, downloadMaterial, delMaterial,
    categoryModal, addCat, saveCat, delCat,
    questions, setQFilter, questionModal, onTypeChange, addOption, delQuestion,
    exams, examModal, filterExamQuestions, updateExamSummary, delExam, examRecords,
    users, userModal, delUser,
  };
})();
