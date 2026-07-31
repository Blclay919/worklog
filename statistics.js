(function () {
  'use strict';

  const StudyLog = window.StudyLog = window.StudyLog || {};

  function uploadedImages(record) {
    return Array.isArray(record.images) ? record.images.length : 0;
  }

  function hasUpload(record) {
    return uploadedImages(record) > 0;
  }

  function parseDate(key) {
    const parts = String(key).split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
  }

  function diffDays(a, b) {
    return Math.round((a - b) / 86400000);
  }

  function calc(records, today) {
    const list = Array.isArray(records) ? records : [];
    const uploaded = list.filter(hasUpload);
    const totalImages = uploaded.reduce(function (sum, record) {
      return sum + uploadedImages(record);
    }, 0);

    const month = String(today || StudyLog.utils.todayKey()).slice(0, 7);
    const monthRecords = uploaded.filter(function (record) {
      return String(record.date).slice(0, 7) === month;
    });
    const monthImages = monthRecords.reduce(function (sum, record) {
      return sum + uploadedImages(record);
    }, 0);

    const dates = Array.from(new Set(uploaded.map(function (record) {
      return record.date;
    }))).sort().reverse();
    let streak = 0;
    if (dates.length) {
      let cursor = parseDate(dates[0]);
      for (let i = 0; i < dates.length; i++) {
        const current = parseDate(dates[i]);
        if (streak === 0 || diffDays(cursor, current) === 1) {
          streak += 1;
          cursor = current;
        } else {
          break;
        }
      }
    }

    const perSubject = StudyLog.subjects.list.map(function (subject) {
      const items = uploaded.filter(function (record) {
        return record.subject === subject.id;
      });
      return {
        id: subject.id,
        name: subject.name,
        count: items.length,
        images: items.reduce(function (sum, record) {
          return sum + uploadedImages(record);
        }, 0)
      };
    });

    return {
      totalImages: totalImages,
      totalRecords: uploaded.length,
      streak: streak,
      monthImages: monthImages,
      monthRecords: monthRecords.length,
      perSubject: perSubject
    };
  }

  function initStatisticsPage() {
    const cardsEl = document.getElementById('stat-cards');
    if (!cardsEl) return;

    const stats = StudyLog.statistics.calc(
      StudyLog.storage.getRecords(),
      StudyLog.utils.todayKey()
    );

    cardsEl.innerHTML = [
      { label: '总上传数量', value: stats.totalImages, note: '已上传图片张数' },
      { label: '连续上传天数', value: stats.streak, note: '截至最近有记录的一天' },
      { label: '本月上传', value: stats.monthImages, note: '本月已上传图片张数' },
      { label: '学科记录总数', value: stats.totalRecords, note: '有图片的记录条数' }
    ].map(function (item) {
      return '<div class="stat-card">' +
        '<div class="stat-label">' + item.label + '</div>' +
        '<div class="stat-value">' + item.value + '</div>' +
        '<div class="stat-note">' + item.note + '</div>' +
        '</div>';
    }).join('');

    renderBars(stats.perSubject);
  }

  function renderBars(perSubject) {
    const el = document.getElementById('stat-bars');
    if (!el) return;
    const max = Math.max.apply(null, perSubject.map(function (item) {
      return item.count;
    }).concat([1]));

    el.innerHTML = perSubject.map(function (item) {
      const width = Math.round((item.count / max) * 100);
      return '<div class="stat-bar-row">' +
        '<span class="stat-bar-label">' + item.name + '</span>' +
        '<div class="stat-bar-track"><div class="stat-bar-fill" style="width:' + width + '%"></div></div>' +
        '<span class="stat-bar-value">' + item.count + ' 次 · ' + item.images + ' 张</span>' +
        '</div>';
    }).join('');
  }

  StudyLog.statistics = {
    calc: calc
  };

  document.addEventListener('DOMContentLoaded', function () {
    initStatisticsPage();
  });
})();
