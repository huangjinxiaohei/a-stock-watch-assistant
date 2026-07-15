# AI投研助手 V2 - 项目状态

更新时间：2026-07-13

## 1. 当前阶段

当前处于：**LLM 增强研究报告——P0.1 收尾修复已完成，等待推送、Render 部署与线上人工回归阶段**

本地 DeepSeek 成功路径、规则版 fallback 和合规降级路径均已验证。后端合规补丁已经提交，但尚未 push，也尚未在 Render 配置真实 LLM Key。

研究报告 P0 性能优化已完成并提交。此前线上无 Key 请求约 69 秒，前端在 60 秒超时后会触发本地 fallback；当前规则版路径已通过最小必要事实聚合消除该阻塞。

P0.1 核心数据质量门禁已完成并提交。当前 Render 的 AI_REPORT_ENABLE_LLM 仍为 false，尚未配置真实 LLM Key。

## 2. 已完成事项

### 部署与前后端闭环

- AI投研助手 V2 前端已部署到 Netlify 并上线。
- Netlify 已连接 GitHub `main` 自动部署，不再使用旧的 `api upload` 部署模式。
- Render 后端已部署 `POST /api/research/reports`。
- 已修复前端报告接口重复拼接 `/api` 的问题，真实请求路径为 `/api/research/reports`。
- 线上无 Key fallback 已验收通过，报告包含固定免责声明。

### 本地真实 LLM 与合规适配

- DeepSeek API 本地调用链路已验证：
  - `provider=openai_compatible`
  - `model=deepseek-v4-pro`
- 完成 LLM 报告 Prompt 收紧，仅允许信息整理、数据状态说明和有依据的历史状态分析。
- 完成合规规则分级：`HARD_BLOCK`、`CONTEXT_RESTRICTED`、`SOFT_WARNING`。
- 合规诊断支持非敏感的 `rule_id`、`category` 和 `path`。
- LLM candidate 与 `rule` / `rule_fallback` 已采用分阶段合规检查。
- `rule` / `rule_fallback` 不再被 `CONTEXT_RESTRICTED` 或 `SOFT_WARNING` 误拦截。
- `news_clues` 章节已限制为新闻和公告事实整理，不再生成系统技术状态分析。
- 本轮未修改 API 契约、前端、部署配置或数据源 provider。

### 研究报告 P0 性能与线程回收

- 已完成并提交研究报告 P0 性能优化：此前线上无 Key 请求约 69 秒，前端在 60 秒超时后触发本地 fallback。
- 已定位主要问题：`quote`、`detail`、`kline`、`overview` 串行聚合；可选数据源实时调用可能阻塞；`future` 外层 timeout 无法终止底层阻塞线程。
- 最终方案：事实聚合增加有界调度和超时预算；可选 `detail` / `overview` 仅使用 fresh/stale 缓存或既有 fallback；不再启动不可取消的实时扩展 provider 调用；`quote` / `kline` 保留为必要数据源。
- 线程回收测试：连续 10 次阻塞模拟均 HTTP 200，`research-report-fetch` 线程 `before/returned/after` 均为 0，无线程累计，进程可正常退出。
- 性能结果：SH600519 冷 1.90s / 热 25ms；SZ000001 冷 19ms / 热 6ms；SZ300750 冷 16ms / 热 10ms。
- 回归结果：无 Key 为 `rule/success/disabled`；HARD_BLOCK 为 `rule_fallback/fallback`；8 个章节和固定免责声明正常。
- API 契约、前端、provider、部署配置和数据库均未修改。
- 技术架构Agent：通过。测试质检Agent：通过。
- Commit：`a782db4`，`perf: bound research report data aggregation`。
- 当前尚未 push，尚未配置 Render 真实 LLM Key。
- P1 非阻断待办：finance、moneyFlow、news 字段缺失专项测试；stale/mock 组合测试；quote/kline 底层 HTTP timeout 完整治理。

### 研究报告 P0.1 核心数据质量门禁

