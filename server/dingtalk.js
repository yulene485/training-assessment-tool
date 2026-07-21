/* ============================================================
   钉钉开放平台 SDK 封装
   - OAuth2 扫码登录（获取用户信息）
   - 工作通知消息推送（考试通知、成绩推送）
   - 需要 AppKey + AppSecret（在 .env 中配置）
   ============================================================ */

const axios = require('axios');
const DB = require('./database');

const APP_KEY = process.env.DINGTALK_APP_KEY || '';
const APP_SECRET = process.env.DINGTALK_APP_SECRET || '';
const CORP_ID = process.env.DINGTALK_CORP_ID || '';

let accessTokenCache = { token: '', expiresAt: 0 };

// ---------- Access Token ----------
async function getAccessToken() {
  if (!APP_KEY || !APP_SECRET) return '';
  if (accessTokenCache.token && accessTokenCache.expiresAt > Date.now()) return accessTokenCache.token;

  const res = await axios.post('https://oapi.dingtalk.com/gettoken', {
    appkey: APP_KEY,
    appsecret: APP_SECRET,
  });
  const data = res.data;
  if (data.errcode !== 0) throw new Error(`钉钉获取token失败: ${data.errmsg}`);

  accessTokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 300) * 1000 };
  return data.access_token;
}

// ---------- OAuth2 扫码登录 ----------
// 前端用钉钉 JS SDK 获取 authCode，后端用 authCode 获取用户信息
async function getUserByAuthCode(authCode) {
  const token = await getAccessToken();
  if (!token) throw new Error('钉钉未配置');

  // 1. 用 authCode 获取用户 userid
  const res = await axios.post(`https://oapi.dingtalk.com/topapi/v2/user/getuserinfo?access_token=${token}`, {
    code: authCode,
  });
  if (res.data.errcode !== 0) throw new Error(`钉钉authCode换取userid失败: ${res.data.errmsg}`);
  const dingtalkUserId = res.data.result.userid;

  // 2. 用 userid 获取用户详情
  const detailRes = await axios.post(`https://oapi.dingtalk.com/topapi/v2/user/get?access_token=${token}`, {
    userid: dingtalkUserId,
  });
  if (detailRes.data.errcode !== 0) throw new Error(`钉钉获取用户详情失败: ${detailRes.data.errmsg}`);
  const userInfo = detailRes.result;

  return {
    dingtalkId: dingtalkUserId,
    name: userInfo.name || dingtalkUserId,
    dept: userInfo.dept_id_list ? String(userInfo.dept_id_list[0] || '') : '',
    mobile: userInfo.mobile || '',
    email: userInfo.email || '',
  };
}

// ---------- 创建/匹配本地用户 ----------
async function loginOrCreateUser(dingtalkUser) {
  // 先查找已有绑定
  const existing = DB.findUserByDingtalkId(dingtalkUser.dingtalkId);
  if (existing) {
    // 同步钉钉返回的最新信息（转岗时部门变更）
    if (dingtalkUser.dept && dingtalkUser.dept !== existing.dept) {
      DB.updateUser(existing.id, { dept: dingtalkUser.dept, position: dingtalkUser.position || existing.position });
    }
    // 离职检查：如果钉钉返回的状态不是活跃，标记账号停用
    if (dingtalkUser.status === 'inactive' || dingtalkUser.status === 'resigned') {
      DB.updateUser(existing.id, { status: 'disabled' });
      return { ...existing, status: 'disabled' };
    }
    return existing;
  }

  // 自动创建新用户（默认员工角色）
  const username = 'dt_' + dingtalkUser.dingtalkId;
  const newUser = DB.addUser({
    username,
    password: Math.random().toString(36).slice(2, 10),
    name: dingtalkUser.name,
    role: 'employee',
    dept: dingtalkUser.dept,
    position: dingtalkUser.position || '',
    job_number: dingtalkUser.jobNumber || '',
    dingtalk_id: dingtalkUser.dingtalkId,
  });
  return newUser;
}

