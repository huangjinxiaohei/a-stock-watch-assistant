# 更新日志

## Unreleased - 2026-07-11

### P0.1 核心数据质量门禁

- Added independent quote and kline core-data quality gates.
- Prevented mock、fallback、severely stale or inconsistent core data from producing normal AI-enhanced reports.
- Kept detail、overview、finance、moneyFlow and news as optional enhancement data.
- Updated frontend report status to distinguish core data available、core data pending review、core data unavailable、partial enhancement data missing and enhancement data pending review.
- Prevented rule_fallback from being displayed as a normal AI-enhanced report.
- Recorded commit e4ad0e4: feat: add core data quality gate for AI reports.
- Recorded that code has not yet been pushed and Render LLM remains disabled.
- Recorded V2.1 user-demand-driven product redesign as a future phase, not completed work。



### 研究报告 P0 性能与线程回收

- 优化研究报告事实聚合性能，减少无 Key 规则版报告对非必要扩展数据的等待。
- 修复不可取消的可选数据调用可能导致 `research-report-fetch` 线程残留的问题。
- 可选 `detail` / `overview` 改为 fresh/stale 缓存或既有 fallback 优先，不再启动不可取消的实时扩展 provider 调用；`quote` / `kline` 保留为必要数据源。
- 记录性能结果：SH600519 冷 1.90s / 热 25ms，SZ000001 冷 19ms / 热 6ms，SZ300750 冷 16ms / 热 10ms。
- 记录连续 10 次线程回收模拟：均返回 HTTP 200，线程数无累计，测试进程可正常退出。
- 已提交 `a782db4`：`perf: bound research report data aggregation`。
- 上述性能优化 commit 尚未 push，Render 尚未配置真实 LLM Key。
- P1 非阻断待办：finance、moneyFlow、news 字段缺失专项测试；stale/mock 组合测试；quote/kline 底层 HTTP timeout 完整治理。

### LLM 合规治理

- Refined LLM report prompts to preserve data-backed historical analysis while prohibiting recommendations and future price predictions.
- 新增 `HARD_BLOCK`、`CONTEXT_RESTRICTED`、`SOFT_WARNING` 分级治理。
- 新增基于规则 ID、类别和字段路径的非敏感合规诊断。
- 将 LLM candidate 合规检查与 `rule` / `rule_fallback` 检查分离。
- 修复规则版 fallback 被上下文限制规则或软提示规则误拦截的问题。
- 将 `news_clues` 限定为新闻和公告事实整理，禁止系统在该章节生成技术状态分析。
- 本轮未修改 API 契约、前端、部署配置或数据源 provider。

### 验证

- 验证无 Key 规则版 fallback：HTTP 200、`source=rule`、`status=success`、`provider=disabled`。
- 验证 HARD_BLOCK 命中后的规则版 fallback：HTTP 200、`source=rule_fallback`、`status=fallback`。
- 验证七类 HARD_BLOCK、固定免责声明、8 个报告章节、编码与敏感信息扫描。
- 使用 DeepSeek `deepseek-v4-pro` 完成本地真实 LLM 成功路径复测：`SH600519`、`SZ000001`、`SZ300750`。
- 三份报告均为 `llm/success`，且未发现交易建议、目标价、仓位建议、收益承诺、未来价格预测或 API Key 泄露。

### 提交与审查状态

- 后端合规补丁已提交为 `c34fd99`：`feat: refine LLM report compliance handling`。
- 技术架构Agent、投研提示词Agent、测试质检Agent的独立审查仍待回传，原因均为 `systemError`。
- Commit `c34fd99` 由用户明确授权基于降级审查证据提交，不代表三个独立 Agent 已审查通过。
- 代码尚未 push，Render 尚未配置真实 LLM Key。


### P0.1 disabled 状态收尾修复

- Fixed disabled LLM report status incorrectly exposing the configured model name.
- When LLM reporting is disabled: `provider=disabled` and `model=null`.
- Preserved configured model information for LLM success and LLM failure fallback states.
- Recorded commit `f2052c3`: `fix: hide model when LLM reports are disabled`.
- Recorded that the fix has not yet been pushed.
- Recorded that Render LLM remains disabled.
- Final browser verification is still pending.
- `a-stock-memory/USER_REQUIREMENTS_AND_PRODUCT_REVAMP.md` is intentionally excluded from this commit.

