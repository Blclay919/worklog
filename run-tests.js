'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const JS_DIR = path.join(ROOT, 'js');
const store = new Map();

global.window = global;
global.localStorage = {
  getItem: function (key) {
    return store.has(key) ? store.get(key) : null;
  },
  setItem: function (key, value) {
    store.set(key, String(value));
  },
  removeItem: function (key) {
    store.delete(key);
  },
  clear: function () {
    store.clear();
  },
  key: function (index) {
    return Array.from(store.keys())[index] || null;
  },
  get length() {
    return store.size;
  }
};

global.document = {
  addEventListener: function () {}
};

function load(name) {
  const code = fs.readFileSync(path.join(JS_DIR, name), 'utf8');
  vm.runInThisContext(code, { filename: name });
}

[
  'utils.js',
  'subjects.js',
  'storage.js',
  'statistics.js',
  'calendar.js',
  'upload.js',
  'plan.js'
].forEach(load);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    console.error('FAIL: ' + message);
  }
}

function equal(actual, expected, message) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    message + ' (expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual) + ')'
  );
}

// 学科配置
assert(StudyLog.subjects.list.length === 6, '学科列表应为 6 个');
equal(StudyLog.subjects.getName('math'), '数学', '学科名称映射');

// 日期工具
equal(StudyLog.utils.dateKey(new Date(2026, 7, 1)), '2026-08-01', 'dateKey 格式化');
equal(StudyLog.utils.formatDateCN('2026-08-01'), '2026年8月1日', '中文日期格式化');

// LocalStorage 存储
StudyLog.storage.ensureVersion();
StudyLog.storage.upsertRecord({
  date: '2026-08-01',
  subject: 'math',
  homework: 'P1',
  images: ['a', 'b'],
  uploadTime: '10:00'
});
StudyLog.storage.upsertRecord({
  date: '2026-08-01',
  subject: 'english',
  homework: 'E1',
  images: [],
  uploadTime: '11:00'
});
equal(StudyLog.storage.getRecords().length, 2, 'upsert 新增记录');
StudyLog.storage.upsertRecord({
  date: '2026-08-01',
  subject: 'math',
  homework: 'P2',
  images: ['c'],
  uploadTime: '12:00'
});
const mathRecords = StudyLog.storage.getRecords().filter(function (record) {
  return record.subject === 'math';
});
equal(mathRecords.length, 1, 'upsert 同一天同学科只保留一条');
equal(mathRecords[0].homework, 'P2', 'upsert 更新作业文本');
equal(mathRecords[0].images, ['c'], 'upsert 更新图片列表');
equal(StudyLog.storage.getRecordsByDate('2026-08-01').length, 2, '按日期查询记录');

// 记录元数据
StudyLog.storage.clearAll();
StudyLog.storage.upsertRecord({ date: '2026-08-03', subject: 'math', images: ['x'] });
const firstRecord = StudyLog.storage.getRecords()[0];
assert(typeof firstRecord.id === 'string' && firstRecord.id.length > 0, '新记录自动生成 id');
assert(
  typeof firstRecord.createdAt === 'string' && typeof firstRecord.updatedAt === 'string',
  '新记录包含创建/更新时间'
);
const firstCreatedAt = firstRecord.createdAt;
const firstId = firstRecord.id;
StudyLog.storage.upsertRecord({ date: '2026-08-03', subject: 'math', images: ['y'] });
const updatedRecord = StudyLog.storage.getRecords()[0];
equal(updatedRecord.id, firstId, '更新记录保留 id');
equal(updatedRecord.createdAt, firstCreatedAt, '更新记录保留 createdAt');

// 损坏数据处理
localStorage.setItem(
  StudyLog.storage.keys.records,
  '[{"date":123,"subject":true},{"date":"2026-08-04","subject":"math","images":["ok"]}]'
);
equal(StudyLog.storage.getRecords().length, 1, '损坏记录自动过滤');

// 重置为已知数据，供导出与导入测试使用
StudyLog.storage.clearAll();
StudyLog.storage.upsertRecord({
  date: '2026-08-01',
  subject: 'math',
  homework: 'P1',
  images: ['a', 'b'],
  uploadTime: '10:00'
});
StudyLog.storage.upsertRecord({
  date: '2026-08-01',
  subject: 'english',
  homework: 'E1',
  images: [],
  uploadTime: '11:00'
});