// ---------- 同步所有钉钉用户的部门信息 ----------
async function syncDepartmentInfo() {
  const token = await getAccessToken();
  if (!token) throw new Error('钉钉未配置');

  // 获取所有钉钉用户列表
  const deptListRes = await axios.post(`https://oapi.dingtalk.com/topapi/v2department/listsub?access_token=${token}`, { dept_id: 1 });
  // 简化版：遍历所有已绑定钉钉ID的本地用户，获取最新部门信息
  const users = DB.getUsers();
  const synced = [];
  for (const u of users) {
    if (!u.dingtalk_id) continue;
    try {
      const detailRes = await axios.post(`https://oapi.dingtalk.com/topapi/v2/user/get?access_token=${token}`, { userid: u.dingtalk_id });
      if (detailRes.data.errcode === 0) {
        const info = detailRes.data.result;
        if (info.dept_id_list && String(info.dept_id_list[0] || '') !== u.dept) {
          DB.updateUser(u.id, { dept: String(info.dept_id_list[0] || ''), position: info.title || u.position });
          synced.push({ id: u.id, name: u.name, oldDept: u.dept, newDept: String(info.dept_id_list[0] || '') });
        }
      }
    } catch (e) { /* 单个用户同步失败不阻塞 */ }
  }
  return synced;
}

// ---------- 工作通知（消息推送） ----------
async function sendWorkNotification(userIds, message) {
  const token = await getAccessToken();
  if (!token) throw new Error('钉钉未配置');

  const res = await axios.post(`https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${token}`, {
    agent_id: APP_KEY,
    userid_list: userIds.join(','),
    msg: message,
  });
  if (res.data.errcode !== 0) throw new Error(`钉钉消息推送失败: ${res.data.errmsg}`);
  return res.data.task_id;
}

// 发送考试通知
async function notifyExamCreated(exam, userIds) {
  if (!APP_KEY || !APP_SECRET) return null;
  const dtUserIds = userIds
    .map(uid => DB.getUserById(uid))
    .filter(u => u && u.dingtalk_id)
    .map(u => u.dingtalk_id);

  if (!dtUserIds.length) return null;

  return sendWorkNotification(dtUserIds, {
    msgtype: 'oa',
    oa: {
      head: { text: '培训考核通知', bgcolor: 'FF2563EB' },
      body: {
        title: `新考试通知：${exam.title}`,
        content: `${exam.desc || '请尽快完成考核'}\n时长：${exam.duration}分钟 | 及格线：${exam.passScore}% | 题数：${(exam.questionIds || exam.question_ids || []).length}`,
        rich: { num: String((exam.questionIds || []).length), unit: '题' },
      },
    },
  });
}

// 发送成绩通知
async function notifyExamResult(record) {
  if (!APP_KEY || !APP_SECRET) return null;
  const user = DB.getUserById(record.userId);
  if (!user || !user.dingtalk_id) return null;

  return sendWorkNotification([user.dingtalk_id], {
    msgtype: 'oa',
    oa: {
      head: { text: '考核成绩通知', bgcolor: record.passed ? 'FF16A34A' : 'FFDC2626' },
      body: {
        title: `${record.examTitle} - 考核成绩`,
        content: `得分：${record.score}/${record.totalScore}\n结果：${record.passed ? '✅ 通过' : '❌ 未通过'}`,
      },
    },
  });
}

// ---------- 生成钉钉扫码登录 URL ----------
function getLoginUrl(callbackUrl) {
  if (!APP_KEY) return '';
  return `https://login.dingtalk.com/login/qrcode.htm?goto=${encodeURIComponent(callbackUrl)}&appkey=${APP_KEY}`;
}

// ---------- 判断钉钉是否已配置 ----------
function isConfigured() {
  return !!APP_KEY && !!APP_SECRET;
}

module.exports = {
  getAccessToken,
  getUserByAuthCode,
  loginOrCreateUser,
  sendWorkNotification,
  notifyExamCreated,
  notifyExamResult,
  getLoginUrl,
  isConfigured,
  syncDepartmentInfo,
};
