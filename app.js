(function () {
  'use strict';

  const StudyLog = window.StudyLog = window.StudyLog || {};

  function initFooterYear() {
    const el = document.getElementById('footer-year');
    if (el) {
      el.textContent = String(new Date().getFullYear());
    }
  }

  function initTodayLine() {
    const el = document.getElementById('today-line');
    if (!el) return;
    const today = new Date();
    el.textContent = '今天是 ' + StudyLog.utils.formatDateCN(StudyLog.utils.todayKey()) +
      ' ' + StudyLog.utils.weekdayCN(today);
  }

  function initDashboard() {
    const statusEl = document.getElementById('subject-status');
    if (!statusEl) return;

    const today = StudyLog.utils.todayKey();
    const todayRecords = StudyLog.storage.getRecordsByDate(today);

    renderPlanSummary();
    renderSubjectStatus(statusEl, todayRecords);
    renderTodayRecords(todayRecords);
  }

  function initDataUsage() {
    const el = document.getElementById('data-usage');
    if (!el) return;
    const mb = StudyLog.storage.getUsageMB();
    el.textContent = '当前数据约 ' + mb.toFixed(2) + ' MB' +
      (mb > 4 ? '，接近浏览器存储上限，建议导出备份' : '');
    if (mb > 4) {
      el.classList.add('text-warning');
    } else {
      el.classList.remove('text-warning');
    }
  }

  function renderPlanSummary() {
    const el = document.getElementById('plan-summary');
    if (!el) return;
    const plan = StudyLog.storage.getPlan();
    if (plan && plan.name) {
      const type = plan.type === 'pdf' ? 'PDF' : '图片';
      el.innerHTML =
        '<div class="plan-name">' + StudyLog.utils.escapeHtml(plan.name) + '</div>' +
        '<div class="muted">' + type + ' 计划</div>';
    } else {
      el.textContent = '暂无学习计划';
    }
  }

  function renderSubjectStatus(statusEl, todayRecords) {
    const uploadedIds = todayRecords.filter(function (record) {
      return Array.isArray(record.images) && record.images.length > 0;
    }).map(function (record) {
      return record.subject;
    });

    statusEl.innerHTML = StudyLog.subjects.list.map(function (subject) {
      const isUploaded = uploadedIds.indexOf(subject.id) !== -1;
      const record = todayRecords.find(function (r) {
        return r.subject === subject.id;
      });
      const timeText = record && record.uploadTime
        ? ' ' + StudyLog.utils.escapeHtml(record.uploadTime)
        : '';
      return '<div class="subject-item ' + (isUploaded ? 'uploaded' : 'pending') + '">' +
        '<span class="status-dot ' + (isUploaded ? 'done' : 'pending') + '"></span>' +
        '<span class="subject-name">' + subject.name + '</span>' +
        '<span class="subject-status">' + (isUploaded ? '已上传' + timeText : '未上传') + '</span>' +
        '</div>';
    }).join('');

    const total = StudyLog.subjects.list.length;
    const count = uploadedIds.length;
    const percent = total === 0 ? 0 : Math.round((count / total) * 100);
    const countEl = document.getElementById('upload-count');
    const percentEl = document.getElementById('upload-percent');
    const fillEl = document.getElementById('progress-fill');
    if (countEl) countEl.textContent = count + ' / ' + total;
    if (percentEl) percentEl.textContent = percent + '%';
    if (fillEl) fillEl.style.width = percent + '%';
  }

  function renderTodayRecords(todayRecords) {
    const el = document.getElementById('today-records');
    if (!el) return;
    if (!todayRecords.length) {
      el.innerHTML = '<div class="empty">今天还没有学习记录</div>';
      return;
    }

    el.innerHTML = todayRecords.slice().sort(function (a, b) {
      return String(a.uploadTime || '').localeCompare(String(b.uploadTime || ''));
    }).map(function (record) {
      const imageCount = Array.isArray(record.images) ? record.images.length : 0;
      const homework = record.homework || '未填写作业内容';
      return '<article class="record-row">' +
        '<div class="record-main"><strong>' +
        StudyLog.utils.escapeHtml(StudyLog.subjects.getName(record.subject)) +
        '</strong><span class="muted">' + StudyLog.utils.escapeHtml(record.uploadTime || '') +
        '</span></div>' +
        '<div class="record-meta">' + imageCount + ' 张图片 · ' +
        StudyLog.utils.escapeHtml(homework) + '</div>' +
        '</article>';
    }).join('');
  }

  function initDataManager() {
    const exportBtn = document.getElementById('export-data');
    const importBtn = document.getElementById('import-data');
    const importFile = document.getElementById('import-file');
    const overwrite = document.getElementById('import-overwrite');
    const messageEl = document.getElementById('data-message');
    if (!exportBtn || !importBtn || !importFile || !messageEl) return;

    exportBtn.addEventListener('click', function () {
      try {
        StudyLog.storage.ensureVersion();
        const json = StudyLog.storage.exportJSON();
        StudyLog.utils.downloadText(
          'studylog.json',
          json,
          'application/json'
        );
        showMessage('success', '已导出 JSON 备份文件。');
        StudyLog.utils.toast('已导出 studylog.json', 'success');
      } catch (e) {
        showMessage('error', '导出失败：' + e.message);
      }
    });

    importBtn.addEventListener('click', function () {
      importFile.value = '';
      importFile.click();
    });

    importFile.addEventListener('change', function () {
      const file = importFile.files && importFile.files[0];
      if (!file) return;
      StudyLog.utils.readFileAsText(file).then(function (text) {
        const result = StudyLog.storage.importJSON(text, {
          overwrite: !!overwrite.checked
        });
        const mb = (StudyLog.storage.estimateUsage() / 1024 / 1024).toFixed(2);
        showMessage(
          'success',
          '导入成功：新增或覆盖 ' + result.imported + ' 条记录，当前共 ' +
          result.total + ' 条，数据约 ' + mb + ' MB。'
        );
        StudyLog.utils.toast('导入成功', 'success');
        initDataUsage();
        initDashboard();
      }).catch(function (e) {
        showMessage('error', '导入失败：' + e.message);
      });
    });

    function showMessage(type, text) {
      messageEl.className = 'message show ' + type;
      messageEl.textContent = text;
    }
  }

  function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    if (protocol !== 'https:' && hostname !== 'localhost' && hostname !== '127.0.0.1') return;

    const manifestLink = document.querySelector('link[rel="manifest"]');
    const manifestHref = manifestLink ? manifestLink.href : '';
    const swUrl = manifestHref ? manifestHref.replace(/manifest\.json$/, 'sw.js') : './sw.js';
    const scope = manifestHref ? manifestHref.replace(/manifest\.json$/, '') : './';

    window.addEventListener('load', function () {
      navigator.serviceWorker.register(swUrl, { scope: scope }).catch(function (error) {
        console.warn('Service Worker 注册失败：', error);
      });
    });
  }

  StudyLog.app = {
    init: function () {
      StudyLog.storage.ensureVersion();
      initFooterYear();
      initTodayLine();
      initDashboard();
      initDataUsage();
      initDataManager();
      initServiceWorker();
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    StudyLog.app.init();
  });
})();