// 存储空间不足提示
const originalSetItem = global.localStorage.setItem;
global.localStorage.setItem = function () {
  const error = new Error('quota exceeded');
  error.name = 'QuotaExceededError';
  throw error;
};
let quotaMessage = '';
try {
  StudyLog.storage.saveRecords([{ date: '2026-08-05', subject: 'math', images: [] }]);
} catch (e) {
  quotaMessage = e.message;
}
global.localStorage.setItem = originalSetItem;
assert(/存储空间不足/.test(quotaMessage), '存储空间不足时给出中文提示');

// 非法 JSON 导入提示
let importError = '';
try {
  StudyLog.storage.importJSON('not-json');
} catch (e) {
  importError = e.message;
}
assert(/JSON 格式不正确/.test(importError), '非法 JSON 导入提示');

const backup = JSON.parse(StudyLog.storage.exportJSON());
assert(backup.records.length === 2 && backup.app === 'Study Log', '导出 JSON 包含记录');

const importData = JSON.stringify({
  records: [{
    date: '2026-08-02',
    subject: 'math',
    homework: 'P3',
    images: ['d'],
    uploadTime: '09:00'
  }]
});
StudyLog.storage.importJSON(importData, { overwrite: false });
equal(StudyLog.storage.getRecords().length, 3, '导入默认合并记录');
StudyLog.storage.importJSON(importData, { overwrite: true });
equal(StudyLog.storage.getRecords().length, 1, '导入覆盖记录');
const cleanedImport = JSON.stringify({
  records: [
    { date: 123 },
    { date: '2026-08-06', subject: 'math', images: ['z'] }
  ]
});
StudyLog.storage.importJSON(cleanedImport, { overwrite: true });
equal(StudyLog.storage.getRecords().length, 1, '导入时过滤损坏记录');
assert(StudyLog.storage.estimateUsage() > 0, '数据用量估算');

// 统计
StudyLog.storage.clearAll();
[
  { date: '2026-08-01', subject: 'math', images: ['a', 'b'] },
  { date: '2026-08-01', subject: 'english', images: ['c'] },
  { date: '2026-08-02', subject: 'math', images: ['d', 'e', 'f'] },
  { date: '2026-07-31', subject: 'math', images: ['g'] }
].forEach(function (record) {
  StudyLog.storage.upsertRecord(record);
});
const stats = StudyLog.statistics.calc(StudyLog.storage.getRecords(), '2026-08-02');
equal(stats.totalImages, 7, '总上传图片数量');
equal(stats.totalRecords, 4, '有图记录条数');
equal(stats.streak, 3, '连续上传天数');
equal(stats.monthImages, 6, '本月上传图片数量');
equal(stats.monthRecords, 3, '本月记录条数');
const mathStat = stats.perSubject.find(function (item) {
  return item.id === 'math';
});
equal(mathStat.count, 3, '数学上传次数');
equal(mathStat.images, 6, '数学上传图片数');

// 日历
StudyLog.storage.clearAll();
const month = StudyLog.calendar.buildMonth(2026, 7, ['2026-08-01', '2026-08-15']);
const cells = [].concat.apply([], month.weeks);
equal(cells.length, 42, '日历固定渲染 42 个单元格');
equal(cells[0].date, '2026-07-27', '2026-08 月历周一起始');
const aug1 = cells.find(function (cell) {
  return cell.date === '2026-08-01';
});
assert(aug1 && aug1.hasUpload, '日历标记有记录日期');
const aug15 = cells.find(function (cell) {
  return cell.date === '2026-08-15';
});
assert(aug15 && aug15.hasUpload, '日历标记第二个有记录日期');

// 上传文件类型校验
assert(StudyLog.upload.isSupportedImage('image/jpeg'), '支持 JPG');
assert(StudyLog.upload.isSupportedImage('image/png'), '支持 PNG');
assert(!StudyLog.upload.isSupportedImage('application/pdf'), '不支持 PDF 作为学科图片');

// 学习计划文件类型校验
equal(
  StudyLog.plan.normalizeType({ type: 'application/pdf', name: 'plan.pdf' }),
  'pdf',
  '识别 PDF 计划'
);
equal(
  StudyLog.plan.normalizeType({ type: 'image/png', name: 'plan.png' }),
  'image',
  '识别图片计划'
);
equal(
  StudyLog.plan.normalizeType({ type: 'text/plain', name: 'plan.txt' }),
  null,
  '拒绝其他计划文件'
);

console.log('Tests passed: ' + passed + ', failed: ' + failed);
process.exit(failed ? 1 : 0);
