(function () {
  'use strict';

  const StudyLog = window.StudyLog = window.StudyLog || {};

  let selectedDate = StudyLog.utils.todayKey();

  function initLogPage() {
    const listEl = document.getElementById('log-list');
    if (!listEl) return;
    const urlDate = new URLSearchParams(window.location.search).get('date');
    if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
      selectedDate = urlDate;
    }
    bindEvents();
    render();
  }

  function bindEvents() {
    const prevBtn = document.getElementById('prev-day');
    const nextBtn = document.getElementById('next-day');
    const dateInput = document.getElementById('log-date-input');
    const listEl = document.getElementById('log-list');
    const lightbox = document.getElementById('lightbox');

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        selectedDate = shiftDate(selectedDate, -1);
        render();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        selectedDate = shiftDate(selectedDate, 1);
        render();
      });
    }

    if (dateInput) {
      dateInput.addEventListener('change', function (e) {
        if (e.target.value) {
          selectedDate = e.target.value;
          render();
        }
      });
    }

    if (listEl) {
      listEl.addEventListener('click', function (e) {
        const img = e.target.closest('.log-thumb');
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

  function shiftDate(dateKey, delta) {
    const parts = String(dateKey).split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2] + delta);
    return StudyLog.utils.dateKey(date);
  }

  function render() {
    const dateInput = document.getElementById('log-date-input');
    const labelEl = document.getElementById('log-date-label');
    const summaryEl = document.getElementById('log-summary');
    const listEl = document.getElementById('log-list');
    if (!dateInput || !labelEl || !summaryEl || !listEl) return;

    dateInput.value = selectedDate;
    const parts = selectedDate.split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    labelEl.textContent = StudyLog.utils.formatDateCN(selectedDate) +
      ' ' + StudyLog.utils.weekdayCN(date);

    const records = StudyLog.storage.getRecordsByDate(selectedDate);
    const uploadedCount = records.filter(function (record) {
      return Array.isArray(record.images) && record.images.length > 0;
    }).length;
    summaryEl.textContent = records.length
      ? '共 ' + records.length + ' 个学科有记录，其中 ' + uploadedCount + ' 个已上传图片'
      : '';

    if (!records.length) {
      listEl.innerHTML = '<div class="empty log-empty">这一天还没有学习记录</div>';
      return;
    }

    listEl.innerHTML = records.slice().sort(function (a, b) {
      return String(a.subject).localeCompare(String(b.subject));
    }).map(function (record) {
      const images = Array.isArray(record.images) ? record.images : [];
      const thumbs = images.map(function (src) {
        return '<img class="log-thumb" src="' + src + '" alt="学习记录图片">';
      }).join('');
      return '<article class="log-record">' +
        '<div class="log-record-head"><strong>' +
        StudyLog.utils.escapeHtml(StudyLog.subjects.getName(record.subject)) +
        '</strong><span class="muted">' +
        StudyLog.utils.escapeHtml(record.uploadTime || '') + '</span></div>' +
        '<div class="log-record-text">' +
        (record.homework ? StudyLog.utils.escapeHtml(record.homework) : '未填写作业内容') +
        '</div>' +
        (images.length ? '<div class="log-thumbs">' + thumbs + '</div>' : '') +
        '</article>';
    }).join('');
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

  document.addEventListener('DOMContentLoaded', function () {
    initLogPage();
  });
})();
