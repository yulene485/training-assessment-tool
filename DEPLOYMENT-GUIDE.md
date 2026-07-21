# 员工培训考核系统 - 部署与维护指南

本文档涵盖三条核心部署路径：EdgeOne Pages 持久化部署、钉钉开放平台集成、代码维护流程。

---

## 目录

1. [EdgeOne Pages 持久化部署](#1-edgeone-pages-持久化部署)
2. [钉钉开放平台配置](#2-钉钉开放平台配置)
3. [代码维护流程](#3-代码维护流程)

---

## 1. EdgeOne Pages 持久化部署

EdgeOne Pages 是腾讯云提供的免费静态站点托管服务，适合部署本系统的**纯前端版本**（`frontend-only/` 目录）。部署后可获得持久可用的 HTTPS 域名，不会因会话结束而消失。

### 1.1 前置条件

- 注册腾讯云账号（https://cloud.tencent.com）
- 开通 EdgeOne 服务（https://edgeone.ai）
- 将项目代码推送到 Git 仓库（GitHub / GitLab / Gitee / Codeup 均可）

### 1.2 准备 Git 仓库

```bash
# 1. 在项目根目录初始化 Git（如果尚未初始化）
cd training-assessment-tool
git init

# 2. 创建 .gitignore（如果还没有）
# 确保以下内容已被忽略
cat > .gitignore << 'EOF'
node_modules/
uploads/
*.log
.env
data/*.db
EOF

# 3. 添加文件并提交
git add .
git commit -m "feat: 初始化员工培训考核系统"

# 4. 推送到远程仓库（以 GitHub 为例）
git remote add origin https://github.com/你的用户名/training-assessment-tool.git
git branch -M main
git push -u origin main
```

### 1.3 在 EdgeOne Pages 创建项目

1. 登录 EdgeOne 控制台：https://console.cloud.tencent.com/edgeone
2. 左侧菜单选择 **站点加速** → **Pages** → **创建项目**
3. 选择 **从 Git 仓库导入**，授权并选择你的仓库
4. 配置构建设置：

| 配置项 | 值 |
|--------|-----|
| 框架预设 | 无（None） |
| 构建命令 | 留空（纯静态站点无需构建） |
| 输出目录 | `frontend-only` |
| 安装命令 | 留空 |

5. 点击 **部署**，等待部署完成（通常 30 秒内）

### 1.4 获取访问域名

部署成功后，EdgeOne 会自动分配一个 `*.edgeone.app` 格式的域名，例如：
```
https://training-assessment-tool-xxxxx.edgeone.app
```
此域名持久有效，可随时通过 EdgeOne 控制台查看。

### 1.5 绑定自定义域名（可选）

1. 在 EdgeOne 控制台进入项目 → **域名管理** → **添加域名**
2. 输入你的域名（如 `train.yourcompany.com`）
3. 按提示在域名 DNS 服务商添加 CNAME 记录：
   ```
   类型: CNAME
   主机记录: train
   记录值: xxxxx.edgeone.app
   ```
4. 等待 DNS 生效（通常几分钟到几小时），EdgeOne 会自动签发 SSL 证书

### 1.6 自动部署配置

EdgeOne Pages 默认在 Git 仓库 `main` 分有新提交时自动触发部署。可在控制台 → **部署设置** 中：
- 修改触发分支（如改为 `production`）
- 设置部署预览（每个 PR 自动生成预览链接）
- 配置环境变量（如需切换 API 地址）

### 1.7 部署验证清单

- [ ] 访问分配的 `.edgeone.app` 域名，页面正常加载
- [ ] 登录功能正常（admin/admin123）
- [ ] 资料上传、预览、下载正常
- [ ] 考试功能正常（开始考试、答题、提交、查看成绩）
- [ ] 封面图片上传与裁剪正常
- [ ] 移动端响应式布局正常

---

## 2. 钉钉开放平台配置

钉钉集成需要**全栈版本**（Node.js 后端），支持两个功能：
- **扫码免登**：员工通过钉钉扫码直接登录系统
- **消息推送**：考试发布、成绩出榜时自动推送钉钉工作通知

### 2.1 创建钉钉企业内部应用

1. 登录钉钉开放平台：https://open-dev.dingtalk.com/
2. 进入 **应用开发** → **企业内部开发** → **创建应用**
3. 填写应用信息：

| 字段 | 值 |
|------|-----|
| 应用名称 | 员工培训考核系统 |
| 应用描述 | 企业内部培训考核平台 |
| 应用图标 | 上传一张应用图标 |
| 应用首页地址 | `https://你的域名/` |
| 应用类型 | 小程序 / H5 微应用（根据需求选择） |

4. 创建成功后，在 **凭证与基础信息** 页面获取：
   - **AppKey**（应用唯一标识）
   - **AppSecret**（应用密钥）
   - **CorpId**（企业 ID，在 企业信息 页面查看）

### 2.2 配置扫码登录

1. 在应用管理页面 → **登录与分享** → **扫码登录**
2. 配置回调地址：
   ```
   https://你的域名/api/auth/dingtalk/callback
   ```
   > 注意：回调地址必须与实际部署域名一致，支持 HTTPS
3. 权限范围勾选：
   - `snsapi_login` - 扫码登录
   - `snsapi_auth` - 获取用户 userid

### 2.3 配置消息推送权限

1. 在应用管理页面 → **权限管理** → 申请以下权限：

| 权限名称 | 权限标识 | 用途 |
|----------|----------|------|
| 通讯录个人信息读权限 | `Contact.User.Read` | 获取员工姓名、部门 |
| 个人手机号信息 | `personal_phone` | 匹配系统用户 |
| 工作通知消息发送权限 | `Notification.CorpMessage` | 推送考试/成绩通知 |

2. 权限需要管理员审批，审批通过后生效

### 2.4 配置应用回调地址

1. 在 **事件与回调** → **事件订阅** 页面：
   - 请求地址：`https://你的域名/api/dingtalk/callback`
   - 加解密密钥：自动生成或手动设置（记录备用）

2. 订阅事件（按需选择）：
   - `user_add_org` - 员工入职
   - `user_modify_org` - 员工信息变更
   - `user_leave_org` - 员工离职

### 2.5 配置环境变量

在服务器项目的 `.env` 文件中填入钉钉凭证：

```bash
# .env 文件
DINGTALK_APP_KEY=dingxxxxxxxxxxxx
DINGTALK_APP_SECRET=your_app_secret_here
DINGTALK_CORP_ID=dingxxxxxxxxxxxx

# 回调地址（与钉钉开放平台配置一致）
DINGTALK_CALLBACK_URL=https://你的域名/api/auth/dingtalk/callback

# JWT 密钥（建议使用随机长字符串）
JWT_SECRET=your_random_jwt_secret_at_least_32_chars

# 服务器端口
PORT=3000
```

### 2.6 钉钉集成验证

1. 启动全栈服务：
   ```bash
   cd training-assessment-tool
   npm install
   npm start
   ```
2. 访问 `http://localhost:3000`，登录页面应显示钉钉扫码按钮
3. 点击钉钉扫码按钮，跳转到钉钉授权页面
4. 用钉钉 APP 扫码确认，自动跳回系统并登录

### 2.7 消息推送模板

系统已内置两种钉钉工作通知模板：

**考试发布通知**：
```
📋 新考试通知
考试名称：信息安全基础考核
考试时长：20 分钟
及格线：60%
请及时参加考试。
```

**成绩公布通知**：
```
📊 考试成绩通知
考试名称：信息安全基础考核
你的得分：85 / 70
结果：✅ 通过
```

> 消息推送通过 `server/dingtalk.js` 中的 `sendWorkNotification()` 方法实现，可在代码中自定义模板内容。

---

## 3. 代码维护流程

### 3.1 项目结构说明

```
training-assessment-tool/
├── frontend-only/          # 纯前端版本（部署到 EdgeOne Pages）
│   ├── index.html          # 入口页面
│   ├── css/styles.css      # 全局样式
│   └── js/
│       ├── data.js         # 数据层（localStorage）
│       ├── fileutil.js      # 文件处理工具
│       ├── admin.js         # 管理员模块
│       ├── employee.js      # 员工模块
│       ├── exam.js          # 考试引擎
│       ├── reports.js       # 报告与统计
│       └── app.js           # 主应用（路由、登录）
├── server/                  # 全栈版本后端
│   ├── index.js            # Express 服务入口
│   ├── database.js         # SQLite 数据库（sql.js）
│   └── dingtalk.js         # 钉钉 SDK 封装
├── package.json            # 依赖与脚本
├── .env.example            # 环境变量模板
└── DEPLOYMENT-GUIDE.md     # 本文档
```

### 3.2 拉取代码

```bash
# 首次拉取
git clone https://github.com/你的用户名/training-assessment-tool.git
cd training-assessment-tool

# 后续更新
git pull origin main
```

### 3.3 本地调试

#### 纯前端版本（无需安装依赖）

```bash
# 方法 1：直接用浏览器打开
# 直接双击 frontend-only/index.html 即可

# 方法 2：启动本地静态服务器（推荐，避免 file:// 协议限制）
cd frontend-only

# 使用 Python
python -m http.server 8080

# 或使用 Node.js
npx serve .

# 然后访问 http://localhost:8080
```

#### 全栈版本（需 Node.js 环境）

```bash
# 1. 安装依赖
npm install

# 2. 复制环境变量配置
cp .env.example .env
# 编辑 .env 填入钉钉凭证等配置

# 3. 启动开发服务器（支持热重载）
npm run dev

# 4. 访问 http://localhost:3000
```

> 开发模式下修改 `server/` 下的文件会自动重启服务。修改 `frontend-only/` 或根目录的 `js/`、`css/` 文件需手动刷新浏览器。

### 3.4 修改代码

#### 常见修改场景

**场景 1：修改页面文字或样式**
- 页面文字：在 `js/admin.js` 或 `js/employee.js` 中搜索对应文字修改
- 样式调整：编辑 `css/styles.css`，修改 CSS 变量或具体样式规则

**场景 2：新增一道考试题目**
1. 登录管理员账号
2. 进入「题库管理」→「新增题目」
3. 选择题型、填写题干、选项、正确答案
4. 进入「考试配置」→ 编辑或创建考试 → 勾选新增的题目

**场景 3：修改考试规则（时长、及格线等）**
1. 登录管理员 → 「考试配置」→ 编辑考试
2. 直接在表单中修改时长、及格线、考试次数等参数

**场景 4：调整系统颜色主题**
编辑 `css/styles.css` 顶部的 CSS 变量：
```css
:root {
  --primary: #2563eb;       /* 主色调 */
  --primary-dark: #1d4ed8;  /* 深色 */
  --success: #16a34a;       /* 成功色 */
  --danger: #dc2626;        /* 危险色 */
  /* ... 其他变量 */
}
```

### 3.5 提交修改

```bash
# 1. 查看修改了哪些文件
git status

# 2. 查看具体修改内容
git diff

# 3. 添加修改的文件
git add .

# 4. 提交（使用规范的 commit 信息）
git commit -m "feat: 新增考试统计导出功能"
# 或
git commit -m "fix: 修复考试倒计时显示错误"
# 或
git commit -m "docs: 更新部署文档"

# 5. 推送到远程仓库
git push origin main
```

#### Commit 信息规范

| 前缀 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: 新增封面图片裁剪功能` |
| `fix` | 修复 Bug | `fix: 修复考试提交后成绩不显示` |
| `docs` | 文档更新 | `docs: 更新部署指南` |
| `style` | 样式调整 | `style: 调整卡片间距` |
| `refactor` | 代码重构 | `refactor: 重构数据层 API` |
| `chore` | 杂项 | `chore: 更新依赖版本` |

### 3.6 重新部署

#### 纯前端版本（EdgeOne Pages 自动部署）

```bash
# 只需推送到 main 分支，EdgeOne Pages 会自动触发部署
git push origin main

# 在 EdgeOne 控制台可查看部署进度
# 通常 30 秒内完成，无需手动操作
```

#### 全栈版本（服务器手动部署）

```bash
# 1. SSH 登录服务器
ssh user@your-server

# 2. 进入项目目录
cd /opt/training-assessment-tool

# 3. 拉取最新代码
git pull origin main

# 4. 安装新依赖（如果 package.json 有变化）
npm install

# 5. 重启服务（使用 PM2）
pm2 restart training-assessment-tool

# 或直接使用 nodemon / node
# pm2 reload training-assessment-tool  # 零停机重启
```

#### 使用 PM2 管理进程（推荐）

```bash
# 安装 PM2（如果尚未安装）
npm install -g pm2

# 首次启动
pm2 start server/index.js --name training-assessment-tool

# 设置开机自启
pm2 startup
pm2 save

# 常用命令
pm2 status                          # 查看状态
pm2 logs training-assessment-tool   # 查看日志
pm2 restart training-assessment-tool # 重启
pm2 stop training-assessment-tool    # 停止
```

### 3.7 数据备份与恢复

#### 纯前端版本（localStorage 数据）

```javascript
// 在浏览器控制台执行

// 导出所有数据
const data = localStorage.getItem('etms_data');
const blob = new Blob([data], { type: 'application/json' });
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = `etms-backup-${Date.now()}.json`;
a.click();

// 导入数据
const input = document.createElement('input');
input.type = 'file';
input.onchange = (e) => {
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.onload = (ev) => {
    localStorage.setItem('etms_data', ev.target.result);
    location.reload();
  };
  reader.readAsText(file);
};
input.click();

// 重置为初始数据
// localStorage.removeItem('etms_data'); location.reload();
```

#### 全栈版本（SQLite 数据库）

```bash
# 备份
cp data/training.db data/training-backup-$(date +%Y%m%d).db

# 恢复
cp data/training-backup-20260720.db data/training.db
pm2 restart training-assessment-tool
```

### 3.8 常见问题排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 页面空白 | JS 文件加载失败 | 检查浏览器控制台（F12），确认文件路径正确 |
| 数据丢失 | 浏览器清除缓存 | 纯前端版数据存在 localStorage，清除缓存会丢失 |
| 封面上传后不显示 | 图片过大导致 localStorage 溢出 | 裁剪后图片建议小于 500KB |
| 钉钉扫码无响应 | 回调地址不匹配 | 检查 .env 中 CALLBACK_URL 与钉钉平台配置一致 |
| EdgeOne 部署失败 | 输出目录配置错误 | 确认输出目录为 `frontend-only` |
| 考试提交后无成绩 | 自动批改逻辑异常 | 检查题目是否设置了正确答案 |

---

## 附录：演示账号

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 管理员 | admin | admin123 | 可管理所有功能 |
| 员工 | employee | 123456 | 张明 / 研发部 |
| 员工 | lina | 123456 | 李娜 / 市场部 |
| 员工 | wangwu | 123456 | 王五 / 研发部 |

---

*文档版本：v2.0 | 最后更新：2026-07-20*
