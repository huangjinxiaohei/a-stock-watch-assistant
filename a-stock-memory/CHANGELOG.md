# 更新日志

## Unreleased - 2026-07-10

### 部署与集成

- Netlify 前端改为从 GitHub `main` 自动构建和部署，不再使用旧的 `api upload` 模式。
- AI投研助手 V2 前端已成功上线。
- Render 后端 `POST /api/research/reports` 已成功上线。
- 修复前端报告接口重复拼接 `/api` 的问题，避免请求 `/api/api/research/reports`。

### 验证

- 线上无 Key 规则版 fallback 验收通过：HTTP 200、`source=rule`、`provider=disabled`，免责声明存在。
- DeepSeek 本地 API 调用链路已验证：`provider=openai_compatible`、`model=deepseek-v4-pro`，请求和响应接收正常。
- 首次真实 LLM 测试因模型输出命中 compliance 规则返回 `rule_fallback`，尚未通过 LLM 成功路径验收。

### 本地未提交改动

- `prompts.py` 新增信息整理型报告约束、章节约束和中性表达要求。
- `compliance.py` 新增规则 ID、类别和字段路径诊断，保留硬规则 fallback。
- `service.py` 增加第一轮事实包中性化。
- 上述三个后端文件当前仍未提交、未 push，只存在于本地工作区。
- 本轮未修改 API 契约、前端、部署配置或数据源 provider。

### 待完成

- 软倾向表达分级治理仍待设计和实现，不能视为已完成。
- 完成分级治理后需重新进行技术架构、投研提示词和测试质检三方只读审查。
- `SH600519`、`SZ000001`、`SZ300750` 的真实 LLM 成功路径复测仍待完成。
- Render 尚未配置真实 LLM Key。

## V2.0.0 - 2026-07-08

### 已完成

- 首页升级为“AI投研助手”入口。
- 新增股票输入和结构化研究报告生成流程。
- 新增规则版研究报告、数据状态和免责声明展示。
- 后端新增 LLM 研究报告 API、schema 校验、合规检查和规则版 fallback。
- 前端接入后端研究报告 API，并保留前端规则版二级 fallback。

### 未纳入本版本

- AI 问答。
- 报告历史。
- 用户系统。
- 自动荐股和股票预测。

## V1.0.0

- 完成 A 股股票查询、市场行情展示、自选股、市场排行和个股详情等基础能力。
