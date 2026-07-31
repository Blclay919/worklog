(function () {
  'use strict';

  const StudyLog = window.StudyLog = window.StudyLog || {};
  const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

  let viewYear = 0;
  let viewMonth = 0;

  function buildMonth(year, month, uploadDates) {
    const uploadSet = new Set(uploadDates || []);
    const today = StudyLog.utils.todayKey();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - offset);
    const weeks = [];
    let cells = [];

    for (let i = 0; i < 42; i++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = StudyLog.utils.dateKey(date);
      cells.push({
        date: key,
        day: date.getDate(),
        inMonth: date.getMonth() === month,
        hasUpload: uploadSet.has(key),
        isToday: key === today
      });
      if (cells.length === 7) {
        weeks.push(cells);
        cells = [];
      }
    }

    return {
      year: year,
      month: month,
      weeks: weeks
    };
  }

  function initCalendarPage() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    bindEvents();
    render();
  }

  function bindEvents() {
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    const todayBtn = document.getElementById('today-month');
    const grid = document.getElementById('calendar-grid');

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        shiftMonth(-1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        shiftMonth(1);
      });
    }
    if (todayBtn) {
      todayBtn.addEventListener('click', function () {
        const now = new Date();
        viewYear = now.getFullYear();
        viewMonth = now.getMonth();
        render();
      });
    }
    if (grid) {
      grid.addEventListener('click', function (e) {
        const day = e.target.closest('.calendar-day');
        if (day && day.getAttribute('data-date')) {
          window.location.href = 'log.html?date=' + day.getAttribute('data-date');
        }
      });
    }
  }

  function shiftMonth(delta) {
    viewMonth += delta;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear -= 1;
    }
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear += 1;
    }
    render();
  }

  function render() {
    const titleEl = document.getElementById('calendar-title');
    const summaryEl = document.getElementById('calendar-summary');
    const weekdaysEl = document.getElementById('calendar-weekdays');
    const grid = document.getElementById('calendar-grid');
    if (!titleEl || !summaryEl || !weekdaysEl || !grid) return;

    const uploadDates = StudyLog.storage.getRecords().filter(function (record) {
      return Array.isArray(record.images) && record.images.length > 0;
    }).map(function (record) {
      return record.date;
    });

    const monthData = StudyLog.calendar.buildMonth(viewYear, viewMonth, uploadDates);
    const monthKey = viewYear + '-' + StudyLog.utils.pad2(viewMonth + 1);
    const monthUploadDates = new Set(uploadDates.filter(function (date) {
      return String(date).slice(0, 7) === monthKey;
    }));

    titleEl.textContent = viewYear + '年' + (viewMonth + 1) + '月';
    summaryEl.textContent = monthUploadDates.size
      ? '本月有 ' + monthUploadDates.size + ' 天完成上传'
      : '本月还没有上传记录';

    weekdaysEl.innerHTML = WEEKDAYS.map(function (day) {
      return '<div class="calendar-weekday">' + day + '</div>';
    }).join('');

    const cells = [].concat.apply([], monthData.weeks);
    grid.innerHTML = cells.map(function (cell) {
      const classes = ['calendar-day'];
      if (!cell.inMonth) classes.push('outside');
      if (cell.isToday) classes.push('today');
      if (cell.hasUpload) classes.push('has-upload');
      return '<button type="button" class="' + classes.join(' ') + '" data-date="' + cell.date + '">' +
        '<span class="calendar-day-number">' + cell.day + '</span>' +
        (cell.hasUpload ? '<span class="calendar-day-dot"></span>' : '') +
        '</button>';
    }).join('');
  }

  StudyLog.calendar = {
    buildMonth: buildMonth
  };

  document.addEventListener('DOMContentLoaded', function () {
    initCalendarPage();
  });
})();
