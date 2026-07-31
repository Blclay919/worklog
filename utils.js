(function () {
  'use strict';

  const StudyLog = window.StudyLog = window.StudyLog || {};

  StudyLog.utils = {
    pad2: function (n) {
      return String(n).padStart(2, '0');
    },
    dateKey: function (date) {
      const d = date || new Date();
      return d.getFullYear() + '-' + this.pad2(d.getMonth() + 1) + '-' + this.pad2(d.getDate());
    },
    todayKey: function () {
      return this.dateKey(new Date());
    },
    weekdayCN: function (date) {
      const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      return days[(date || new Date()).getDay()];
    },
    formatDateCN: function (dateKey) {
      const parts = String(dateKey).split('-');
      return Number(parts[0]) + '年' + Number(parts[1]) + '月' + Number(parts[2]) + '日';
    },
    timeNow: function () {
      const d = new Date();
      return this.pad2(d.getHours()) + ':' + this.pad2(d.getMinutes());
    },
    uid: function () {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },
    escapeHtml: function (value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
    downloadText: function (filename, text, mime) {
      const blob = new Blob([text], { type: mime || 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);
    },
    readFileAsText: function (file) {
      return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () {
          resolve(String(reader.result));
        };
        reader.onerror = function () {
          reject(new Error('读取文件失败'));
        };
        reader.readAsText(file);
      });
    },
    toast: function (text, type) {
      let el = document.querySelector('.toast');
      if (!el) {
        el = document.createElement('div');
        el.className = 'toast';
        document.body.appendChild(el);
      }
      el.className = 'toast show ' + (type || 'success');
      el.textContent = text;
      window.clearTimeout(el._toastTimer);
      el._toastTimer = window.setTimeout(function () {
        el.className = 'toast';
      }, 2400);
    }
  };
})();
