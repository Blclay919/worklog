(function () {
  'use strict';

  const StudyLog = window.StudyLog = window.StudyLog || {};

  const KEYS = {
    records: 'study_records',
    plan: 'study_plan',
    settings: 'app_settings',
    version: 'study_log_version'
  };

  const DATA_VERSION = 1;

  function isValidRecord(record) {
    return record && typeof record === 'object' &&
      typeof record.date === 'string' && typeof record.subject === 'string';
  }

  function isQuotaError(error) {
    return error && (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      /quota/i.test(error.message || '')
    );
  }

  function createId() {
    if (StudyLog.utils && typeof StudyLog.utils.uid === 'function') {
      return StudyLog.utils.uid();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function normalizeRecords(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(isValidRecord).map(function (record) {
      const cleaned = {
        date: record.date,
        subject: record.subject,
        homework: typeof record.homework === 'string' ? record.homework : '',
        images: Array.isArray(record.images) ? record.images.slice() : [],
        uploadTime: typeof record.uploadTime === 'string' ? record.uploadTime : ''
      };
      if (typeof record.id === 'string') cleaned.id = record.id;
      if (typeof record.createdAt === 'string') cleaned.createdAt = record.createdAt;
      if (typeof record.updatedAt === 'string') cleaned.updatedAt = record.updatedAt;
      return cleaned;
    });
  }

  StudyLog.storage = {
    keys: KEYS,
    version: DATA_VERSION,

    read: function (key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
      } catch (e) {
        console.error('读取数据失败:', key, e);
        return fallback;
      }
    },

    write: function (key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        if (isQuotaError(e)) {
          throw new Error('浏览器存储空间不足，请先导出备份并清理部分图片');
        }
        throw e;
      }
    },

    remove: function (key) {
      localStorage.removeItem(key);
    },

    versionOk: function () {
      return localStorage.getItem(KEYS.version) === String(DATA_VERSION);
    },

    ensureVersion: function () {
      if (!this.versionOk()) {
        localStorage.setItem(KEYS.version, String(DATA_VERSION));
      }
    },

    getRecords: function () {
      return normalizeRecords(this.read(KEYS.records, []));
    },

    saveRecords: function (records) {
      this.write(KEYS.records, records);
    },

    getRecordsByDate: function (date) {
      return this.getRecords().filter(function (record) {
        return record.date === date;
      });
    },

    upsertRecord: function (record) {
      if (!record || !record.date || !record.subject) {
        throw new Error('记录缺少日期或学科');
      }
      const records = this.getRecords();
      const index = records.findIndex(function (r) {
        return r.date === record.date && r.subject === record.subject;
      });
      const existing = index === -1 ? null : records[index];
      const now = new Date().toISOString();
      const fullRecord = Object.assign({}, record, {
        id: record.id || (existing && existing.id) || createId(),
        createdAt: record.createdAt || (existing && existing.createdAt) || now,
        updatedAt: now
      });
      if (index === -1) {
        records.push(fullRecord);
      } else {
        records[index] = fullRecord;
      }
      this.saveRecords(records);
      return records;
    },

    getPlan: function () {
      return this.read(KEYS.plan, null);
    },

    savePlan: function (plan) {
      this.write(KEYS.plan, plan);
    },

    getSettings: function () {
      return this.read(KEYS.settings, {});
    },

    saveSettings: function (settings) {
      this.write(KEYS.settings, settings);
    },

    exportJSON: function () {
      return JSON.stringify({
        app: 'Study Log',
        version: DATA_VERSION,
        exportedAt: new Date().toISOString(),
        records: this.getRecords(),
        plan: this.getPlan(),
        settings: this.getSettings()
      }, null, 2);
    },

    importJSON: function (text, options) {
      const opts = options || {};
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('JSON 格式不正确');
      }
      if (!data || typeof data !== 'object') {
        throw new Error('导入内容无效');
      }

      const records = Array.isArray(data.records)
        ? normalizeRecords(data.records)
        : [];
      const plan = data.plan && typeof data.plan === 'object' ? data.plan : null;
      const settings = data.settings && typeof data.settings === 'object' ? data.settings : {};

      if (opts.overwrite) {
        this.saveRecords(records);
        if (plan) {
          this.savePlan(plan);
        } else {
          this.remove(KEYS.plan);
        }
        this.saveSettings(settings);
      } else {
        const merged = this.getRecords().slice();
        records.forEach(function (record) {
          const index = merged.findIndex(function (r) {
            return r.date === record.date && r.subject === record.subject;
          });
          if (index === -1) {
            merged.push(record);
          } else {
            merged[index] = record;
          }
        });
        this.saveRecords(merged);
        if (plan) {
          this.savePlan(plan);
        }
        this.saveSettings(Object.assign({}, this.getSettings(), settings));
      }

      this.ensureVersion();
      return {
        imported: records.length,
        total: this.getRecords().length
      };
    },

    estimateUsage: function () {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        total += (localStorage.getItem(key) || '').length;
      }
      return total;
    },

    getUsageMB: function () {
      return this.estimateUsage() / 1024 / 1024;
    },

    clearAll: function () {
      Object.keys(KEYS).forEach(function (key) {
        localStorage.removeItem(KEYS[key]);
      });
    }
  };
})();
