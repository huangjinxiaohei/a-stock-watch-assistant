# 项目状态

更新时间：2026-07-08

当前版本：AI投研助手 V2 开发阶段

---

## 1. 已完成功能

### V1：A股行情辅助分析基础能力

- 已完成前后端分离的 A 股行情辅助分析网站。
- 前端已部署到 Netlify，后端 FastAPI 已部署到 Render。
- 首页支持市场概览、指数行情、市场温度、涨跌家数、全市场成交额、主力资金、风险等级等展示。
- 支持市场排行：涨幅榜、跌幅榜、成交额榜、换手率榜。
- 支持自选股看盘，本地保存自选股列表。
- 支持股票搜索和个股详情页。
- 个股详情页已包含：
  - 基础报价
  - 分时走势
  - K线图
  - 成交量
  - MACD / KDJ / RSI / BOLL 等技术指标
  - 财务、资金流、新闻/公告线索等信息展示
- 已完成数据源状态展示，区分原始来源、读取方式、缓存、旧缓存、fallback/mock 等状态。
- 已完成免费数据链路：
  - 东方财富全市场快照
  - AkShare
  - 新浪兜底
  - 百度估值等辅助链路
- 已完成 SQLite 本地缓存，避免重复请求源站。
- 已处理北向资金披露口径变化，不再展示伪造或无意义的北向资金数据。
- 已完成一键启动脚本 `启动行情系统.bat`，用于本地启动前后端服务。

### V2：AI投研助手第一阶段

- 首页已从“行情辅助分析”升级为“AI投研助手”入口。
- 首页已新增股票代码/名称输入区和“生成研究报告”按钮。
- 已实现研究报告生成流程状态：
  - 准备数据
  - 整理行情
  - 整理技术指标
  - 生成研究报告
- 已新增研究报告展示面板，报告结构包含：
  - 公司概况
  - 最新行情
  - 技术分析
  - 新闻/公告线索
  - 优势观察
  - 风险因素
  - 总结
  - 免责声明
- 当前报告为前端规则生成版本，尚未接入真实 LLM API。
- 已抽离 `useResearchReport`，让首页主要负责页面编排和组件组合。
- 已增加报告数据状态展示，包括行情数据、个股详情、K线/技术指标、缺失字段、缓存或降级状态。
- 所有研究报告必须展示免责声明：
  - “以上内容由系统根据公开行情数据和规则生成，仅用于信息整理和研究辅助，不构成投资建议。”

### 多 Agent 协作

- 已建立 AI投研助手 V2 多 Agent 团队：
  - 项目总控 Agent
  - 产品经理 Agent
  - 架构师 Agent
  - 前端开发 Agent
  - 后端 / AI开发 Agent
  - 测试质检 Agent
  - 求职包装 Agent
- 第一轮第二阶段规划已完成回传。
- 团队共识：第二阶段优先做真实 LLM 报告生成最小闭环，报告历史、开放式 AI 问答、自选股批量研究后置。

---

## 2. 当前架构

### 前端：`stock-web`

- 技术栈：
  - React
  - TypeScript
  - Vite
  - ECharts
  - lucide-react
- 主要职责：
  - 首页 AI投研入口
  - 市场概览与辅助观察
  - 股票搜索与自选股
  - 个股详情页
  - 图表与技术指标展示
  - 研究报告生成流程与展示
- 当前 V2 相关文件：
  - `stock-web/src/pages/HomePage.tsx`
  - `stock-web/src/hooks/useResearchReport.ts`
  - `stock-web/src/analysis/researchReport.ts`
  - `stock-web/src/components/ResearchLauncher.tsx`
  - `stock-web/src/components/ResearchReportPanel.tsx`
  - `stock-web/src/styles.css`

### 后端：`stock-api`

- 技术栈：
  - FastAPI
  - Python
  - AkShare
  - httpx / requests
  - SQLite cache
- 主要职责：
  - 统一行情 API
  - 免费行情源代理
  - 源站 fallback
  - 缓存与旧缓存降级
  - 数据状态标注
- 当前接口能力：
  - `/api/health`
  - `/api/market/overview`
  - `/api/stocks/search`
  - `/api/stocks/{symbol}`
  - `/api/stocks/{symbol}/quote`
  - `/api/stocks/{symbol}/intraday`
  - `/api/stocks/{symbol}/kline`

### 数据链路

