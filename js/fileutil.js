/* ============================================================
   文件处理工具（全栈版）
   - 上传文件走 API（multipart/form-data）
   - 预览：服务器上的文件通过 /api/materials/:id/download 访问
   - 下载：同上
   - 纯文本内容：前端直接展示
   ============================================================ */

const FileUtil = (() => {
  // 获取资料的可访问 URL
  function getMaterialUrl(m) {
    // 服务器上存储的文件 → 走下载 API（带 JWT 认证）
    if (m.filePath || m.file_path) {
      const token = localStorage.getItem('etms_token') || '';
      return { type: 'server', url: `/api/materials/${m.id}/download?token=${token}` };
    }
    // 远程视频 URL
    if (m.url) return { type: 'url', url: m.url };
    return null;
  }

  // 判断资料是否可下载
  function canDownload(m) {
    return !!(m.filePath || m.file_path || m.url || m.content);
  }

  // 下载资料
  function download(m) {
    const source = getMaterialUrl(m);
    if (source) {
      const a = document.createElement('a');
      a.href = source.url;
      a.download = m.fileName || m.file_name || m.title;
      if (source.type === 'url') a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    }
    // 仅有文本内容：导出为 txt
    if (m.content) {
      const blob = new Blob([m.content], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (m.title || '文档') + '.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      return true;
    }
    return false;
  }

  // 生成资料的在线预览 HTML
  const typeIcon = { doc: '📄', pdf: '📕', video: '🎬', img: '🖼️', file: '📎' };

  function previewHtml(m) {
    const source = getMaterialUrl(m);

    // PDF：iframe 内嵌预览
    if (m.type === 'pdf' && source) {
      return `<iframe src="${source.url}" style="width:100%;height:70vh;border:1px solid var(--border);border-radius:8px" allowfullscreen></iframe>`;
    }
    // 视频
    if (m.type === 'video' && source) {
      return `<video src="${source.url}" controls style="width:100%;max-height:480px;border-radius:8px;background:#000"></video>`;
    }
    // 图片
    if (m.type === 'img' && source) {
      return `<img src="${source.url}" style="max-width:100%;max-height:480px;border-radius:8px;display:block;margin:0 auto" />`;
    }
    // 文档类：优先展示文本内容
    if (m.content) {
      return `<div style="background:var(--surface-2);padding:24px;border-radius:8px;white-space:pre-wrap;font-size:15px;line-height:1.9;max-height:60vh;overflow-y:auto">${escapeHtml(m.content)}</div>`;
    }
    // 其他文件
    return `<div class="file-preview" style="text-align:center;padding:30px">
      <div class="file-icon" style="font-size:64px">${typeIcon[m.type] || '📎'}</div>
      <p style="margin:12px 0 4px;font-weight:600">${escapeHtml(m.fileName || m.file_name || m.title)}</p>
      <p style="color:var(--text-muted);margin:4px 0">${m.fileSize || m.file_size ? formatSize(m.fileSize || m.file_size) : '-'}</p>
      <p style="color:var(--text-muted);margin-top:12px;font-size:13px">该文件类型暂不支持在线预览，请下载后查看</p>
    </div>`;
  }

  return { getMaterialUrl, canDownload, download, previewHtml };
})();