## V2.0.0 - 2026-07-08

### 已完成

- 首页升级为“AI投研助手”入口。
- 新增股票输入和结构化研究报告生成流程。
- 新增规则版研究报告、数据状态和免责声明展示。
- 后端新增 LLM 研究报告 API、schema 校验、合规检查和规则版 fallback。
- 前端接入后端研究报告 API，并保留前端规则版二级 fallback。
- Netlify 前端改为从 GitHub `main` 自动构建和部署。
- Render 后端 `POST /api/research/reports` 已上线。
- 修复前端重复拼接 `/api` 的问题。

### 未纳入本版本

- AI 问答。
- 报告历史。
- 用户系统。
- 自动荐股和股票预测。

## V1.0.0

- 完成 A 股股票查询、市场行情展示、自选股、市场排行和个股详情等基础能力。

## Unreleased - 2026-07-14

### Added

- Added rule-based major event clues to research reports.
- Added optional `majorEvents` response data as a backward-compatible extension.
- Added event classification, date-window filtering, deduplication, ranking and follow-up states.
- Added `MajorEventsOverview` before the report data-status section.
- Added empty, pending-review and unavailable-source states.
- Added the user-driven product revamp requirements document.

### Fixed

- Improved duplicate-event selection to prefer authoritative, traceable, fresh and complete sources.
- Preserved substantive follow-up developments instead of incorrectly deduplicating them.
- Fixed homepage crashes when `marketStats` fields are missing.

### Validation

- Backend compile and rule regressions passed.
- Frontend typecheck and production build passed.
- Desktop and 390px mobile browser smoke tests passed.
- The existing ECharts/Charts chunk-size warning remains.
- No sensitive API credentials were found in the submitted files.
- Render LLM remains disabled.
- Real browser validation covered the currently available empty-event state; constructed event variants were covered by rule tests and frontend logic rather than live browser data.

### Commits

- `9a89901` - `feat: add major event clues to research reports`
- `879f1a8` - `feat: show major event clues in research reports`
- `5e9a259` - `fix: prevent homepage crash on missing market stats`
- `f904445` - `docs: add user-driven product revamp requirements`

These commits have not been pushed or deployed.

## Unreleased - 2026-07-15

### Added

- Added a backward-compatible optional `financialExplanation` response field.
- Added latest-period financial fact normalization and revenue/profit change-pattern summaries.
- Added `FinancialChangeOverview` to research reports.
- Added financial data limitation and follow-up information.
- Added `financialExplanation` compliance scanning for user-visible text.

### Fixed

- Prevented `financialExplanation` compliance failures from producing HTTP 500 responses.
- Restricted compliance scanning to explicit user-visible financial fields to reduce metadata false positives.
- Added safe fallback behavior for final response compliance failures.

### Validation

- Backend compile and financial rule tests passed.
- Disabled, LLM failure, HARD_BLOCK and finalization fallback tests passed.
- Frontend typecheck and production build passed.
- Desktop and approximately 390px mobile smoke tests passed.
- Existing Charts/ECharts chunk-size warning remains.
- No sensitive credentials or frontend provider connection were found.
- Render LLM remains disabled.
- Changes have not yet been pushed or deployed.
- Real browser data triggered only the safe empty state; constructed financial states were covered by tests and frontend logic.

### Commits

- `c0fb47f` - `feat: add financial change overview to research reports`
- `a890cbb` - `feat: show financial change overview in research reports`

## Unreleased - 2026-07-15 - V2.1.3

### Added

- Added optional `riskOverview` response data for server-derived risk clues and follow-up observations.
- Added bounded risk and watch item lists with core-data, financial, event/governance, technical-state and information-quality categories.
- Added `RiskWatchOverview` while preserving major events, financial change overview, the original eight sections and the disclaimer.
- Updated the browser title to `AI投研助手`.

### Validation

- Backend compile, rule, fallback, HARD_BLOCK and legacy-response compatibility checks passed.
- Local no-Key HTTP smoke test passed with HTTP 200 and `rule/success/disabled/model=null`.
- Frontend typecheck and production build passed; the existing Charts/ECharts chunk warning remains.
- Degraded and missing data produce limitations or follow-up items rather than confirmed risks.
- No new upstream request, provider connection, deployment setting, environment variable or sensitive credential was added.
- The V2.1.3 code and documentation were pushed to `main`; Render LLM remains disabled.