- 核心数据正式定义为独立 quote 和 kline。
- 可选增强数据为 detail、overview、finance、moneyFlow、news。
- detail.quote 不再替代独立核心 quote。
- 以下情况会在调用 LLM 前转为 rule_fallback：quote 或 kline 缺失、来源为 mock/fallback、核心数据严重 stale、收盘后价格明显不一致、交易日明显不一致。
- 盘中 quote 与日 K 收盘价不同不会仅凭价格差误拦截。
- 可选增强数据缺失不会阻断可信核心数据下的 AI 报告，并在前端标注增强数据状态。
- 前端已区分：AI增强报告 + 核心数据可用、核心数据待复核、降级整理稿 + 核心数据不可用、部分增强数据缺失、增强数据待复核。
- API 契约、数据源 provider、部署配置和环境变量均未修改。
- 后端 compileall、前端 typecheck 和 build 均通过；构建仅保留既有 ECharts chunk 体积警告。
- 技术架构Agent和测试质检Agent均审查通过。
- Commit：e4ad0e4，feat: add core data quality gate for AI reports。
- 当前尚未 push，Render AI_REPORT_ENABLE_LLM 仍为 false。

## 3. 测试结果

- Python `compileall` 通过。
- 无 Key fallback：HTTP 200、`source=rule`、`status=success`、`provider=disabled`。
- HARD_BLOCK 命中后：HTTP 200、`source=rule_fallback`、`status=fallback`。
- `fallbackReason` 仅包含规则 ID、类别和路径等非敏感诊断。
- 七类 HARD_BLOCK 继续有效。
- 报告固定免责声明存在，8 个章节完整。
- 敏感信息扫描为 0 命中。
- 三个 Python 文件均为 UTF-8 无 BOM、LF 且无混合行尾。
- `git diff --check` 通过。

## 4. 真实 LLM 三只股票复测

| 股票 | HTTP | source | status | provider | model |
| --- | ---: | --- | --- | --- | --- |
| SH600519 | 200 | `llm` | `success` | `openai_compatible` | `deepseek-v4-pro` |
| SZ000001 | 200 | `llm` | `success` | `openai_compatible` | `deepseek-v4-pro` |
| SZ300750 | 200 | `llm` | `success` | `openai_compatible` | `deepseek-v4-pro` |

三份报告均满足：

- 8 个章节完整，固定免责声明存在。
- 无交易建议、目标价、仓位建议、收益承诺或未来价格预测。
- 保留有数据依据的历史状态分析。
- 无 API Key 泄露。

## 5. 提交状态

- 后端合规补丁已提交。
- Commit：`c34fd99`
- Commit message：`feat: refine LLM report compliance handling`
- Commit 仅包含 `prompts.py`、`compliance.py`、`service.py` 三个后端文件。
- 前序 V2/合规提交已推送至 main；P0 性能优化 commit `a782db4` 尚未 push。
- 当前尚未配置 Render 真实 LLM Key。
- Git 工作区在本次文档更新前为干净状态。

## 6. 审查说明

- 技术架构Agent：待回传，原因 `systemError`。
- 投研提示词Agent：待回传，原因 `systemError`。
- 测试质检Agent：待回传，原因 `systemError`。
- Commit `c34fd99` 是用户明确授权基于降级审查证据提交。
- 三个 Agent 未完成独立审查，不得表述为审查通过，也不得编造审查结论。

## 7. 当前架构

- 前端：React + TypeScript + Vite，部署于 Netlify。
- 后端：FastAPI + Python，部署于 Render。
- 行情数据：东方财富、AkShare、Sina 等免费数据链路，SQLite 用作本地缓存。
- 研究报告：前端调用 `/api/research/reports`，后端负责事实聚合、LLM 调用、schema 校验、分级合规检查和规则版 fallback。
- LLM Key 只能由后端环境变量读取，前端不直连 LLM Provider。

## 8. 当前待办

