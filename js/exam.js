/* ============================================================
   考试引擎
   - 启动考试（组装题目、随机排序）
   - 倒计时（自动提交）
   - 断线续考（自动保存到 localStorage）
   - 自动批改（单选/多选/判断）
   - 成绩生成与结果展示
   ============================================================ */

const Exam = (() => {
  let state = null;     // 当前考试运行态
  let timerId = null;   // 倒计时句柄
  let saveId = null;    // 自动保存句柄

  // ---------- 开始考试 ----------
  function start(exam) {
    const uid = App.currentUser.id;
    // 组装题目
    let questions = exam.questionIds.map(qid => DB.getQuestionById(qid)).filter(Boolean);
    // 随机排序
    if (exam.randomOrder) {
      questions = shuffle(questions);
      // 选项也随机打乱（判断题除外）
      questions = questions.map(q => {
        if (q.type === 'judge') return q;
        const idxs = q.options.map((_, i) => i);
        const shuffled = shuffle(idxs);
        const newOptions = shuffled.map(i => q.options[i]);
        const newAnswer = q.answer.map(a => shuffled.indexOf(a));
        return { ...q, options: newOptions, answer: newAnswer };
      });
    }

    state = {
      exam,
      questions,
      answers: {},          // { questionId: [optionIndex,...] }
      current: 0,
      flagged: {},          // 标记的题目
      startedAt: Date.now(),
      duration: exam.duration * 60 * 1000, // 毫秒
      remaining: exam.duration * 60 * 1000,
      attempt: DB.getRecordsByUser(uid).filter(r => r.examId === exam.id).length + 1,
    };

    // 保存断线续考进度
    saveInProgress();

    renderExam();
    startTimer();
    startAutoSave();

    // 离开页面警告
    window.addEventListener('beforeunload', beforeUnloadHandler);
  }

  // ---------- 断线续考 ----------
  function resume(exam, ip) {
    const questions = exam.questionIds.map(qid => DB.getQuestionById(qid)).filter(Boolean);
    // 恢复时题目顺序无法完全还原（随机），这里使用保存的题目快照
    const savedQuestions = ip.questions || questions;
    state = {
      exam,
      questions: savedQuestions,
      answers: ip.answers || {},
      current: ip.current || 0,
      flagged: ip.flagged || {},
      startedAt: ip.startedAt,
      duration: exam.duration * 60 * 1000,
      // 剩余时间 = 原剩余 - 离开期间流逝（按提交时间计算）
      remaining: Math.max(0, ip.remaining - (Date.now() - ip.savedAt)),
      attempt: ip.attempt,
    };
    if (state.remaining <= 0) {
      toast('考试已超时，自动提交', 'warning');
      submit();
      return;
    }
    renderExam();
    startTimer();
    startAutoSave();
    window.addEventListener('beforeunload', beforeUnloadHandler);
    toast('已恢复上次考试进度', 'success');
  }

  function beforeUnloadHandler(e) {
    if (state) {
      e.preventDefault();
      e.returnValue = '';
      saveInProgress();
    }
  }

  // ---------- 倒计时 ----------
  function startTimer() {
    stopTimer();
    const tick = () => {
      if (!state) return;
      state.remaining -= 1000;
      if (state.remaining <= 0) {
        state.remaining = 0;
        updateTimerUI();
        toast('考试时间到，自动提交', 'warning');
        submit();
        return;
      }
      updateTimerUI();
    };
    timerId = setInterval(tick, 1000);
    updateTimerUI();
  }
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

  function updateTimerUI() {
    const el = document.getElementById('exam_timer');
    if (!el || !state) return;
    const sec = Math.floor(state.remaining / 1000);
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    el.textContent = `⏱️ ${m}:${s}`;
    el.classList.remove('warning', 'danger');
    if (state.remaining < 60000) el.classList.add('danger');
    else if (state.remaining < 180000) el.classList.add('warning');
  }

  // ---------- 自动保存 ----------
  function startAutoSave() {
    stopAutoSave();
    saveId = setInterval(saveInProgress, 5000); // 每 5 秒保存
  }
  function stopAutoSave() { if (saveId) { clearInterval(saveId); saveId = null; } }

  function saveInProgress() {
    if (!state) return;
    DB.saveInProgress({
      userId: App.currentUser.id,
      examId: state.exam.id,
      questions: state.questions,
      answers: state.answers,
      current: state.current,
      flagged: state.flagged,
      startedAt: state.startedAt,
      remaining: state.remaining,
      attempt: state.attempt,
      savedAt: Date.now(),
    });
  }

  // ---------- 渲染考试界面 ----------
  function renderExam() {
    if (!state) return;
    const app = document.getElementById('app');
    const exam = state.exam;
    const q = state.questions[state.current];
    const answered = Object.keys(state.answers).length;
    const total = state.questions.length;
    const progressPct = Math.round(answered / total * 100);

    app.innerHTML = `
      <div style="padding:16px 24px;background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost" onclick="Exam.exitConfirm()">← 退出</button>
        <div>
          <div style="font-weight:600">${escapeHtml(exam.title)}</div>
          <div style="font-size:12px;color:var(--text-muted)">第 ${state.attempt} 次考试 · 进度自动保存</div>
        </div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:16px">
          <div style="font-size:13px;color:var(--text-secondary)">已答 <strong>${answered}</strong>/${total}</div>
          <div class="timer" id="exam_timer">⏱️ --:--</div>
        </div>
      </div>
      <div class="content" style="max-width:860px">
        <div class="exam-container">
          <!-- 答题进度条 -->
          <div style="background:var(--surface);border-radius:10px;border:1px solid var(--border);padding:14px 16px;margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
              <span>答题进度</span>
              <span>${progressPct}%</span>
            </div>
            <div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">
              <div style="width:${progressPct}%;height:100%;background:var(--primary);transition:width .3s"></div>
            </div>
          </div>

          <!-- 题目导航网格 -->
          <div class="question-nav-grid">
            ${state.questions.map((qq, i) => {
              const isAnswered = state.answers[qq.id] !== undefined && state.answers[qq.id].length > 0;
              const isCurrent = i === state.current;
              const isFlagged = state.flagged[qq.id];
              return `<button class="q-nav-btn ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''} ${isFlagged ? 'flagged' : ''}" onclick="Exam.goto(${i})">${i + 1}</button>`;
            }).join('')}
          </div>

          <!-- 当前题目 -->
          ${renderQuestion(q)}

          <!-- 导航按钮 -->
          <div class="exam-nav">
            <button class="btn btn-secondary" onclick="Exam.prev()" ${state.current === 0 ? 'disabled' : ''}>← 上一题</button>
            <div style="display:flex;gap:8px">
              <button class="btn btn-ghost" onclick="Exam.toggleFlag('${q.id}')">
                ${state.flagged[q.id] ? '🚩 取消标记' : '🏴 标记本题'}
              </button>
              ${state.current < total - 1
                ? `<button class="btn btn-primary" onclick="Exam.next()">下一题 →</button>`
                : `<button class="btn btn-success" onclick="Exam.submitConfirm()">✅ 交卷</button>`}
            </div>
          </div>
        </div>
      </div>
    `;
    updateTimerUI();
  }

  function renderQuestion(q) {
    const typeLabels = { single: '单选题', multiple: '多选题', judge: '判断题' };
    const userAns = state.answers[q.id] || [];
    const isMulti = q.type === 'multiple';
    const inputType = isMulti ? 'checkbox' : 'radio';

    return `
      <div class="question-card">
        <div class="question-num">
          <span class="q-num">第 ${state.current + 1} 题 / 共 ${state.questions.length} 题</span>
          <span class="badge badge-info q-type-badge">${typeLabels[q.type]}</span>
          <span class="q-score">${q.score} 分</span>
          ${state.flagged[q.id] ? '<span class="badge badge-warning">🚩 已标记</span>' : ''}
        </div>
        <div class="question-text">${escapeHtml(q.stem)}</div>
        <div class="options-list">
          ${q.options.map((opt, i) => {
            const selected = userAns.includes(i);
            return `<div class="option-item ${isMulti ? 'checkbox' : ''} ${selected ? 'selected' : ''}" onclick="Exam.select('${q.id}', ${i}, ${isMulti})">
              <div class="option-marker">${isMulti ? '' : String.fromCharCode(65 + i)}</div>
              <div class="option-text">${escapeHtml(opt)}</div>
            </div>`;
          }).join('')}
        </div>
        ${isMulti ? '<div class="form-hint" style="margin-top:10px">💡 多选题：点击选项可勾选/取消，可多选</div>' : ''}
      </div>
    `;
  }

  // ---------- 答题操作 ----------
  function select(qid, idx, isMulti) {
    if (!state.answers[qid]) state.answers[qid] = [];
    if (isMulti) {
      const arr = state.answers[qid];
      const i = arr.indexOf(idx);
      if (i === -1) arr.push(idx);
      else arr.splice(i, 1);
    } else {
      state.answers[qid] = [idx];
    }
    renderExam();
  }

  function goto(i) { state.current = i; renderExam(); }
  function next() { if (state.current < state.questions.length - 1) { state.current++; renderExam(); } }
  function prev() { if (state.current > 0) { state.current--; renderExam(); } }
  function toggleFlag(qid) { state.flagged[qid] = !state.flagged[qid]; renderExam(); }

  function exitConfirm() {
    confirmDialog('退出考试？已答内容将自动保存，可稍后继续。', () => {
      cleanup();
      App.navigate('exams');
      toast('考试已暂存，可随时继续', 'success');
    });
  }

  function submitConfirm() {
    const unanswered = state.questions.filter(q => !state.answers[q.id] || state.answers[q.id].length === 0).length;
    const msg = unanswered > 0
      ? `还有 ${unanswered} 题未作答，确定交卷吗？交卷后无法修改。`
      : '确定交卷吗？交卷后无法修改。';
    confirmDialog(msg, () => submit(), null, '确认交卷', '继续答题');
  }

  // ---------- 自动批改 ----------
  function submit() {
    if (!state) return;
    saveInProgress();
    stopTimer();
    stopAutoSave();

    let totalScore = 0;
    let correctCount = 0;
    const details = state.questions.map(q => {
      const userAns = (state.answers[q.id] || []).slice().sort((a, b) => a - b);
      const correctAns = q.answer.slice().sort((a, b) => a - b);
      const isCorrect = JSON.stringify(userAns) === JSON.stringify(correctAns);
      const earned = isCorrect ? q.score : 0;
      if (isCorrect) correctCount++;
      totalScore += earned;
      return {
        questionId: q.id,
        stem: q.stem,
        type: q.type,
        options: q.options,
        userAnswer: userAns,
        correctAnswer: correctAns,
        isCorrect,
        score: q.score,
        earned,
        analysis: q.analysis || '',
      };
    });

    const exam = state.exam;
    const scorePct = Math.round(totalScore / exam.totalScore * 100);
    const passed = scorePct >= exam.passScore;
    const duration = Math.round((Date.now() - state.startedAt) / 1000);

    const record = {
      examId: exam.id,
      examTitle: exam.title,
      userId: App.currentUser.id,
      userName: App.currentUser.name,
      dept: App.currentUser.dept || '',
      score: totalScore,
      totalScore: exam.totalScore,
      passScore: exam.passScore,
      passed,
      answers: state.answers,
      duration,
      startedAt: state.startedAt,
      submittedAt: Date.now(),
      attempt: state.attempt,
      details,
      correctCount,
      questionCount: state.questions.length,
    };
    const saved = DB.addRecord(record);
    DB.removeInProgress(App.currentUser.id, exam.id);

    cleanup();
    showResult(saved);
  }

  function showResult(record) {
    const pct = Math.round(record.score / record.totalScore * 100);
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="content" style="max-width:860px">
        <div class="result-hero ${record.passed ? 'pass' : 'fail'}">
          <div class="score-circle">${record.score}<div style="font-size:16px;font-weight:400;opacity:.7">/${record.totalScore}</div></div>
          <div class="result-status">${record.passed ? '🎉 恭喜通过！' : '😕 未通过'}</div>
          <div class="result-meta">
            ${record.examTitle} · 得分率 ${pct}%（及格线 ${record.passScore}%） ·
            答对 ${record.correctCount}/${record.questionCount} 题 ·
            用时 ${Math.round(record.duration / 60)} 分钟
          </div>
        </div>
        <div style="display:flex;gap:10px;justify-content:center;margin-bottom:20px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="Reports.viewRecord('${record.id}')">📋 查看答题详情</button>
          <button class="btn btn-secondary" onclick="Reports.exportSingleRecord('${record.id}')">⬇️ 导出成绩单</button>
          <button class="btn btn-secondary" onclick="App.navigate('exams')">返回考试列表</button>
        </div>
        <div class="card" style="padding:20px">
          <h4 style="margin-bottom:14px">📊 答题概览</h4>
          <div class="question-nav-grid">
            ${record.details.map((d, i) => `
              <button class="q-nav-btn ${d.isCorrect ? 'answered' : 'flagged'}" onclick="Reports.viewRecord('${record.id}')" title="${d.isCorrect ? '答对' : '答错'}">${i + 1}</button>
            `).join('')}
          </div>
          <div style="display:flex;gap:16px;font-size:13px;color:var(--text-muted);margin-top:10px">
            <span>🟢 答对 ${record.correctCount} 题</span>
            <span>🟧 答错 ${record.questionCount - record.correctCount} 题</span>
          </div>
        </div>
      </div>
    `;
  }

  function cleanup() {
    stopTimer();
    stopAutoSave();
    state = null;
    window.removeEventListener('beforeunload', beforeUnloadHandler);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  return { start, resume, select, goto, next, prev, toggleFlag, exitConfirm, submitConfirm, submit };
})();
