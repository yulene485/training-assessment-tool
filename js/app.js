/* ============================================================
   主应用 - 路由、登录、布局、通用工具
   - 支持：本地账号登录 + 钉钉扫码免登
   - 数据初始化从服务器 API 加载
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

// ============ 确认对话框 ============
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
  let dingtalkConfigured = false;
  let dingtalkLoginUrl = '';

  // 路由表
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

  async function init() {
    // 恢复会话
    const session = DB.getSession();
    if (session && session.token) {
      // 有 token：验证并加载数据
      try {
        await DB.init();
        currentUser = session.user;
        currentRoute = session.route || (currentUser.role === 'admin' ? 'dashboard' : 'home');
        render();
        return;
      } catch (e) {
        // token 过期，清除会话
        DB.clearSession();
        currentUser = null;
      }
    }
    // 获取钉钉配置状态
    try {
      const res = await fetch('/api/auth/dingtalk/status');
      const data = await res.json();
      dingtalkConfigured = data.configured;
      dingtalkLoginUrl = data.loginUrl;
    } catch { /* 服务器未运行时不报错 */ }
    render();
  }

  async function login(username, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || '登录失败', 'error'); return false; }

      currentUser = data.user;
      currentRoute = currentUser.role === 'admin' ? 'dashboard' : 'home';
      DB.setSession({ token: data.token, user: data.user, route: currentRoute });

      // 加载数据
      await DB.init();
      render();
      toast(`欢迎回来，${currentUser.name}`, 'success');
      return true;
    } catch (e) {
      toast('登录失败: ' + e.message, 'error');
      return false;
    }
  }

  // 钉钉扫码登录
  async function dingtalkLogin(authCode) {
    try {
      const res = await fetch('/api/auth/dingtalk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authCode }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || '钉钉登录失败', 'error'); return false; }

      currentUser = data.user;
      currentRoute = currentUser.role === 'admin' ? 'dashboard' : 'home';
      DB.setSession({ token: data.token, user: data.user, route: currentRoute });

      await DB.init();
      render();
      toast(`钉钉登录成功，${currentUser.name}`, 'success');
      return true;
    } catch (e) {
      toast('钉钉登录失败: ' + e.message, 'error');
      return false;
    }
  }

  function logout() {
    confirmDialog('确定退出登录吗？', () => {
      currentUser = null;
      DB.clearSession();
      render();
    });
  }

  function navigate(route, params = {}) {
    currentRoute = route;
    routeParams = params;
    if (currentUser) DB.setSession({ token: DB.getSession().token, user: currentUser, route });
    render();
    document.querySelector('.sidebar')?.classList.remove('open');
    document.querySelector('.sidebar-overlay')?.classList.remove('open');
  }

  function render() {
    const app = document.getElementById('app');
    if (!currentUser) {
      app.innerHTML = renderLogin();
      bindLoginEvents();
      return;
    }
    const routes = currentUser.role === 'admin' ? adminRoutes : employeeRoutes;
    if (!routes[currentRoute]) currentRoute = currentUser.role === 'admin' ? 'dashboard' : 'home';
    const route = routes[currentRoute];

    app.innerHTML = `
      <div class="layout">
        ${renderSidebar(routes)}
        <div class="sidebar-overlay" onclick="document.querySelector('.sidebar').classList.remove('open');this.classList.remove('open')"></div>
        <div class="main-area">
          <div class="topbar">
            <button class="menu-toggle" onclick="document.querySelector('.sidebar').classList.add('open');document.querySelector('.sidebar-overlay').classList.add('open')">☰</button>
            <div class="page-title">${route.icon} ${route.title}</div>
            <div class="topbar-right">
              <span style="font-size:13px;color:var(--text-muted)">${formatDateTime(Date.now()).split(' ')[0]}</span>
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
    const sections = currentUser.role === 'admin'
      ? [{ title: '管理', items: ['dashboard', 'materials', 'questions', 'exams'] }, { title: '数据', items: ['records', 'analytics', 'users'] }]
      : [{ title: '学习', items: ['home', 'learnCenter'] }, { title: '考核', items: ['exams', 'myResults'] }];

    return `
      <div class="sidebar">
        <div class="sidebar-header">
          <div class="logo-icon">🎓</div>
          <div class="logo-text">培训考核系统</div>
        </div>
        <div class="sidebar-nav">
          ${sections.map(sec => `
            <div class="nav-section-title">${sec.title}</div>
            ${sec.items.map(key => {
              const r = routes[key];
              return `<div class="nav-item ${currentRoute === key ? 'active' : ''}" onclick="App.navigate('${key}')">
                <span class="nav-icon">${r.icon}</span><span>${r.title}</span>
              </div>`;
            }).join('')}
          `).join('')}
        </div>
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="avatar">${escapeHtml(initials)}</div>
            <div class="user-info">
              <div class="user-name">${escapeHtml(currentUser.name)}</div>
              <div class="user-role">${currentUser.role === 'admin' ? '管理员' : '员工'}${currentUser.dept ? ' · ' + escapeHtml(currentUser.dept) : ''}</div>
            </div>
            <button class="logout-btn" onclick="App.logout()" title="退出登录">⏻</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderLogin() {
    return `
      <div class="login-page">
        <div class="login-card">
          <div class="login-logo">
            <div class="logo-icon">🎓</div>
            <h1>员工培训考核系统</h1>
            <p>Enterprise Training & Assessment Platform</p>
          </div>
          <div class="role-tabs">
            <div class="role-tab active" data-role="employee" onclick="App.switchRole('employee')">👤 员工登录</div>
            <div class="role-tab" data-role="admin" onclick="App.switchRole('admin')">🛡️ 管理员登录</div>
          </div>
          <div class="form-group">
            <label class="form-label">用户名</label>
            <input type="text" class="form-input" id="login_username" placeholder="请输入用户名" />
          </div>
          <div class="form-group">
            <label class="form-label">密码</label>
            <input type="password" class="form-input" id="login_password" placeholder="请输入密码" onkeypress="if(event.key==='Enter')App.doLogin()" />
          </div>
          <button class="btn btn-primary btn-lg btn-block" onclick="App.doLogin()" style="margin-top:8px">登 录</button>
          ${dingtalkConfigured ? `
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);text-align:center">
            <button class="btn btn-secondary btn-block" onclick="App.openDingtalkLogin()">🔗 钉钉扫码登录</button>
            <div style="font-size:12px;color:var(--text-muted);margin-top:6px">使用钉钉扫码免密登录</div>
          </div>
          ` : ''}
          <div class="demo-hint">
            <strong>演示账号：</strong><br/>
            管理员：admin / admin123<br/>
            员工：employee / 123456<br/>
            员工：lina / 123456
          </div>
        </div>
      </div>
    `;
  }

  // 打开钉钉扫码登录弹窗
  function openDingtalkLogin() {
    if (!dingtalkLoginUrl) {
      toast('钉钉登录未配置，请联系管理员', 'warning');
      return;
    }
    openModal({
      title: '钉钉扫码登录',
      size: 'lg',
      body: `
        <div style="text-align:center;padding:20px">
          <div style="margin-bottom:16px;font-size:15px">请使用钉钉扫描下方二维码登录</div>
          <div id="dingtalk_qrcode" style="min-height:300px;display:flex;align-items:center;justify-content:center">
            <div style="color:var(--text-muted)">正在加载钉钉登录二维码...</div>
          </div>
          <div style="margin-top:12px;font-size:12px;color:var(--text-muted)">扫码后将自动跳转，如遇到问题可使用账号密码登录</div>
        </div>
      `,
      okText: '关闭',
      cancelHidden: true,
      onOk: () => true,
      onShown: () => {
        // 使用钉钉官方扫码登录 JS SDK
        const container = document.getElementById('dingtalk_qrcode');
        if (!container) return;

        // 动态加载钉钉登录 JS
        const script = document.createElement('script');
        script.src = 'https://g.alicdn.com/dingding/h5-dingtalk-login/0.21.0/ddlogin.js';
        script.onload = () => {
          const goto = dingtalkLoginUrl;
          const callbackUrl = new URL(goto).searchParams.get('goto') || window.location.origin + '/api/auth/dingtalk/callback';

          // 使用钉钉扫码登录组件
          if (window.DTFrameLogin) {
            window.DTFrameLogin(
              { id: 'dingtalk_qrcode', width: 300, height: 300 },
              { goto: goto, style: 'border:none', width: '300', height: '300' },
              (loginResult) => {
                // 获取 authCode
                const authCode = loginResult.redirectUrl.match(/authCode=([^&]+)/)?.[1];
                if (authCode) {
                  App.dingtalkLogin(authCode);
                }
              },
              (error) => {
                container.innerHTML = `<div style="color:var(--danger)">钉钉登录失败: ${error.errorMessage || '未知错误'}</div>`;
              }
            );
          } else {
            // 备选方案：直接跳转钉钉登录页面
            container.innerHTML = `
              <div style="padding:30px;text-align:center">
                <p>点击下方按钮跳转到钉钉登录页面</p>
                <button class="btn btn-primary" onclick="window.location.href='${goto}'" style="margin-top:12px">🔗 前往钉钉登录</button>
              </div>
            `;
          }
        };
        script.onerror = () => {
          container.innerHTML = `
            <div style="padding:30px;text-align:center">
              <p>钉钉登录组件加载失败</p>
              <button class="btn btn-primary" onclick="window.location.href='${dingtalkLoginUrl}'" style="margin-top:12px">🔗 前往钉钉登录</button>
            </div>
          `;
        };
        document.head.appendChild(script);
      },
    });
  }

  let selectedRole = 'employee';
  function switchRole(role) {
    selectedRole = role;
    document.querySelectorAll('.role-tab').forEach(t => t.classList.toggle('active', t.dataset.role === role));
    if (role === 'admin') {
      document.getElementById('login_username').value = 'admin';
      document.getElementById('login_password').value = 'admin123';
    } else {
      document.getElementById('login_username').value = 'employee';
      document.getElementById('login_password').value = '123456';
    }
  }
  function bindLoginEvents() {
    setTimeout(() => {
      const u = document.getElementById('login_username');
      const p = document.getElementById('login_password');
      if (u) u.value = 'employee';
      if (p) p.value = '123456';
    }, 0);
  }
  async function doLogin() {
    const username = document.getElementById('login_username').value.trim();
    const password = document.getElementById('login_password').value.trim();
    if (!username || !password) { toast('请输入用户名和密码', 'error'); return; }
    await login(username, password);
  }

  return {
    init, navigate, logout, switchRole, doLogin, dingtalkLogin, openDingtalkLogin,
    get currentUser() { return currentUser; },
    get currentRoute() { return currentRoute; },
    render,
  };
})();

// 启动
document.addEventListener('DOMContentLoaded', App.init);