1. 单独提交本次 PROJECT_STATUS.md 和 CHANGELOG.md 更新。
2. 决定是否将 e4ad0e4 与文档 commit push 到 main。
3. Push 后验证 Render 是否部署到最新 commit，并在未配置真实 Key 时确认线上 fallback 仍正常。
4. 验证核心 mock/fallback 时前端显示“降级整理稿”和“核心数据不可用”。
5. 在本地验证全部通过的前提下，再决定是否在 Render 后端配置 DeepSeek Key；线上 Key 只能放入 Render 后端环境变量，禁止进入前端、Git、文档和日志。
6. P0.1 线上回归通过后，正式启动 V2.1 用户需求驱动改版。
7. V2.1 待规划方向：重大事件与公告、业绩变化、风险与后续观察事项、行业外部因素、估值解释。
8. P1 非阻断待办：finance、moneyFlow、news 字段缺失专项测试；stale/mock 组合测试；quote/kline 底层 HTTP timeout 完整治理。


## P0.1 disabled 状态收尾修复

- LLM disabled：`source=rule`、`status=success`、`provider=disabled`、`model=null`。
- LLM 调用失败：`source=rule_fallback`、`status=fallback`、`provider=openai_compatible`，保留实际配置模型。
- LLM 成功：`source=llm`、`status=success`、`provider=openai_compatible`，保留实际配置模型。
- 三种场景均验证 HTTP 200、八个章节完整、固定免责声明存在。
- API 契约、前端、provider 和部署配置均未修改；`compileall`、`git diff --check`通过，未发现真实 API Key 泄露。
- Commit：`f2052c3`，`fix: hide model when LLM reports are disabled`。
- 当前尚未 push，Render `AI_REPORT_ENABLE_LLM` 仍为 `false`。
- 待办：提交项目记忆文档，推送代码与文档 commit，等待 Render 部署，并由用户在浏览器手动验证 600519 的请求路径、HTTP 状态、核心数据状态、规则整理稿、免责声明和 Console。
- `a-stock-memory/USER_REQUIREMENTS_AND_PRODUCT_REVAMP.md` 当前仍未跟踪、未提交，不代表已正式纳入项目规范。

## 9. 当前产品边界

- 本项目只做信息整理和研究辅助。
- 不做自动荐股或股票预测。
- 不提供交易建议、仓位建议、目标价或收益承诺。
- 所有报告必须包含免责声明：“以上内容由系统根据公开行情数据和规则生成，仅用于信息整理和研究辅助，不构成投资建议。”
- API Key 只能存在于后端环境变量，禁止进入前端、Git、文档和日志。
- 数据缺失、缓存、降级或 mock 状态必须明确标注，不得伪装为实时真实数据。
- V2.1 用户需求驱动改版目前仅为待规划事项，不得写成已完成。

## V2.1.1 Major Event Clues - Current Status

Current phase: V2.1 user-demand-driven product revision; the first subphase is V2.1.1 major event clues.

### Product Positioning

- P0.1 core-data quality gates have completed online acceptance.
- The product now prioritizes information that ordinary quote screens do not integrate quickly: major event clues, earnings changes, risks, industry and external factors, valuation context, and follow-up observations.
- The current capability is major event clues, not a formal announcement center.
- The implementation reuses `stock_detail.news` / `ak.stock_news_em`; no standalone company announcement, exchange announcement, or regulator feed has been added.
- Ordinary news must not be packaged as a formal announcement or a confirmed major event.

### Backend Implementation

- Added optional, backward-compatible `majorEvents` response data.
- Added rule-based event classification, date windows, deduplication, ranking, status and follow-up handling.
- Recent 30-day events are prioritized; substantive unfinished events within 90 days are retained.
- The default display limit is 3 and the maximum is 5; insufficient data is not padded with fabricated events.
- mock, fallback and abnormal dates cannot become confirmed events. stale, missing URLs, weak classification and unfinished items are shown as pending review.
- Duplicate selection prefers authoritative sources, valid URLs, fresh data, newer same-level entries and complete fields. Substantive follow-up developments are retained.
- LLM is not responsible for deciding whether an event is major and cannot add events, change event status or infer price direction.

