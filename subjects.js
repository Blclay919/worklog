(function () {
  'use strict';

  const StudyLog = window.StudyLog = window.StudyLog || {};

  // 学科配置集中在此处，后续需要调整学科时只修改这个列表
  const SUBJECTS = [
    { id: 'math', name: '数学' },
    { id: 'english', name: '英语' },
    { id: 'chinese', name: '语文' },
    { id: 'physics', name: '物理' },
    { id: 'chemistry', name: '化学' },
    { id: 'history', name: '历史' }
  ];

  StudyLog.subjects = {
    list: SUBJECTS,
    getById: function (id) {
      return SUBJECTS.find(function (s) {
        return s.id === id;
      }) || null;
    },
    getName: function (id) {
      const s = this.getById(id);
      return s ? s.name : id;
    }
  };
})();
