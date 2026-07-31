(function () {
  'use strict';

  const StudyLog = window.StudyLog = window.StudyLog || {};

  const MAX_IMAGE_EDGE = 1600;
  const JPEG_QUALITY = 0.82;
  const MAX_SOURCE_IMAGE_SIZE = 15 * 1024 * 1024;
  const HISTORY_PAGE_SIZE = 10;

  let currentSubject = 'math';
  let pendingImages = [];
  let historyLimit = HISTORY_PAGE_SIZE;

  function initSubjectPage() {
    const tabsEl = document.getElementById('subject-tabs');
    if (!tabsEl) return;

    currentSubject = new URLSearchParams(window.location.search).get('subject') || 'math';
    if (!StudyLog.subjects.getById(currentSubject)) {
      currentSubject = 'math';
    }
    historyLimit = HISTORY_PAGE_SIZE;

    renderTabs(tabsEl);
    bindEvents();
    loadToday();
    renderHistory();
  }

  function renderTabs(tabsEl) {
    tabsEl.innerHTML = StudyLog.subjects.list.map(function (subject) {
      return '<a class="subject-tab' + (subject.id === currentSubject ? ' active' : '') +
        '" href="subject.html?subject=' + subject.id + '">' + subject.name + '</a>';
    }).join('');
  }

  function bindEvents() {
    const pickBtn = document.getElementById('pick-images');
    const fileInput = document.getElementById('image-file');
    const cameraBtn = document.getElementById('pick-camera');
    const cameraInput = document.getElementById('camera-file');
    const saveBtn = document.getElementById('save-record');
    const previews = document.getElementById('image-previews');
    const historyEl = document.getElementById('history-list');
    const lightbox = document.getElementById('lightbox');

    if (pickBtn && fileInput) {
      pickBtn.addEventListener('click', function () {
        fileInput.value = '';
        fileInput.click();
      });
      fileInput.addEventListener('change', function () {
        processFiles(fileInput.files);
      });
    }

    if (cameraBtn && cameraInput) {
      cameraBtn.addEventListener('click', function () {
        cameraInput.value = '';
        cameraInput.click();
      });
      cameraInput.addEventListener('change', function () {
        processFiles(cameraInput.files);
      });
    }

    const dropZone = document.getElementById('subject-drop-zone');
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
        const files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length) {
          processFiles(files);
        }
      });
    }

    document.addEventListener('paste', function (e) {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      const files = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image/') === 0) {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length) {
        e.preventDefault();
        processFiles(files);
      }
    });

    if (saveBtn) {
      saveBtn.addEventListener('click', saveRecord);
    }

    if (previews) {
      previews.addEventListener('click', function (e) {
        const removeBtn = e.target.closest('.preview-remove');
        if (removeBtn) {
          const index = Number(removeBtn.getAttribute('data-remove'));
          if (index >= 0 && index < pendingImages.length) {
            pendingImages.splice(index, 1);
            renderPreviews();
          }
          return;
        }
        const img = e.target.closest('img[data-view]');
        if (img) {
          openLightbox(img.src);
        }
      });
    }

    if (historyEl) {
      historyEl.addEventListener('click', function (e) {
        if (e.target.closest('#load-more-history')) {
          historyLimit += HISTORY_PAGE_SIZE;
          renderHistory();
          return;
        }
        const img = e.target.closest('.history-thumb');
        if (img) {
          openLightbox(img.src);
        }
      });
    }

    if (lightbox) {
      lightbox.addEventListener('click', closeLightbox);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          closeLightbox();
        }
      });
    }
  }

  function loadToday() {
    const titleEl = document.getElementById('today-title');
    const dateEl = document.getElementById('today-date');
    const homeworkEl = document.getElementById('homework-input');
    const statusEl = document.getElementById('save-status');
    if (!titleEl || !dateEl || !homeworkEl) return;

    const today = StudyLog.utils.todayKey();
    titleEl.textContent = StudyLog.subjects.getName(currentSubject) + ' · 今日记录';
    dateEl.textContent = '今天是 ' + StudyLog.utils.formatDateCN(today) +
      ' ' + StudyLog.utils.weekdayCN(new Date());

    const todayRecord = StudyLog.storage.getRecordsByDate(today).find(function (r) {
      return r.subject === currentSubject;
    });

    homeworkEl.value = todayRecord ? (todayRecord.homework || '') : '';
    pendingImages = todayRecord && Array.isArray(todayRecord.images)
      ? todayRecord.images.map(function (src) {
        return { id: StudyLog.utils.uid(), src: src };
      })
      : [];

    if (statusEl) {
      statusEl.textContent = todayRecord
        ? '上次保存：' + (todayRecord.uploadTime || '') +
          (todayRecord.images && todayRecord.images.length ? ' · 已上传' : ' · 未上传图片')
        : '';
    }
    renderPreviews();
  }

  function processFiles(fileList) {
    const files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;

    const oversized = files.filter(function (file) {
      return file.size > MAX_SOURCE_IMAGE_SIZE;
    });
    if (oversized.length) {
      showMessage('error', '图片过大，请选择 15MB 以内的图片');
      return;
    }

    const imageFiles = files.filter(function (file) {
      return StudyLog.upload.isSupportedImage(file.type);
    });
    if (imageFiles.length !== files.length) {
      showMessage('error', '仅支持 JPG / PNG 图片，其他文件已忽略');
    }
    if (!imageFiles.length) return;

    setProcessingState(true);

    Promise.all(imageFiles.map(function (file) {
      return readFileAsDataURL(file).then(function (dataUrl) {
        return compressImage(dataUrl, file.type);
      });
    })).then(function (dataUrls) {
      dataUrls.forEach(function (dataUrl) {
        pendingImages.push({ id: StudyLog.utils.uid(), src: dataUrl });
      });
      renderPreviews();
      showMessage('success', '已添加 ' + dataUrls.length + ' 张图片，记得点击“保存记录”。');
    }).catch(function (e) {
      showMessage('error', '图片处理失败：' + e.message);
    }).finally(function () {
      setProcessingState(false);
    });
  }

  function setProcessingState(processing) {
    const pickBtn = document.getElementById('pick-images');
    if (!pickBtn) return;
    pickBtn.disabled = processing;
    pickBtn.textContent = processing ? '处理中...' : '相册 / 文件';
    const cameraBtn = document.getElementById('pick-camera');
    if (cameraBtn) {
      cameraBtn.disabled = processing;
    }
  }

  function readFileAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result));
      };
      reader.onerror = function () {
        reject(new Error('读取图片失败'));
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

  function renderPreviews() {
    const el = document.getElementById('image-previews');
    if (!el) return;
    if (!pendingImages.length) {
      el.innerHTML = '<div class="empty preview-empty">还没有图片</div>';
      return;
    }
    el.innerHTML = pendingImages.map(function (item, index) {
      return '<div class="preview-item">' +
        '<img src="' + item.src + '" alt="预览图片" data-view="' + index + '">' +
        '<button class="preview-remove" type="button" data-remove="' + index + '" aria-label="移除图片">×</button>' +
        '</div>';
    }).join('');
  }

  function saveRecord() {
    const homeworkEl = document.getElementById('homework-input');
    const homework = homeworkEl ? homeworkEl.value.trim() : '';
    const today = StudyLog.utils.todayKey();
    const existing = StudyLog.storage.getRecords().find(function (record) {
      return record.date === today && record.subject === currentSubject;
    });
    const now = new Date().toISOString();
    const record = {
      id: (existing && existing.id) || StudyLog.utils.uid(),
      date: today,
      subject: currentSubject,
      homework: homework,
      images: pendingImages.map(function (item) {
        return item.src;
      }),
      uploadTime: StudyLog.utils.timeNow(),
      createdAt: (existing && existing.createdAt) || now,
      updatedAt: now
    };

    try {
      StudyLog.storage.upsertRecord(record);
      showMessage('success', '已保存 ' + StudyLog.subjects.getName(currentSubject) +
        ' 的记录，保存时间 ' + record.uploadTime + '。');
      StudyLog.utils.toast('学习记录已保存', 'success');
      const statusEl = document.getElementById('save-status');
      if (statusEl) {
        statusEl.textContent = '上次保存：' + record.uploadTime +
          (record.images.length ? ' · 已上传' : ' · 未上传图片');
      }
      renderHistory();
    } catch (e) {
      showMessage('error', '保存失败：' + e.message);
    }
  }

  function renderHistory() {
    const el = document.getElementById('history-list');
    if (!el) return;
    const records = StudyLog.storage.getRecords().filter(function (record) {
      return record.subject === currentSubject;
    }).sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });

    if (!records.length) {
      el.innerHTML = '<div class="empty">还没有历史记录</div>';
      return;
    }

    const visibleRecords = records.slice(0, historyLimit);
    const loadMore = records.length > historyLimit
      ? '<button class="btn secondary load-more" id="load-more-history" type="button">加载更多</button>'
      : '';

    el.innerHTML = visibleRecords.map(function (record) {
      const images = Array.isArray(record.images) ? record.images : [];
      const thumbs = images.slice(0, 4).map(function (src) {
        return '<img class="history-thumb" src="' + src + '" alt="历史图片">';
      }).join('');
      const more = images.length > 4
        ? '<span class="history-more">+' + (images.length - 4) + '</span>'
        : '';
      return '<article class="history-item">' +
        '<div class="history-head"><strong>' + StudyLog.utils.formatDateCN(record.date) + '</strong>' +
        '<span class="muted">' + StudyLog.utils.escapeHtml(record.uploadTime || '') + '</span></div>' +
        '<div class="history-text">' + (record.homework ? StudyLog.utils.escapeHtml(record.homework) : '未填写作业内容') + '</div>' +
        (images.length ? '<div class="history-thumbs">' + thumbs + more + '</div>' : '') +
        '</article>';
    }).join('') + loadMore;
  }

  function openLightbox(src) {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-image');
    if (!lightbox || !img) return;
    img.src = src;
    lightbox.hidden = false;
  }

  function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-image');
    if (lightbox) {
      lightbox.hidden = true;
    }
    if (img) {
      img.src = '';
    }
  }

  function showMessage(type, text) {
    const el = document.getElementById('subject-message');
    if (!el) return;
    el.className = 'message show ' + type;
    el.textContent = text;
  }

  StudyLog.upload = {
    isSupportedImage: function (mimeType) {
      return /^image\/(jpeg|png)$/i.test(mimeType || '');
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    initSubjectPage();
  });
})();
