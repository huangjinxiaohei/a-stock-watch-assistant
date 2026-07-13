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