### Commits

- `3353396` - `feat: add risk and watch overview to research reports`
- `d3929e7` - `feat: show risk and watch overview in research reports`
- `4dd300e` - `docs: record risk and watch overview implementation`

## Unreleased - 2026-07-15 - Data Availability Stabilization

### Fixed

- Prioritized an existing Eastmoney single-stock snapshot before the full-market snapshot path for quote retrieval.
- Preserved the existing full-market, AkShare, Sina, cache and mock fallback behavior when the single-stock request is unavailable.

### Validation

- Added a unit test proving a successful single-stock snapshot avoids the full-market request.
- Backend compile and unit test passed.
- Online `SH600519` demonstrated fresh AkShare quote, kline and detail cache data, ten non-mock news items, and a no-Key rule report in 1.502 seconds.
- Financial and money-flow source failures remained visible as unavailable data; they were not converted to fresh or confirmed content.
- Render LLM remains disabled. No credential, provider configuration or frontend direct-provider connection was added.

### Commit

- `f80512d` - `fix: prioritize single-stock quote snapshots`
## Unreleased - 2026-07-15 - Final Product Freeze

### Changed

- Standardized user-facing research data labels for available, stale, mock, fallback, missing and partial states.
- Reworded the display-only technical-state title to “技术状态需关注” without changing server risk rules.

### Added

- Added a root README with deployment, architecture, quality-gate, fallback, module and limitation documentation.
- Added `a-stock-memory/JOB_SEARCH_PACKAGE.md` with resume, interview and role-specific project materials.
- Added `a-stock-memory/SCREENSHOT_CHECKLIST.md` for truthful, privacy-safe product screenshots.

### Validation and boundaries

- The verified SH600519 no-Key sample returned HTTP 200 in approximately 1.502 seconds with `rule/success/disabled/model=null`, eight sections and the fixed disclaimer.
- SH600519 previously demonstrated fresh cached quote, kline and detail data, ten non-mock news items and two major-event clues. Data availability remains dependent on the cache window and free upstream services.
- Financial indicators may return empty upstream records and money-flow requests may fail; both remain explicit limitations.
- LLM remains disabled on Render. No real credential, provider configuration, new upstream source or investment recommendation was added.
- Feature development is frozen; formal announcements, valuation, industry factors, multi-period financial trends, user accounts, report history and AI Q&A remain Roadmap items.


## Unreleased - 2026-07-16 - LLM Timeout Budget Alignment

### Fixed

- Capped the effective backend LLM request budget at 48 seconds so a slow LLM call cannot outlast the frontend's approximately 60-second report timeout.
- Added one shared deadline across retry attempts, preventing retries from accumulating multiple full LLM timeout windows.
- Added explicit connect and remaining read/write phase budgets for the OpenAI-compatible HTTP client.
- Converted exhausted LLM time budgets into a non-sensitive `LLM timeout after 48 seconds` rule fallback with the configured provider/model and the complete rule report.

### Validation

- Backend compile and the current seven-test unit suite passed.
- Covered disabled LLM, in-budget LLM success, deadline exhaustion, timeout fallback, configured-model retention, eight sections and the fixed disclaimer.
- Confirmed the existing frontend remains at its approximately 60-second request budget and renders a backend `rule_fallback` response instead of invoking local fallback when the response arrives in time.
- No real credentials, API headers, request bodies or LLM source text were added to code, logs or documentation.

### Pending deployment verification

- The implementation has not yet been pushed or deployed at the time of this changelog update.
- One post-deployment online request will verify either in-budget `llm/success` or backend-controlled timeout fallback; Render LLM configuration is unchanged by this change.


### Deployment note - 2026-07-16

- Pushed `5f121f2` and `74ed831` to `main`; the public health endpoint returned HTTP 200 after the deployment wait.
- The single online SH600519 request returned a controlled `CORE_QUOTE_MOCK` fallback in 17.929 seconds with the complete report structure and no response secret marker.
- Because the core-data gate returned before LLM invocation, this request did not independently exercise the new LLM timeout branch.

## Unreleased - 2026-07-16 - Rule and AI Generation Modes

### Added

