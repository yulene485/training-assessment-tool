/* ============================================================
   主应用 - 路由、登录、布局、通用工具（纯前端版）
   - 三级角色：super_admin / admin / employee
   - 钉钉扫码/工作台登录（前端版显示按钮）
   - 移除演示账号提示
   ============================================================ */

// ============ 通用工具函数 ============
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

function formatSize(bytes) {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return bytes.toFixed(bytes >= 100 ? 0 : 1) + ' ' + units[i];
}

function formatDate(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}
function formatDateTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  return `${formatDate(ts)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function emptyState(icon, msg) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><p>${escapeHtml(msg)}</p></div>`;
}

// ============ Toast 提示 ============
function toast(msg, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || '✅'}</span><span class="toast-msg">${escapeHtml(msg)}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(120%)'; setTimeout(() => el.remove(), 300); }, 3000);
}

// ============ 认对话框 ============
function confirmDialog(msg, onConfirm, onCancel, okText, cancelText) {
  openModal({
    title: '请确认',
    body: `<div style="padding:8px 0;font-size:15px;line-height:1.7">${escapeHtml(msg)}</div>`,
    okText: okText || '确认',
    okClass: 'btn-danger',
    cancelText: cancelText || '取消',
    onOk: () => { if (onConfirm) onConfirm(); return true; },
    onCancel: () => { if (onCancel) onCancel(); },
  });
}

// ============ 模态框 ============
let modalStack = [];
function openModal({ title, body, size = '', okText = '确定', cancelText = '取消', okClass = 'btn-primary', cancelHidden = false, onOk, onCancel, onShown }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal ${size ? 'modal-' + size : ''}" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h3>${escapeHtml(title)}</h3>
        <button class="modal-close" data-close>×</button>
      </div>
      <div class="modal-body">${body}</div>
      <div class="modal-footer">
        ${cancelHidden ? '' : `<button class="btn btn-secondary" data-cancel>${escapeHtml(cancelText)}</button>`}
        <button class="btn ${okClass}" data-ok>${escapeHtml(okText)}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  modalStack.push(overlay);

  const close = (result) => {
    overlay.remove();
    modalStack = modalStack.filter(m => m !== overlay);
  };

  overlay.addEventListener('click', e => {
    if (e.target === overlay || e.target.hasAttribute('data-close')) {
      if (onCancel) onCancel();
      close();
    }
  });
  const cancelBtn = overlay.querySelector('[data-cancel]');
  if (cancelBtn) cancelBtn.addEventListener('click', () => { if (onCancel) onCancel(); close(); });
  overlay.querySelector('[data-ok]').addEventListener('click', () => {
    const ret = onOk ? onOk() : true;
    if (ret !== false) close();
  });

  if (onShown) setTimeout(onShown, 50);
}

