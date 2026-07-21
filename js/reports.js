/* ============================================================
   成绩管理与分析模块
   - 管理员成绩总览
   - 单条记录详情查看（含每题批改）
   - Excel 导出（xlsx）
   - PDF 导出（jsPDF）
   - 统计分析（平均分、及格率、错题分布）
   ============================================================ */

const Reports = (() => {

  let recordFilter = { examId: '', keyword: '', status: '' };

  // ---------- 管理员成绩总览 ----------
  function records() {
    let list = DB.getRecords().sort((a, b) => b.submittedAt - a.submittedAt);
    if (recordFilter.examId) list = list.filter(r => r.examId === recordFilter.examId);
    if (recordFilter.status === 'pass') list = list.filter(r => r.passed);
    if (recordFilter.status === 'fail') list = list.filter(r => !r.passed);
    if (recordFilter.keyword) {
      const kw = recordFilter.keyword.toLowerCase();
      list = list.filter(r => r.userName.toLowerCase().includes(kw) || r.examTitle.toLowerCase().includes(kw));
    }
    const exams = DB.getExams();
    const total = list.length;
    const passed = list.filter(r => r.passed).length;
    const avgPct = total ? Math.round(list.reduce((s, r) => s + (r.score / r.totalScore * 100), 0) / total) : 0;

    return `
      <div class="page-header">
        <div>
          <h2>成绩管理</h2>
          <div class="subtitle">查看所有考核记录、导出报告、统计分析</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" onclick="Reports.exportRecords(DB.getRecords(),'全部成绩报告')">⬇️ 导出全部 Excel</button>
          <button class="btn btn-primary" onclick="Reports.showAnalytics()">📊 统计分析</button>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon blue">📊</div><div><div class="stat-value">${total}</div><div class="stat-label">考试记录</div></div></div>
        <div class="stat-card"><div class="stat-icon green">✅</div><div><div class="stat-value">${passed}</div><div class="stat-label">及格人次</div></div></div>
        <div class="stat-card"><div class="stat-icon ${avgPct >= 60 ? 'green' : 'red'}">📈</div><div><div class="stat-value">${avgPct}%</div><div class="stat-label">平均得分率</div></div></div>
        <div class="stat-card"><div class="stat-icon ${total ? (passed / total * 100 >= 60 ? 'green' : 'orange') : 'gray'}">🎯</div><div><div class="stat-value">${total ? Math.round(passed / total * 100) : 0}%</div><div class="stat-label">及格率</div></div></div>
      </div>
      <div class="toolbar">
        <select class="form-select" style="width:auto" onchange="Reports.setFilter('examId', this.value)">
          <option value="">全部考试</option>
          ${exams.map(e => `<option value="${e.id}" ${recordFilter.examId === e.id ? 'selected' : ''}>${escapeHtml(e.title)}</option>`).join('')}
        </select>
        <select class="form-select" style="width:auto" onchange="Reports.setFilter('status', this.value)">
          <option value="">全部状态</option>
          <option value="pass" ${recordFilter.status === 'pass' ? 'selected' : ''}>及格</option>
          <option value="fail" ${recordFilter.status === 'fail' ? 'selected' : ''}>不及格</option>
        </select>
        <div class="search-box" style="flex:1;max-width:280px">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="搜索姓名或考试..." value="${recordFilter.keyword}" oninput="Reports.setFilter('keyword', this.value)" />
        </div>
      </div>
      ${total === 0 ? emptyState('📊', '暂无考试记录') : `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>员工</th><th>部门</th><th>考试</th><th>得分</th><th>得分率</th><th>结果</th><th>用时</th><th>提交时间</th><th>操作</th></tr></thead>
          <tbody>
            ${list.map(r => {
              const pct = Math.round(r.score / r.totalScore * 100);
              const mins = Math.round(r.duration / 60);
              return `<tr>
                <td><strong>${escapeHtml(r.userName)}</strong></td>
                <td>${escapeHtml(r.dept || '-')}</td>
                <td>${escapeHtml(r.examTitle)}</td>
                <td><strong>${r.score}</strong>/${r.totalScore}</td>
                <td>${pct}%</td>
                <td><span class="badge ${r.passed ? 'badge-success' : 'badge-danger'}">${r.passed ? '通过' : '未通过'}</span></td>
                <td>${mins} 分</td>
                <td>${formatDateTime(r.submittedAt)}</td>
                <td><div class="actions">
                  <button class="btn btn-sm btn-secondary" onclick="Reports.viewRecord('${r.id}')">📋 详情</button>
                  <button class="btn btn-sm btn-secondary" onclick="Reports.exportSingleRecord('${r.id}')">⬇️ 导出</button>
                  <button class="btn btn-sm btn-danger" onclick="Reports.delRecord('${r.id}')">🗑️</button>
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`}
    `;
  }

  function setFilter(key, val) {
    recordFilter[key] = val;
    App.render();
  }

  function delRecord(id) {
    confirmDialog('确定删除该考试记录吗？此操作不可撤销。', () => {
      DB.deleteRecord(id);
      toast('记录已删除', 'success');
      App.render();
    });
  }

  // ---------- 单条记录详情（含每题批改） ----------
  function viewRecord(recordId) {
    const r = DB.getRecordById(recordId);
    if (!r) { toast('记录不存在', 'error'); return; }
    const typeLabels = { single: '单选题', multiple: '多选题', judge: '判断题' };
    const pct = Math.round(r.score / r.totalScore * 100);
    const details = r.details || [];

    openModal({
      title: '答题详情',
      size: 'xl',
      body: `
        <div class="result-hero ${r.passed ? 'pass' : 'fail'}" style="margin-bottom:16px;padding:20px">
          <div class="score-circle" style="width:90px;height:90px;font-size:28px;border-width:4px">${r.score}<div style="font-size:12px;font-weight:400;opacity:.7">/${r.totalScore}</div></div>
          <div class="result-status" style="font-size:18px">${r.passed ? '🎉 通过' : '😕 未通过'}</div>
          <div class="result-meta" style="font-size:13px">
            ${escapeHtml(r.userName)} · ${escapeHtml(r.examTitle)} · 得分率 ${pct}% ·
            答对 ${r.correctCount || 0}/${r.questionCount || details.length} 题 ·
            用时 ${Math.round(r.duration / 60)} 分钟 · 第 ${r.attempt} 次
          </div>
        </div>
        ${details.length === 0 ? '<div class="empty-state">该记录无详细答题数据</div>' : details.map((d, i) => `
          <div class="question-card" style="margin-bottom:12px;border-left:4px solid ${d.isCorrect ? 'var(--success)' : 'var(--danger)'}">
            <div class="question-num">
              <span class="q-num">第 ${i + 1} 题</span>
              <span class="badge badge-info q-type-badge">${typeLabels[d.type] || ''}</span>
              <span class="q-score">${d.earned}/${d.score} 分</span>
              <span class="badge ${d.isCorrect ? 'badge-success' : 'badge-danger'}">${d.isCorrect ? '✓ 答对' : '✗ 答错'}</span>
            </div>
            <div class="question-text">${escapeHtml(d.stem)}</div>
            <div class="options-list">
              ${d.options.map((opt, oi) => {
                const isUserAns = d.userAnswer.includes(oi);
                const isCorrectAns = d.correctAnswer.includes(oi);
                let cls = '', mark = '';
                if (isCorrectAns) { cls = 'background:var(--success-light);border-color:var(--success)'; mark = '✓ 正确答案'; }
                if (isUserAns && !isCorrectAns) { cls = 'background:var(--danger-light);border-color:var(--danger)'; mark = '✗ 你的选择'; }
                if (isUserAns && isCorrectAns) { mark = '✓ 你的选择（正确）'; }
                return `<div class="option-item" style="${cls};cursor:default;${isUserAns || isCorrectAns ? '' : 'opacity:.6'}">
                  <div class="option-marker">${String.fromCharCode(65 + oi)}</div>
                  <div class="option-text">${escapeHtml(opt)}${mark ? ` <span style="font-size:12px;color:var(--text-muted);margin-left:8px">${mark}</span>` : ''}</div>
                </div>`;
              }).join('')}
            </div>
            ${!d.isCorrect ? `<div style="margin-top:10px;padding:10px;background:var(--surface-2);border-radius:6px;font-size:13px">
              <strong>你的答案：</strong>${d.userAnswer.length ? d.userAnswer.map(a => String.fromCharCode(65 + a)).join('、') : '未作答'} ｜ 
              <strong>正确答案：</strong>${d.correctAnswer.map(a => String.fromCharCode(65 + a)).join('、')}
            </div>` : ''}
            ${d.analysis ? `<div style="margin-top:8px;padding:10px;background:var(--primary-50);border-radius:6px;font-size:13px;color:var(--primary-dark)"><strong>💡 解析：</strong>${escapeHtml(d.analysis)}</div>` : ''}
          </div>
        `).join('')}
      `,
      okText: '⬇️ 导出成绩单',
      cancelText: '关闭',
      onOk: () => {
        exportSingleRecord(recordId);
        return false; // 不关闭弹窗
      }
    });
  }

  // ---------- 统计分析 ----------
  function showAnalytics() {
    const records = DB.getRecords();
    if (!records.length) { toast('暂无数据可分析', 'error'); return; }
    openModal({
      title: '📊 成绩统计分析',
      size: 'xl',
      body: `<div id="analytics_body">加载中...</div>`,
      okText: '关闭',
      cancelHidden: true,
      onOk: () => true,
      onShown: () => renderAnalytics(records),
    });
  }

  function renderAnalytics(records) {
    const total = records.length;
    const passed = records.filter(r => r.passed).length;
    const avgPct = Math.round(records.reduce((s, r) => s + (r.score / r.totalScore * 100), 0) / total);
    const passRate = Math.round(passed / total * 100);
    const scores = records.map(r => Math.round(r.score / r.totalScore * 100));

    // 按考试统计
    const byExam = {};
    records.forEach(r => {
      if (!byExam[r.examId]) byExam[r.examId] = { title: r.examTitle, records: [] };
      byExam[r.examId].records.push(r);
    });
    const examStats = Object.values(byExam).map(g => {
      const pcts = g.records.map(r => r.score / r.totalScore * 100);
      return {
        title: g.title,
        count: g.records.length,
        avg: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length),
        passRate: Math.round(g.records.filter(r => r.passed).length / g.records.length * 100),
        max: Math.round(Math.max(...pcts)),
        min: Math.round(Math.min(...pcts)),
      };
    });

    // 错题分布
    const wrongCount = {};
    records.forEach(r => {
      (r.details || []).forEach(d => {
        if (!d.isCorrect) {
          const key = d.stem.slice(0, 30);
          wrongCount[key] = (wrongCount[key] || 0) + 1;
        }
      });
    });
    const topWrong = Object.entries(wrongCount).sort((a, b) => b[1] - a[1]).slice(0, 8);

    document.getElementById('analytics_body').innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon blue">📊</div><div><div class="stat-value">${total}</div><div class="stat-label">总考试人次</div></div></div>
        <div class="stat-card"><div class="stat-icon green">✅</div><div><div class="stat-value">${passed}</div><div class="stat-label">及格人次</div></div></div>
        <div class="stat-card"><div class="stat-icon ${avgPct >= 60 ? 'green' : 'red'}">📈</div><div><div class="stat-value">${avgPct}%</div><div class="stat-label">平均得分率</div></div></div>
        <div class="stat-card"><div class="stat-icon ${passRate >= 60 ? 'green' : 'orange'}">🎯</div><div><div class="stat-value">${passRate}%</div><div class="stat-label">及格率</div></div></div>
      </div>
      <div class="chart-grid">
        <div class="chart-card">
          <h4>分数段分布</h4>
          <div class="chart-wrapper"><canvas id="distChart"></canvas></div>
        </div>
        <div class="chart-card">
          <h4>各考试平均分对比</h4>
          <div class="chart-wrapper"><canvas id="examChart"></canvas></div>
        </div>
        <div class="chart-card">
          <h4>各考试及格率</h4>
          <div class="chart-wrapper"><canvas id="passChart"></canvas></div>
        </div>
        <div class="chart-card">
          <h4>高频错题 TOP8</h4>
          <div class="chart-wrapper"><canvas id="wrongChart"></canvas></div>
        </div>
      </div>
      <div class="card" style="padding:20px;margin-top:16px">
        <h4 style="margin-bottom:12px">各考试详细统计</h4>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>考试</th><th>人次</th><th>平均分</th><th>及格率</th><th>最高分</th><th>最低分</th></tr></thead>
            <tbody>
              ${examStats.map(s => `<tr>
                <td>${escapeHtml(s.title)}</td>
                <td>${s.count}</td>
                <td>${s.avg}%</td>
                <td><span class="badge ${s.passRate >= 60 ? 'badge-success' : 'badge-warning'}">${s.passRate}%</span></td>
                <td>${s.max}%</td>
                <td>${s.min}%</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // 分数段分布
    const ranges = ['0-59', '60-69', '70-79', '80-89', '90-100'];
    const distData = ranges.map((_, i) => {
      const lo = i * 10 + (i === 0 ? 0 : 10) - (i === 0 ? 0 : 0);
      const hi = i === 0 ? 59 : (i + 1) * 10 - 1;
      const lo2 = i === 0 ? 0 : i * 10;
      const hi2 = i === 4 ? 100 : (i + 1) * 10 - 1;
      return scores.filter(s => s >= lo2 && s <= hi2).length;
    });
    new Chart(document.getElementById('distChart'), {
      type: 'bar',
      data: { labels: ranges, datasets: [{ label: '人数', data: distData, backgroundColor: ['#dc2626', '#d97706', '#eab308', '#16a34a', '#2563eb'] }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
    // 各考试平均分
    new Chart(document.getElementById('examChart'), {
      type: 'bar',
      data: { labels: examStats.map(s => s.title.slice(0, 8)), datasets: [{ label: '平均得分率%', data: examStats.map(s => s.avg), backgroundColor: '#2563eb' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }
    });
    // 及格率
    new Chart(document.getElementById('passChart'), {
      type: 'bar',
      data: { labels: examStats.map(s => s.title.slice(0, 8)), datasets: [{ label: '及格率%', data: examStats.map(s => s.passRate), backgroundColor: '#16a34a' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }
    });
    // 错题
    new Chart(document.getElementById('wrongChart'), {
      type: 'bar',
      data: { labels: topWrong.map(([k]) => k.slice(0, 10) + '...'), datasets: [{ label: '答错次数', data: topWrong.map(([_, v]) => v), backgroundColor: '#dc2626' }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }

  // ---------- Excel 导出 ----------
  function exportRecords(records, fileName) {
    if (!records || !records.length) { toast('无数据可导出', 'error'); return; }
    const data = records.map(r => {
      const pct = Math.round(r.score / r.totalScore * 100);
      return {
        '员工姓名': r.userName,
        '部门': r.dept || '',
        '考试名称': r.examTitle,
        '得分': r.score,
        '总分': r.totalScore,
        '得分率(%)': pct,
        '及格线(%)': r.passScore,
        '是否及格': r.passed ? '是' : '否',
        '答对题数': r.correctCount || '',
        '总题数': r.questionCount || '',
        '考试用时(分钟)': Math.round(r.duration / 60),
        '考试次数': r.attempt,
        '开始时间': formatDateTime(r.startedAt),
        '提交时间': formatDateTime(r.submittedAt),
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    // 列宽
    ws['!cols'] = Object.keys(data[0]).map(k => ({ wch: Math.max(k.length * 2, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '成绩报告');
    XLSX.writeFile(wb, `${fileName}_${formatDate(Date.now()).replace(/\//g, '')}.xlsx`);
    toast(`已导出 ${records.length} 条记录到 Excel`, 'success');
  }

  function exportSingleRecord(recordId) {
    const r = DB.getRecordById(recordId);
    if (!r) return;
    // Excel：基本信息 + 每题详情
    const info = [{
      '项目': '员工姓名', '内容': r.userName
    }, { '项目': '部门', '内容': r.dept || '' }, { '项目': '考试名称', '内容': r.examTitle },
      { '项目': '得分', '内容': `${r.score} / ${r.totalScore}` }, { '项目': '得分率', '内容': `${Math.round(r.score / r.totalScore * 100)}%` },
      { '项目': '及格线', '内容': `${r.passScore}%` }, { '项目': '考试结果', '内容': r.passed ? '通过' : '未通过' },
      { '项目': '答对题数', '内容': `${r.correctCount || 0} / ${r.questionCount || 0}` },
      { '项目': '考试用时', '内容': `${Math.round(r.duration / 60)} 分钟` }, { '项目': '考试次数', '内容': `第 ${r.attempt} 次` },
      { '项目': '提交时间', '内容': formatDateTime(r.submittedAt) },
    ];
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(info);
    ws1['!cols'] = [{ wch: 16 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws1, '成绩信息');

    if (r.details && r.details.length) {
      const typeLabels = { single: '单选题', multiple: '多选题', judge: '判断题' };
      const detailData = r.details.map((d, i) => ({
        '题号': i + 1,
        '题型': typeLabels[d.type] || '',
        '题目': d.stem,
        '你的答案': d.userAnswer.length ? d.userAnswer.map(a => String.fromCharCode(65 + a)).join(',') : '未作答',
        '正确答案': d.correctAnswer.map(a => String.fromCharCode(65 + a)).join(','),
        '是否正确': d.isCorrect ? '正确' : '错误',
        '得分': `${d.earned} / ${d.score}`,
        '解析': d.analysis || '',
      }));
      const ws2 = XLSX.utils.json_to_sheet(detailData);
      ws2['!cols'] = [{ wch: 6 }, { wch: 10 }, { wch: 50 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, ws2, '答题详情');
    }
    XLSX.writeFile(wb, `成绩单_${r.userName}_${r.examTitle}.xlsx`);
    toast('成绩单已导出', 'success');
  }

  // ---------- PDF 导出 ----------
  function exportSinglePDF(recordId) {
    const r = DB.getRecordById(recordId);
    if (!r) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pct = Math.round(r.score / r.totalScore * 100);

    // 标题
    doc.setFontSize(18);
    doc.text('Employee Assessment Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`${formatDateTime(r.submittedAt)}`, 14, 27);

    // 基本信息表
    doc.autoTable({
      startY: 32,
      head: [['Field', 'Content']],
      body: [
        ['Employee Name', r.userName],
        ['Department', r.dept || '-'],
        ['Exam Title', r.examTitle],
        ['Score', `${r.score} / ${r.totalScore}  (${pct}%)`],
        ['Pass Threshold', `${r.passScore}%`],
        ['Result', r.passed ? 'PASSED' : 'FAILED'],
        ['Correct Answers', `${r.correctCount || 0} / ${r.questionCount || 0}`],
        ['Duration', `${Math.round(r.duration / 60)} minutes`],
        ['Attempt', `#${r.attempt}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
    });

    // 答题详情
    if (r.details && r.details.length) {
      const typeLabels = { single: 'Single', multiple: 'Multiple', judge: 'Judge' };
      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 10,
        head: [['#', 'Type', 'Question', 'Your Answer', 'Correct', 'Result', 'Score']],
        body: r.details.map((d, i) => [
          i + 1,
          typeLabels[d.type] || '',
          d.stem.length > 40 ? d.stem.slice(0, 40) + '...' : d.stem,
          d.userAnswer.length ? d.userAnswer.map(a => String.fromCharCode(65 + a)).join(',') : '-',
          d.correctAnswer.map(a => String.fromCharCode(65 + a)).join(','),
          d.isCorrect ? 'Correct' : 'Wrong',
          `${d.earned}/${d.score}`,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] },
        styles: { fontSize: 8 },
      });
    }
    doc.save(`Report_${r.userName}_${r.examTitle}.pdf`);
    toast('PDF 成绩单已导出', 'success');
  }

  return {
    records, setFilter, delRecord, viewRecord,
    showAnalytics,
    exportRecords, exportSingleRecord, exportSinglePDF,
  };
})();