- Added optional backward-compatible `generationMode: rule | ai` report requests, defaulting to rule mode.
- Added an explicit manual AI enhancement action after a successful rule report, with elapsed time, cost notice, request de-duplication, and a 120-second browser wait budget.
- Added an AI-mode total backend budget of at most 110 seconds, with the LLM limited to the remaining time and no automatic retries.

### Changed

- Rule mode no longer initializes or invokes the LLM client; it returns `rule/success/not_requested/model=null` with `GENERATION_MODE_RULE`.
- AI disabled and core-data quality-gate outcomes return controlled rule fallbacks without unnecessary model calls.
- AI errors, timeouts, and compliance fallbacks preserve the previously displayed rule report rather than replacing it with a local pseudo-AI result.

### Validation

- Backend compile and 11 unit tests passed.
- Frontend typecheck and production build passed; the existing Charts/ECharts chunk-size warning remains.
- Local desktop and 390px browser checks passed for the rule-first flow and disabled-AI fallback preservation.
- No credential, provider configuration, deployment setting, or new upstream request was added.

### Commits

- `066026f` - `feat: add manual AI report generation mode`
- `68c2456` - `feat: add manual AI report enhancement flow`

The feature commits were pushed to `main`. Render OpenAPI and the Netlify bundle were verified after deployment. One online rule-mode SH600519 request returned in 2.004 seconds with `rule/success/not_requested/model=null`, eight sections, the extension modules, and the disclaimer. The AI-mode request was intentionally skipped because preflight core quote and kline were both `mock/fallback`; it would not have reached the LLM.

## Unreleased - 2026-07-16 - LLM Incremental Enhancement Optimization

### Changed

- Replaced full eight-section LLM rewrites with a bounded incremental supplement merged into the complete rule report.
- Reduced the inspected SH600519 fact package from 11,041 to 2,661 characters and the user prompt from 12,897 to 3,631 characters.
- Limited model input to normalized display facts: no raw kline series, at most three news clues, at most three major-event clues, and at most three risk or watch items per list.
- Added `max_tokens=700`, capped by configuration at 900, and constrained model output to one executive summary plus up to three items in each remaining output group.

### Added

- Added compact LLM fact construction and strict validation for the incremental output schema.
- Added aggregate response token-usage parsing without exposing it through the public API or logging request/response bodies.

### Validation

- Backend compile and 14 unit tests passed, including default rule mode, compact facts, bounded output, AI success merge, compliance fallback, timeout behavior, and token usage parsing.
- Frontend typecheck and production build passed; the existing Charts/ECharts chunk-size warning remains.
- No provider, quality gate, deployment configuration, credential, or frontend request-flow change was made.
- The commits were pushed to `main`. Render health returned HTTP 200 after the deployment wait.
- The conditional online AI request was not sent: SH600519 quote was `mock/fallback` while kline was `akshare/live`, so the core-data gate correctly prevented a model call.
- Functional development is frozen; the Netlify frontend was unchanged by this backend-only optimization.

### Commit

- `bff2490` - `perf: compact AI report enhancement payload`

## Unreleased - 2026-07-16 - LLM Empty Content Handling

### Fixed

- Explicitly disabled thinking for the bounded research-report LLM request while retaining JSON-object output and the existing output-token limit.
- Converted empty, truncated, filtered, resource-interrupted, and invalid JSON model outcomes into distinct non-sensitive fallback codes.
- Added response metadata diagnostics for finish reason, content/reasoning lengths, response model, and token usage without logging reasoning text, prompts, response bodies, credentials, or headers.

### Validation

- Backend compile and 21 unit tests passed.
- Covered thinking request parameters, normal JSON, null/blank content, reasoning-only output, finish-reason mappings, invalid JSON, complete rule fallback preservation, and default rule-mode no-call behavior.
- Existing data-quality gates, compliance rules, eight sections, extension modules, disclaimer, model configuration, and no-retry behavior remain unchanged.

### Commit

- `3891ad0` - `fix: handle empty LLM response content`

The commits were pushed to `main`. The single permitted SH600519 AI-mode request returned HTTP 200 in 11.061 seconds but was blocked before the LLM by `CORE_QUOTE_MOCK at core.quote`, returning a complete `rule_fallback` report with `provider=not_requested` and `model=null`. No second request was sent. The empty-content fix remains covered by deterministic local tests; this online result did not reach the LLM.