// ============ 主应用 ============
const App = (() => {
  let currentRoute = 'dashboard';
  let currentUser = null;
  let routeParams = {};

  const superAdminRoutes = {
    dashboard: { title: '管理概览', icon: '📊', render: () => Admin.dashboard(), after: () => Admin.renderDashboardCharts() },
    adminMgmt: { title: '管理员管理', icon: '🛡️', render: () => Admin.adminMgmt() },
    logs: { title: '操作日志', icon: '📜', render: () => Admin.logs() },
    materials: { title: '培训资料', icon: '📚', render: () => Admin.materials() },
    questions: { title: '题库管理', icon: '📝', render: () => Admin.questions() },
    exams: { title: '考试配置', icon: '📋', render: () => Admin.exams() },
    records: { title: '成绩管理', icon: '📈', render: () => Reports.records() },
    analytics: { title: '统计分析', icon: '📊', render: () => { Reports.showAnalytics(); return '<div class="page-header"><h2>统计分析</h2><div class="subtitle">已打开分析面板</div></div>'; } },
    users: { title: '用户管理', icon: '👥', render: () => Admin.users() },
  };
  const adminRoutes = {
    dashboard: { title: '管理概览', icon: '📊', render: () => Admin.dashboard(), after: () => Admin.renderDashboardCharts() },
    materials: { title: '培训资料', icon: '📚', render: () => Admin.materials() },
    questions: { title: '题库管理', icon: '📝', render: () => Admin.questions() },
    exams: { title: '考试配置', icon: '📋', render: () => Admin.exams() },
    records: { title: '成绩管理', icon: '📈', render: () => Reports.records() },
    analytics: { title: '统计分析', icon: '📊', render: () => { Reports.showAnalytics(); return '<div class="page-header"><h2>统计分析</h2><div class="subtitle">已打开分析面板</div></div>'; } },
    users: { title: '用户管理', icon: '👥', render: () => Admin.users() },
  };
  const employeeRoutes = {
    home: { title: '我的首页', icon: '🏠', render: () => Employee.home() },
    learnCenter: { title: '学习中心', icon: '📚', render: () => Employee.learnCenter() },
    exams: { title: '考试中心', icon: '📋', render: () => Employee.exams() },
    myResults: { title: '我的成绩', icon: '📊', render: () => Employee.myResults() },
  };

  function getRoutes() {
    if (!currentUser) return {};
    if (currentUser.role === 'super_admin') return superAdminRoutes;
    if (currentUser.role === 'admin') return adminRoutes;
    return employeeRoutes;
  }

  function init() {
    const session = DB.getSession();
    if (session && session.user) {
      currentUser = session.user;
      const routes = getRoutes();
      currentRoute = session.route || (routes[currentRoute] ? currentRoute : Object.keys(routes)[0]);
    }
    render();
  }

  function login(username, password) {
    const user = DB.getUsers().find(u => u.username === username && u.password === password);
    if (!user) { toast('用户名或密码错误', 'error'); return false; }
    if (user.status === 'disabled') { toast('该账号已停用，请联系管理员', 'error'); return false; }
    currentUser = { ...user };
    delete currentUser.password;
    const routes = getRoutes();
    currentRoute = Object.keys(routes)[0];
    DB.setSession({ user: currentUser, route: currentRoute });
    DB.addLog('login', '', `登录系统`);
    render();
    toast(`欢迎回来，${currentUser.name}`, 'success');
    return true;
  }

  // 钉钉OAuth登录（前端版仅显示按钮，实际登录需后端）
  function dingtalkLogin() {
    // 检测是否有后端服务
    const backendUrl = window.DINGTALK_BACKEND_URL || '';
    if (!backendUrl) {
      toast('钉钉登录需部署全栈版本，请联系管理员配置', 'warning');
      return;
    }
    // 跳转钉钉OAuth授权页面
    const corpId = window.DINGTALK_CORP_ID || '';
    const redirectUrl = encodeURIComponent(backendUrl + '/auth/dingtalk/callback');
    const authUrl = `https://login.dingtalk.com/oauth2/auth?redirect_uri=${redirectUrl}&response_type=code&client_id=${window.DINGTALK_APP_KEY || ''}&scope=openid&state=etms&prompt=consent`;
    window.location.href = authUrl;
  }

  function logout() {
    confirmDialog('确定退出登录吗？', () => {
      if (currentUser) DB.addLog('logout', '', `退出系统`);
      currentUser = null;
      DB.clearSession();
      render();
    });
  }

  function navigate(route, params = {}) {
    currentRoute = route;
    routeParams = params;
    if (currentUser) DB.setSession({ user: currentUser, route });
    render();
    document.querySelector('.sidebar')?.classList.remove('open');
    document.querySelector('.sidebar-overlay')?.classList.remove('open');
  }

  function render() {
    const app = document.getElementById('app');
    if (!currentUser) {
      app.innerHTML = renderLogin();
      return;
    }
    const routes = getRoutes();
    if (!routes[currentRoute]) currentRoute = Object.keys(routes)[0];
    const route = routes[currentRoute];

    const roleLabels = { super_admin: '总管理员', admin: '管理员', employee: '员工' };
    app.innerHTML = `
      <div class="layout">
        ${renderSidebar(routes)}
        <div class="sidebar-overlay" onclick="document.querySelector('.sidebar').classList.remove('open');this.classList.remove('open')"></div>
        <div class="main-area">
          <div class="topbar">
            <button class="menu-toggle" onclick="document.querySelector('.sidebar').classList.add('open');document.querySelector('.sidebar-overlay').classList.add('open')">☰</button>
            <div class="page-title">${route.icon} ${route.title}</div>
            <div class="topbar-right">
              <span style="font-size:13px;color:var(--text-muted)">${roleLabels[currentUser.role] || currentUser.role} · ${formatDateTime(Date.now()).split(' ')[0]}</span>
            </div>
          </div>
          <div class="content" id="page_content">${route.render()}</div>
        </div>
      </div>
    `;
    if (route.after) setTimeout(route.after, 50);
  }

  function renderSidebar(routes) {
    const initials = currentUser.name.slice(0, 1);
    const roleLabels = { super_admin: '总管理员', admin: '管理员', employee: '员工' };

    let sections;
    if (currentUser.role === 'super_admin') {
      sections = [
        { title: '总管理', items: ['dashboard', 'adminMgmt', 'logs'] },
        { title: '内容', items: ['materials', 'questions', 'exams'] },
        { title: '数据', items: ['records', 'analytics', 'users'] },
      ];
    } else if (currentUser.role === 'admin') {
      sections = [
        { title: '管理', items: ['dashboard', 'materials', 'questions', 'exams'] },
        { title: '数据', items: ['records', 'analytics', 'users'] },
      ];
    } else {
      sections = [
        { title: '学习', items: ['home', 'learnCenter'] },
        { title: '考核', items: ['exams', 'myResults'] },
      ];
    }

    return `
      <div class="sidebar">
        <div class="sidebar-header">
          <div class="logo-icon">🎓</div>
          <div class="logo-text">菌视界培训考试平台</div>
        </div>
        <div class="sidebar-nav">
          ${sections.map(sec => `
            <div class="nav-section-title">${sec.title}</div>
            ${sec.items.map(key => {
              const r = routes[key];
              if (!r) return '';
              return `<div class="nav-item ${currentRoute === key ? 'active' : ''}" onclick="App.navigate('${key}')">
                <span class="nav-icon">${r.icon}</span><span>${r.title}</span>
              </div>`;
            }).join('')}
          `).join('')}
        </div>
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="avatar" style="${currentUser.role === 'super_admin' ? 'background:var(--purple,#7c3aed);color:#fff' : ''}">${escapeHtml(initials)}</div>
            <div class="user-info">
              <div class="user-name">${escapeHtml(currentUser.name)}</div>
              <div class="user-role">${roleLabels[currentUser.role] || currentUser.role}${currentUser.dept ? ' · ' + escapeHtml(currentUser.dept) : ''}</div>
            </div>
            <button class="logout-btn" onclick="App.logout()" title="退出登录">⏻</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderLogin() {
    // 检测是否有钉钉配置（前端版默认无）
    const hasDingtalk = window.DINGTALK_BACKEND_URL && window.DINGTALK_APP_KEY;

    return `
      <div class="login-page">
        <div class="login-card">
          <div class="login-logo">
            <div class="logo-icon">🎓</div>
            <h1>云南菌视界生物科技有限公司</h1>
            <h2 style="font-size:18px;font-weight:600;margin:4px 0">员工培训考试平台</h2>
            <p>Employee Training & Assessment Platform</p>
          </div>

          <!-- 钉钉登录入口 -->
          <div style="margin-bottom:20px;padding:16px;background:var(--surface-2,#f5f5f5);border-radius:10px;text-align:center">
            <div style="font-size:15px;font-weight:600;margin-bottom:12px">🔑 推荐登录方式</div>
            ${hasDingtalk ? `
              <button class="btn btn-primary btn-lg btn-block" onclick="App.dingtalkLogin()" style="background:#0089FF;border-color:#0089FF;font-size:16px;padding:14px 24px">
                📱 钉钉扫码 / 工作台登录
              </button>
              <div style="margin-top:10px;font-size:13px;color:var(--text-muted)">通过钉钉自动登录，无需输入密码</div>
            ` : `
              <button class="btn btn-secondary btn-lg btn-block" style="font-size:16px;padding:14px 24px;opacity:.6" disabled>
                📱 钉钉扫码 / 工作台登录
              </button>
              <div style="margin-top:10px;font-size:13px;color:var(--text-muted)">
                钉钉登录需部署全栈版本并配置钉钉开放平台参数<br/>
                详见部署文档中的钉钉配置章节
              </div>
            `}
          </div>

          <!-- 管理员密码登录（备用） -->
          <div style="border-top:1px solid var(--border);padding-top:16px;margin-top:8px">
            <div style="font-size:13px;color:var(--text-muted);text-align:center;margin-bottom:12px">管理员备用登录</div>
            <div class="form-group">
              <label class="form-label">用户名</label>
              <input type="text" class="form-input" id="login_username" placeholder="管理员用户名" />
            </div>
            <div class="form-group">
              <label class="form-label">密码</label>
              <input type="password" class="form-input" id="login_password" placeholder="密码" onkeypress="if(event.key==='Enter')App.doLogin()" />
            </div>
            <button class="btn btn-secondary btn-block" onclick="App.doLogin()" style="margin-top:8px">管理员登录</button>
          </div>
        </div>
      </div>
    `;
  }

  function doLogin() {
    const username = document.getElementById('login_username').value.trim();
    const password = document.getElementById('login_password').value.trim();
    if (!username || !password) { toast('请输入用户名和密码', 'error'); return; }
    login(username, password);
  }

  return {
    init, navigate, logout, doLogin, dingtalkLogin,
    get currentUser() { return currentUser; },
    get currentRoute() { return currentRoute; },
    render,
  };
})();

// 启动
document.addEventListener('DOMContentLoaded', App.init);
