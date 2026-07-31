# ARCHITECTURE.md

# Study Log 项目架构设计

## 1. 架构目标

采用纯前端架构（HTML + CSS + JavaScript），第一版无需后端，所有数据保存在浏览器 LocalStorage 中，保证后续可平滑扩展到云同步与 AI 功能。

---

# 2. 项目目录

```text
src/
├── index.html
├── css/
│   ├── style.css
│   ├── dashboard.css
│   ├── subject.css
│   ├── calendar.css
│   └── statistics.css
├── js/
│   ├── app.js
│   ├── storage.js
│   ├── upload.js
│   ├── calendar.js
│   ├── statistics.js
│   └── utils.js
├── pages/
│   ├── dashboard.html
│   ├── subject.html
│   ├── calendar.html
│   ├── statistics.html
│   └── plan.html
└── assets/
```

---

# 3. 模块划分

- app.js：应用入口
- storage.js：LocalStorage 读写
- upload.js：图片上传与预览
- calendar.js：学习日历
- statistics.js：统计分析
- utils.js：公共工具函数

---

# 4. 数据模型

## 学习记录

```json
{
  "date":"2026-08-01",
  "subject":"数学",
  "homework":"P36 第1~12题",
  "images":["base64..."],
  "uploadTime":"20:43"
}
```

## 学习计划

```json
{
  "name":"暑假15天计划",
  "type":"pdf",
  "file":"base64..."
}
```

---

# 5. LocalStorage

建议使用以下 Key：

- study_records
- study_plan
- app_settings

---

# 6. 页面关系

Dashboard
├── 学科页面
├── 学习日志
├── 日历
├── 统计
└── 学习计划

所有页面均可返回 Dashboard。

---

# 7. 扩展规划

未来增加：

- AI OCR
- AI 学习总结
- 云同步
- 用户登录

设计时保持模块独立，避免业务逻辑耦合。

---

# 8. 开发原则

- 单一职责
- 模块化
- 可维护
- 易扩展
- 响应式设计
