# AI投研助手 V2 - 项目状态

更新时间：2026-07-12

## 1. 当前阶段

当前处于：**LLM 增强研究报告——P0 性能与线程回收优化已完成，等待推送与线上部署决策阶段**。

本地 DeepSeek 成功路径、规则版 fallback 和合规降级路径均已验证。后端合规补丁已经提交，但尚未 push，也尚未在 Render 配置真实 LLM Key。

研究报告 P0 性能优化已完成并提交。此前线上无 Key 请求约 69 秒，前端在 60 秒超时后会触发本地 fallback；当前规则版路径已通过最小必要事实聚合消除该阻塞。

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

1. 单独提交本次 `PROJECT_STATUS.md` 和 `CHANGELOG.md` 更新。
2. 决定是否将 `a782db4` 与文档 commit push 到 `main`。
3. Push 后验证 Render 是否部署到最新 commit，并在未配置真实 Key 时确认线上 fallback 仍正常。
4. 在本地验证全部通过的前提下，再决定是否在 Render 后端配置 DeepSeek Key；线上 Key 只能放入 Render 后端环境变量，禁止进入前端、Git、文档和日志。
5. P1 非阻断待办：finance、moneyFlow、news 字段缺失专项测试；stale/mock 组合测试；quote/kline 底层 HTTP timeout 完整治理。

## 9. 当前产品边界

- 本项目只做信息整理和研究辅助。
- 不做自动荐股或股票预测。
- 不提供交易建议、仓位建议、目标价或收益承诺。
- 所有报告必须包含免责声明：“以上内容由系统根据公开行情数据和规则生成，仅用于信息整理和研究辅助，不构成投资建议。”
- API Key 只能存在于后端环境变量，禁止进入前端、Git、文档和日志。
- 数据缺失、缓存、降级或 mock 状态必须明确标注，不得伪装为实时真实数据。