Backend commit: `9a89901` - `feat: add major event clues to research reports`.

### Frontend Implementation

- Added `MajorEventsOverview` after report metadata and before report data status.
- Displays date, type, title, source, status, summary, source link and follow-up items. Missing URLs show an unavailable-link state.
- The frontend does not reclassify, deduplicate, reorder or upgrade ordinary news. Missing `majorEvents` remains backward compatible.
- The report sections, data status, source status and disclaimer remain intact.

Frontend commit: `879f1a8` - `feat: show major event clues in research reports`.

### Homepage Stability Fix

- Fixed the homepage crash caused by incomplete `marketStats` fields.
- The fix uses existing quote samples for field-level fallback, adds no data source and does not fabricate market data.

Commit: `5e9a259` - `fix: prevent homepage crash on missing market stats`.

### Validation

- Backend compile, event classification, 30-day priority, 90-day unfinished retention, duplicate-event preference, empty state, no-Key rule fallback, HARD_BLOCK fallback, 8 sections and disclaimer checks passed.
- Frontend `pnpm typecheck` and `pnpm build` passed. The existing ECharts/Charts chunk-size warning remains the only build warning.
- Desktop browser smoke test passed for the currently available empty-event state, report ordering, disclaimer, API request flow, no white screen and no new Console errors.
- 390px mobile smoke test passed with no horizontal overflow.
- Constructed 1/3/5-event, missing URL, stale, mock and fallback variants were covered by rule tests and frontend logic; they were not all triggered by live browser data and must not be recorded as browser-confirmed.

### Commit and Deployment State

- User requirements document commit: `f904445` - `docs: add user-driven product revamp requirements`.
- The four V2.1.1 commits are complete and remain unpushed: `9a89901`, `879f1a8`, `5e9a259`, `f904445`.
- The Git working tree was clean before this memory update.
- `stock-web/dist` is not tracked. No provider, deployment configuration, environment variable or API key was changed.
- Render LLM remains disabled. No Render or Netlify deployment claim is made in this update.

### Remaining Steps

1. Commit this project-memory update.
2. Push the five commits to `main` only after user confirmation.
3. Wait for Render and Netlify deployment, then run online no-Key regression.
4. Verify the major event clues module and homepage crash fix online.
5. Keep Render LLM disabled until online fallback and data-quality checks are complete.

## V2.1.2 业绩变化概览

### 产品边界

- 当前模块名称为“业绩变化概览”，不是完整的“业绩原因解释”。
- 当前只基于最新一期财务快照。
- 当前能够展示：营收增速、净利润增速、毛利率、ROE、资产负债率、EPS、营收与净利润同步或分化关系、数据来源、数据日期、数据状态、数据限制和后续复核事项。
- 当前不支持：环比、多期趋势、扣非净利润、经营现金流、费用率、一次性损益和确定性经营原因归因。
- `asOfDate` 仅展示为“数据日期”，不解释为公告日期或报告期。

### 后端实现

- 新增可选顶层字段 `financialExplanation`，属于向后兼容的加法扩展。
- 新增 `stock-api/app/research/financial_facts.py`，对营收与净利润进行同向增长、同向下降或表现分化判断。
- 对缺失值、NaN、Infinity、异常日期、mock、fallback、stale 和 `available=false` 做防御处理。
- LLM 只能复述服务端已确认事实，不得修改 `changePattern` 或 `dataStatus`，不得编造业绩原因、股价方向或投资建议。
- `financialExplanation` 用户可见文本已纳入白名单合规扫描；`sourceName`、日期、状态枚举等元数据不会被宽泛扫描。
- `_finalize()` 合规失败会进入安全 fallback，不产生 HTTP 500、递归或异常泄露。
- 原 8 个章节和固定免责声明保持不变。

Backend commit: `c0fb47f` - `feat: add financial change overview to research reports`.

### 前端实现