- 首页全市场行情优先使用项目内置东方财富全市场快照读取器。
- AkShare、Sina、百度估值等作为辅助或兜底链路。
- SQLite 作为本地缓存层，缓存内容来自真实免费行情接口或明确标注的 fallback/mock。
- 数据状态必须明确展示，不允许把 mock/fallback/stale 数据伪装成实时真实数据。

### 部署架构

- 前端：Netlify
- 后端：Render
- 代码仓库：GitHub
- 线上前端通过公网后端 API 获取行情数据。

---

## 3. 未完成任务

### P0：第二阶段最小闭环

- 后端新增真实 LLM 研究报告接口：
  - 建议接口：`POST /api/research/reports`
- 后端新增 AI / research 模块：
  - schema
  - service
  - prompt
  - LLM client
  - compliance filter
  - fallback
- 前端 `useResearchReport` 改为优先调用后端研究报告接口。
- LLM API 失败时，前端应展示规则 fallback 报告，不让页面空白。
- 报告展示需要明确生成来源：
  - AI生成报告
  - 规则整理稿
  - 降级整理稿
- 后端必须强制注入并校验免责声明。
- 后端必须阻断或修正以下风险文案：
  - 买入
  - 卖出
  - 仓位建议
  - 目标价
  - 收益承诺
  - 确定性预测

### P1：产品闭环增强

- 报告历史：
  - 生成时间
  - 股票代码与名称
  - 报告摘要或完整内容
  - 数据完整性状态
  - 生成模式
- 受限 AI 问答：
  - 只围绕当前报告、行情数据和公开信息追问
  - 不做开放式投资建议聊天
- 首页和报告页继续优化求职作品集展示效果。

### P2：高级能力

- 自选股研究 Agent。
- 自选股批量研究摘要。
- 每日信息整理摘要。
- 更稳定的新闻/公告专线。
- 外部数据库或对象存储保存报告历史。
- 更完整的监控、日志和缓存状态面板。

### 技术债与风险项

- Render 免费实例存在冷启动和源站访问不稳定问题。
- 免费行情源可能受反爬、网络、代理和接口变更影响。
- 个股资金流、新闻、财务等字段可能缺失。
- 当前 AI 报告仍是规则生成版本，不应包装为真实 LLM 生成。
- 旧市场模块中仍存在部分操作倾向文案，需要逐步改为更中性的“观察/复核/风险提示”表达。
- 接入真实 LLM 后必须增加 Prompt 注入防护、结构化输出校验和后置合规扫描。

---

## 4. 下一步计划

### 第一优先级

1. 设计并实现后端 `POST /api/research/reports`。
2. 建立后端 research 模块：
   - `schemas.py`
   - `service.py`
   - `prompts.py`
   - `llm_client.py`
   - `compliance.py`
   - `router.py`
3. 定义 LLM 请求与响应 schema，保持与前端 `ResearchReport` 结构兼容。
4. 增加环境变量配置：
   - `LLM_PROVIDER`
   - `LLM_API_KEY`
   - `LLM_BASE_URL`
   - `LLM_MODEL`
   - `LLM_TIMEOUT_SECONDS`
   - `AI_REPORT_ENABLE_LLM`
5. 实现 LLM 失败、超时、返回非法 JSON 时的规则 fallback。

### 第二优先级

1. 前端 `useResearchReport` 接入后端报告接口。
2. 保留当前前端规则报告作为本地 fallback。
3. 报告面板增加生成模式、模型状态、降级说明。
4. 优化生成流程状态：
   - 搜索股票
   - 准备数据
   - 整理行情
   - AI生成
   - 合规校验
   - 完成 / 降级

### 第三优先级

1. 增加报告历史。
2. 增加受限 AI 问答入口。
3. 更新 README、简历项目描述和面试讲述稿。
4. 执行完整 QA：
   - `pnpm typecheck`
   - `pnpm build`
   - 后端 `/api/health`
   - 首页冒烟测试
   - 个股详情页回归
   - 移动端布局检查
   - 合规词扫描

---

## 当前原则

- 本项目是 AI 辅助研究工具，不是股票预测工具、自动交易工具或投资建议工具。
- 所有 AI 生成内容必须包含免责声明。
- 不输出买入、卖出、仓位建议、目标价、收益承诺或确定性预测。
- 所有结论必须基于公开行情数据、规则整理或明确标注的数据状态。
- 数据缺失时必须说明“暂不可用”或“需补充复核”，不得编造。
