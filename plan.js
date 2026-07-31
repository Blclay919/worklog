(function () {
  'use strict';

  const StudyLog = window.StudyLog = window.StudyLog || {};

  const MAX_PLAN_FILE_SIZE = 4 * 1024 * 1024;
  const MAX_IMAGE_EDGE = 1600;
  const JPEG_QUALITY = 0.82;

  let pendingPlan = null;
  let previewObjectUrl = null;

  function initPlanPage() {
    const currentEl = document.getElementById('plan-current');
    if (!currentEl) return;
    bindEvents();
    renderCurrent();
  }

  function bindEvents() {
    const pickBtn = document.getElementById('pick-plan-file');
    const fileInput = document.getElementById('plan-file');
    const saveBtn = document.getElementById('save-plan');
    const currentEl = document.getElementById('plan-current');
    const dropZone = document.getElementById('plan-drop-zone');

    if (pickBtn && fileInput) {
      pickBtn.addEventListener('click', function () {
        fileInput.value = '';
        fileInput.click();
      });
      fileInput.addEventListener('change', function () {
        const file = fileInput.files && fileInput.files[0];
        if (file) {
          processFile(file);
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', savePlan);
    }

    if (dropZone) {
      dropZone.addEventListener('dragenter', function (e) {
        e.preventDefault();
        dropZone.classList.add('drop-active');
      });
      dropZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        dropZone.classList.add('drop-active');
      });
      dropZone.addEventListener('dragleave', function () {
        dropZone.classList.remove('drop-active');
      });
      dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropZone.classList.remove('drop-active');
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) {
          processFile(file);
        }
      });
    }

    if (currentEl) {
      currentEl.addEventListener('click', function (e) {
        if (e.target.closest('#remove-plan')) {
          removePlan();
        }
      });
    }
  }

  function processFile(file) {
    const type = normalizeType(file);
    if (!type) {
      showMessage('error', '仅支持 PDF、JPG、PNG 文件');
      return;
    }
    if (file.size > MAX_PLAN_FILE_SIZE) {
      showMessage('error', '文件过大：PDF 建议小于 4MB，图片会自动压缩');
      return;
    }

    setProcessingState(true);

    const readTask = type === 'pdf'
      ? readFileAsDataURL(file)
      : readFileAsDataURL(file).then(function (dataUrl) {
        return compressImage(dataUrl, file.type);
      });

    readTask.then(function (dataUrl) {
      pendingPlan = {
        name: baseName(file.name),
        type: type,
        file: dataUrl
      };
      const nameInput = document.getElementById('plan-name-input');
      if (nameInput) {
        nameInput.value = pendingPlan.name;
      }
      renderPreview();
      showMessage('success', '已选择文件，确认名称后点击“保存计划”。');
    }).catch(function (e) {
      showMessage('error', '文件处理失败：' + e.message);
    }).finally(function () {
      setProcessingState(false);
    });
  }

  function setProcessingState(processing) {
    const pickBtn = document.getElementById('pick-plan-file');
    if (!pickBtn) return;
    pickBtn.disabled = processing;
    pickBtn.textContent = processing ? '处理中...' : '选择 PDF / 图片';
  }

  function normalizeType(file) {
    if (/^application\/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)) {
      return 'pdf';
    }
    if (/^image\/(jpeg|png)$/i.test(file.type)) {
      return 'image';
    }
    return null;
  }

  StudyLog.plan = {
    normalizeType: normalizeType
  };

  function baseName(filename) {
    return String(filename).replace(/\.[^.]+$/, '') || '学习计划';
  }

  function readFileAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result));
      };
      reader.onerror = function () {
        reject(new Error('读取文件失败'));
      };
      reader.readAsDataURL(file);
    });
  }

  function compressImage(dataUrl, mimeType) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () {
        try {
          const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const isPng = /^image\/png$/i.test(mimeType);
          resolve(canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', isPng ? undefined : JPEG_QUALITY));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = function () {
        reject(new Error('无法解析图片'));
      };
      img.src = dataUrl;
    });
  }

  function renderPreview() {
    const el = document.getElementById('plan-preview');
    if (!el) return;
    revokePreviewUrl();
    if (!pendingPlan) {
      el.innerHTML = '';
      return;
    }

    if (pendingPlan.type === 'image') {
      el.innerHTML = '<img class="plan-image-preview" src="' + pendingPlan.file + '" alt="计划图片预览">';
      return;
    }

    const objectUrl = objectUrlFromDataUrl(pendingPlan.file);
    if (objectUrl) {
      previewObjectUrl = objectUrl;
      el.innerHTML = '<iframe class="plan-pdf-preview" src="' + objectUrl + '" title="PDF 计划预览"></iframe>';
    } else {
      el.innerHTML = '<div class="empty">PDF 预览不可用，保存后仍可查看。</div>';
    }
  }

  function savePlan() {
    if (!pendingPlan) {
      showMessage('error', '请先选择一个 PDF 或图片文件');
      return;
    }

    const nameInput = document.getElementById('plan-name-input');
    const name = (nameInput && nameInput.value.trim()) || pendingPlan.name;
    const plan = {
      name: name,
      type: pendingPlan.type,
      file: pendingPlan.file,
      updatedAt: new Date().toISOString()
    };

    try {
      StudyLog.storage.savePlan(plan);
      pendingPlan = null;
      revokePreviewUrl();
      if (nameInput) {
        nameInput.value = '';
      }
      const previewEl = document.getElementById('plan-preview');
      if (previewEl) {
        previewEl.innerHTML = '';
      }
      const statusEl = document.getElementById('plan-status');
      if (statusEl) {
        statusEl.textContent = '';
      }
      renderCurrent();
      showMessage('success', '学习计划已保存。');
      StudyLog.utils.toast('学习计划已保存', 'success');
    } catch (e) {
      showMessage('error', '保存失败：' + e.message);
    }
  }

  function renderCurrent() {
    const el = document.getElementById('plan-current');
    if (!el) return;
    revokePreviewUrl();

    const plan = StudyLog.storage.getPlan();
    if (!plan || !plan.file) {
      el.innerHTML = '<div class="empty plan-empty">还没有学习计划</div>';
      return;
    }

    const typeLabel = plan.type === 'pdf' ? 'PDF' : '图片';
    const updatedAt = plan.updatedAt
      ? '更新于 ' + new Date(plan.updatedAt).toLocaleString('zh-CN', { hour12: false })
      : '';
    const preview = plan.type === 'pdf'
      ? renderPdfPreview(plan.file)
      : '<img class="plan-image-preview" src="' + plan.file + '" alt="当前学习计划">';

    el.innerHTML =
      '<div class="plan-current-name">' + StudyLog.utils.escapeHtml(plan.name) + '</div>' +
      '<div class="plan-current-meta">' + typeLabel + ' · ' + updatedAt + '</div>' +
      (preview ? '<div class="plan-current-preview">' + preview + '</div>' : '') +
      '<div class="plan-current-actions">' +
      '<button class="btn secondary" type="button" onclick="document.getElementById(\'pick-plan-file\').click()">替换计划</button>' +
      '<button class="btn danger" id="remove-plan" type="button">移除计划</button>' +
      '</div>';
  }

  function renderPdfPreview(dataUrl) {
    const objectUrl = objectUrlFromDataUrl(dataUrl);
    if (objectUrl) {
      previewObjectUrl = objectUrl;
      return '<iframe class="plan-pdf-preview" src="' + objectUrl + '" title="PDF 计划"></iframe>';
    }
    return '';
  }

  function removePlan() {
    if (!window.confirm('确定移除当前学习计划吗？')) {
      return;
    }
    StudyLog.storage.remove(StudyLog.storage.keys.plan);
    renderCurrent();
    showMessage('success', '已移除学习计划。');
    StudyLog.utils.toast('已移除学习计划', 'success');
  }

  function objectUrlFromDataUrl(dataUrl) {
    try {
      const meta = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
      if (!meta) return null;
      const binary = window.atob(meta[2]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: meta[1] });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error('PDF 预览创建失败', e);
      return null;
    }
  }

  function revokePreviewUrl() {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
  }

  function showMessage(type, text) {
    const el = document.getElementById('plan-message');
    if (!el) return;
    el.className = 'message show ' + type;
    el.textContent = text;
  }

  document.addEventListener('DOMContentLoaded', function () {
    initPlanPage();
  });
})();