- 新增 `FinancialChangeOverview`。
- 模块顺序为：重大事件线索 -> 业绩变化概览 -> 数据状态 -> 原 8 个章节。
- 前端只展示服务端结果，不自行计算 `changePattern`，不推断经营原因。
- 支持完整、部分缺失、待复核、不可用和旧响应缺失状态。
- 财务数据不足时显示安全空状态，不写成“公司没有业绩变化”。
- 桌面端和约 390px 移动端布局通过验证；原重大事件模块、报告章节和免责声明无回归。

Frontend commit: `a890cbb` - `feat: show financial change overview in research reports`.

### 验证结果

- 后端 compileall 通过。
- disabled：HTTP 200，`rule/success/disabled/model=null`。
- LLM 失败：HTTP 200，`rule_fallback/fallback`。
- HARD_BLOCK：HTTP 200，安全规则版 fallback。
- `_finalize()` 合规失败：HTTP 200，无递归或异常泄露。
- 合规扫描白名单、元数据误扫、旧响应兼容、8 个章节和免责声明测试通过。
- 前端 `pnpm typecheck` 和 `pnpm build` 通过，仅保留既有 Charts/ECharts chunk 体积警告。
- 无 `/api/api/research/reports`，无前端 Key 或 Provider 直连；Console 无项目错误。
- 桌面端和约 390px 移动端无横向溢出。

验收边界：当前真实财务数据触发的是业绩变化概览安全空状态；完整指标、部分字段缺失、stale、mock、fallback 和异常值等构造场景由后端规则测试与前端逻辑覆盖，未声称全部通过真实浏览器数据验证。

### 当前剩余步骤

1. 提交本次项目记忆文档。
2. 将 `c0fb47f`、`a890cbb` 和文档 commit 一并 push 到 `main`。
3. 等待 Render 和 Netlify 部署，保持 Render LLM 关闭。
4. 执行线上无 Key 验收，确认业绩变化概览安全空状态、重大事件模块、8 个章节和免责声明在线正常。
5. 验收通过后正式完成 V2.1.2.

## V2.1.3 Risk and Watch Overview

### Scope and rules

- Added the optional backward-compatible `riskOverview` response field without adding a ninth fixed report section.
- Risk and watch items are derived only from existing server facts: `coreStatus`, `majorEvents`, `financialExplanation`, finance metrics, technical data, news and data-status fields.
- Risk categories cover core-data quality, earnings and finance, major events or governance, technical-state observations, and information freshness or missing data.
- Severity is limited to `high_attention`, `medium_attention`, and `general_attention`; it is not mapped to trading actions, position sizing, stop-loss, price direction or return expectations.
- mock, fallback, stale and missing data produce limitations or follow-up items only and cannot become confirmed risks.
- The server limits risk items and watch items to five each and does not pad empty results.
- The frontend only renders server results and remains backward compatible when `riskOverview` is absent.
- The browser title is now `AI投研助手`.
- Major events, financial change overview, the original eight sections and the fixed disclaimer remain unchanged.

### Local validation

- Backend `compileall` passed.
- Rule cases passed for available, partial and degraded core/financial data, including no confirmed risk from degraded data.
- Disabled endpoint smoke test passed with HTTP 200, `source=rule`, `status=success`, `provider=disabled`, `model=null`, `riskOverview.status=partial`, eight sections and the fixed disclaimer.
- HARD_BLOCK regression and legacy response compatibility passed.
- Frontend `pnpm typecheck` and `pnpm build` passed; only the existing Charts/ECharts chunk-size warning remains.
- No provider, network request, database, deployment configuration, environment variable or LLM prompt was changed.
- No API key, authorization header, bearer token, frontend provider connection or tracked `stock-web/dist` output was found.

### Deployment state and boundaries

- The V2.1.3 code and documentation are not yet pushed or deployed at the time of this update.
- Render LLM remains disabled.
- Live browser acceptance must report the actual riskOverview state. Constructed rule cases do not count as live confirmation of every risk state.
- This module is risk and follow-up information organization, not investment advice or a price forecast.
