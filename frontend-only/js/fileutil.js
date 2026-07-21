/* ============================================================
   文件处理工具（纯前端版）
   - 上传文件用 base64 持久化存储在 localStorage
   - 预览：PDF 用 iframe，视频/图片用 HTML5
   - 下载：base64 转 Blob 还原原始文件名
   ============================================================ */

const FileUtil = (() => {
  const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB（localStorage 上限）

  function readAsBase64(file) {
    return new Promise((resolve, reject) => {
      if (file.size > MAX_FILE_SIZE) {
        reject(new Error(`文件过大（${formatSize(file.size)}），最大支持 ${formatSize(MAX_FILE_SIZE)}`));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ base64: reader.result, mime: file.type, name: file.name, size: file.size });
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  // 判断资料是否可下载
  function canDownload(m) {
    return !!((m.fileData || m.filePath || m.file_path) || m.url || m.content);
  }

  // 下载资料
  function download(m) {
    // 服务器文件 → 走 API
    if (m.filePath || m.file_path) {
      const token = localStorage.getItem('etms_token') || '';
      const a = document.createElement('a');
      a.href = `/api/materials/${m.id}/download?token=${token}`;
      a.download = m.fileName || m.file_name || m.title;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    }
    // base64 文件 → 转 Blob 下载
    if (m.fileData) {
      const blob = dataURLtoBlob(m.fileData);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = m.fileName || m.file_name || m.title;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      return true;
    }
    // 远程 URL
    if (m.url) {
      const a = document.createElement('a');
      a.href = m.url; a.download = m.fileName || m.title; a.target = '_blank';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      return true;
    }
    // 纯文本 → 导出 txt
    if (m.content) {
      const blob = new Blob([m.content], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (m.title || '文档') + '.txt';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      return true;
    }
    return false;
  }

  function dataURLtoBlob(dataURL) {
    const parts = dataURL.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const b64 = atob(parts[1]);
    const arr = new Uint8Array(b64.length);
    for (let i = 0; i < b64.length; i++) arr[i] = b64.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  // 生成预览 HTML
  const typeIcon = { doc: '📄', pdf: '📕', video: '🎬', img: '🖼️', file: '📎' };

  function getPreviewUrl(m) {
    if (m.fileData) return m.fileData;
    if (m.filePath || m.file_path) {
      const token = localStorage.getItem('etms_token') || '';
      return `/api/materials/${m.id}/download?token=${token}`;
    }
    if (m.url) return m.url;
    return null;
  }

  function previewHtml(m) {
    const url = getPreviewUrl(m);

    if (m.type === 'pdf' && url) {
      return `<iframe src="${url}" style="width:100%;height:70vh;border:1px solid var(--border);border-radius:8px" allowfullscreen></iframe>`;
    }
    if (m.type === 'video' && url) {
      return `<video src="${url}" controls style="width:100%;max-height:480px;border-radius:8px;background:#000"></video>`;
    }
    if (m.type === 'img' && url) {
      return `<img src="${url}" style="max-width:100%;max-height:480px;border-radius:8px;display:block;margin:0 auto" />`;
    }
    if (m.content) {
      return `<div style="background:var(--surface-2);padding:24px;border-radius:8px;white-space:pre-wrap;font-size:15px;line-height:1.9;max-height:60vh;overflow-y:auto">${escapeHtml(m.content)}</div>`;
    }
    return `<div class="file-preview" style="text-align:center;padding:30px">
      <div class="file-icon" style="font-size:64px">${typeIcon[m.type] || '📎'}</div>
      <p style="margin:12px 0 4px;font-weight:600">${escapeHtml(m.fileName || m.file_name || m.title)}</p>
      <p style="color:var(--text-muted);margin:4px 0">${m.fileSize || m.file_size ? formatSize(m.fileSize || m.file_size) : '-'}</p>
      <p style="color:var(--text-muted);margin-top:12px;font-size:13px">该文件类型暂不支持在线预览，请下载后查看</p>
    </div>`;
  }

  return { MAX_FILE_SIZE, readAsBase64, canDownload, download, previewHtml, getPreviewUrl };
})();
