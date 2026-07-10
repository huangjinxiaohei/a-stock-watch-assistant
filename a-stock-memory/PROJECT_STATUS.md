# AI投研助手 V2 - 项目状态

更新时间：2026-07-10

## 1. 当前阶段

当前处于：**LLM 增强研究报告——本地真实 LLM 联调与合规适配阶段**。

当前工作重点是完善本地 LLM 研究报告的合规边界和输入事实包表达。在本地真实 LLM 三只股票复测通过前，不配置 Render 真实 LLM Key，也不建议提交当前合规适配补丁。

## 2. 已完成事项

### 部署与前后端闭环

- AI投研助手 V2 前端已部署到 Netlify 并上线。
- Netlify 已连接 GitHub `main` 自动部署，不再使用旧的 `api upload` 部署模式。
- Render 后端已部署 `POST /api/research/reports`。
- 已修复前端报告接口重复拼接 `/api` 的问题，真实请求路径为 `/api/research/reports`。
- 线上无 Key fallback 已验收通过：
  - HTTP 200
  - `reportStatus.source=rule`
  - `reportStatus.provider=disabled`
  - 报告包含固定免责声明

### 本地真实 LLM 联调

- DeepSeek API 本地调用链路已调通：
  - `provider=openai_compatible`
  - `model=deepseek-v4-pro`
  - 模型请求发送和响应接收正常
- 首次真实 LLM 测试结果：
  - `reportStatus.source=rule_fallback`
  - `reportStatus.status=fallback`
  - 原因：模型输出命中后端 compliance 规则
- 上述结果证明 LLM 调用链路可用，但尚未通过 LLM 成功路径验收。

### 第一轮合规适配

- 已收紧研究报告 Prompt，将生成目标限定为信息整理和研究辅助。
- Compliance 已增加稳定的规则 ID、类别和字段路径诊断。
- `service.py` 已完成第一轮事实包中性化：
  - K线摘要改为历史数值、均线位置和成交量/均量比等事实描述
  - 新闻、warnings、财务/资金流 warning 和 dataStatus warning 进入 LLM 前进行中性化
  - 不记录或返回完整 LLM 原文
- 已通过以下验证：
  - Python `compileall`
  - 无 Key fallback
  - 七类硬规则拦截测试
  - 免责声明检查
  - 三个修改文件的 BOM 检查
  - 敏感信息扫描
- 本轮未修改 API 契约、前端、部署配置或数据源 provider。

## 3. 当前架构

- 前端：React + TypeScript + Vite，部署于 Netlify。
- 后端：FastAPI + Python，部署于 Render。
- 行情数据：东方财富、AkShare、Sina 等免费数据链路，SQLite 用作本地缓存。
- 研究报告：前端调用后端 `/api/research/reports`，后端负责事实聚合、LLM 调用、schema 校验、合规扫描和规则版 fallback。
- LLM Key 只能由后端环境变量读取，前端不直连 LLM Provider。

## 4. 当前工作区状态

当前有三个未提交的后端文件：

- `stock-api/app/research/prompts.py`
- `stock-api/app/research/compliance.py`
- `stock-api/app/research/service.py`

状态说明：

- 尚未 commit。
- 尚未 push。
- 尚未配置 Render 真实 LLM Key。
- 当前合规适配补丁只存在于本地工作区。
- 当前 Git 已提交历史中，后端报告 API、前端报告 API 接入和 V2 首页已分别存档；本轮三文件补丁不在任何已提交 commit 中。

## 5. 当前待处理事项

### 软倾向表达治理

- 重新设计软倾向表达分级治理。
- 不全面删除“反弹、承压、修复”等词。
- 允许有明确周期和数据依据的历史状态描述。
- 禁止未来价格预测、投资建议、交易动作、目标价、仓位建议和收益承诺。
- 当前软倾向表达分级方案仍是待执行方案，尚未实现。
- 分级治理完成后，需要重新交由技术架构、投研提示词和测试质检三方只读审查。

### 真实 LLM 复测

后续由用户本人在本地安全注入 Key，复测：

- `SH600519`
- `SZ000001`
- `SZ300750`

验收重点：

- HTTP 200。
- `reportStatus.source=llm`、`status=success`。
- Provider 和 model 正确。
- 报告章节完整并包含免责声明。
- 不输出未来价格预测、投资建议、交易动作、目标价、仓位建议或收益承诺。
- LLM 失败或违规时仍能返回规则版 fallback。

三只股票真实 LLM 测试通过前，不建议 commit 当前补丁，也不配置 Render 真实 Key。

## 6. 当前产品边界

- 本项目只做信息整理和研究辅助。
- 不做自动荐股。
- 不做股票预测。
- 不提供买入、卖出、仓位、目标价或收益承诺。
- 所有报告必须包含免责声明：
  - “以上内容由系统根据公开行情数据和规则生成，仅用于信息整理和研究辅助，不构成投资建议。”
- API Key 只能存在于后端环境变量，禁止进入前端、Git、文档和日志。
- 数据缺失、缓存、降级或 mock 状态必须明确标注，不得伪装为实时真实数据。
