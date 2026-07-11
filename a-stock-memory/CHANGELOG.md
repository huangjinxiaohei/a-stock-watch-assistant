# 更新日志

## Unreleased - 2026-07-11

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
