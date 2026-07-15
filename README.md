# AI投研助手

> 面向 A 股公开信息的研究辅助应用。系统整理已有行情、K 线、新闻与结构化研究事实，并明确展示数据状态、缺失项和复核边界；不提供投资建议。

## 在线演示

- 前端：[AI投研助手](https://a-stock-watch-assistant.netlify.app/)
- 后端健康检查：[API health](https://a-stock-watch-api.onrender.com/api/health)
- 主演示股票：`SH600519`（贵州茅台）。数据源会随缓存和上游可用性变化，演示时以页面显示的数据状态与时间为准。

## 解决的问题

常见行情软件已经提供价格、涨跌幅和成交量。用户访谈反馈的困难在于：重大事件、业绩数据限制、风险线索和数据可靠性分散且难以快速核验。本项目将这些公开事实组织为一份结构化研究材料，并把“数据是否可用”作为报告内容的一部分。

访谈驱动的优先级是：重大事件线索、业绩变化概览、风险与后续观察。基础行情是输入，不是产品的唯一差异化。

## 核心功能

- 个股行情、K 线与个股详情展示。
- 8 个固定章节的研究报告，始终包含免责声明。
- 重大事件线索：仅整理可追溯的公开线索，不是正式公告中心。
- 业绩变化概览：展示最新一期可用财务快照及营收/净利润同步或分化关系，不是完整经营原因归因。
- 风险与后续观察：展示服务端已有事实、数据限制和复核事项，不生成交易动作。
- 核心数据质量门禁：quote 和 K 线为核心数据；mock、fallback、严重 stale 或明显不一致时透明降级。
- 无 Key 时稳定返回规则整理稿；LLM 失败、超时、解析或合规失败也会回退到规则版报告。

## 技术栈

- 前端：React、TypeScript、Vite、ECharts、Lucide。
- 后端：FastAPI、Pydantic、Python。
- 数据链路：现有 AkShare / 东方财富 / Sina 免费链路、SQLite 缓存与透明兜底状态。
- 部署：Netlify 前端、Render 后端。

## 系统架构

```text
Browser (React) -> /api/research/reports -> FastAPI research service
                                         -> core quote + kline quality gate
                                         -> cached optional detail/news/finance/fund-flow
                                         -> rule report / optional LLM candidate
                                         -> compliance + fixed disclaimer
```

## 报告生成流程

1. 解析股票代码并读取核心 quote、K 线。
2. 对核心数据执行来源、fresh/stale/mock/fallback、时间和价格一致性检查。
3. 读取可选增强数据；缺失时继续生成并标注限制，不阻塞核心报告。
4. 规则层生成 8 个章节、重大事件线索、业绩变化概览和风险观察。
5. 若 LLM 被私有后端环境启用，只能在服务端事实包范围内重写内容；最终仍经合规检查。
6. 任一 LLM 或合规失败都返回 HTTP 200 的安全规则版 fallback。

## 数据质量门禁

- 核心数据：独立 quote 和 K 线。
- 可选增强数据：detail、overview、finance、moneyFlow、news。
- 核心数据为 mock、fallback、严重 stale、缺失或收盘后明显不一致时，不展示为正常 AI 增强报告。
- `fresh` 表示当前缓存中的可用数据；`stale` / `stale_refreshing` 明确显示为“缓存数据待更新”。
- `mock` 仅用于界面兜底；`fallback` 是降级数据，不能作为确认结论。

## 规则版、LLM 与 fallback

Render 当前保持 `AI_REPORT_ENABLE_LLM=false`。无 Key 路径返回：`source=rule`、`status=success`、`provider=disabled`、`model=null`。

若未来仅在私有后端环境启用 LLM：

- LLM 不可新增事件、财务原因、风险、交易建议或价格方向。
- HARD_BLOCK 阻断买卖动作、仓位、目标价、收益承诺和确定性预测。
- 模型调用、解析或合规失败时返回 `rule_fallback`，不暴露原文、请求头或密钥。

## 本地启动

后端：

```powershell
cd stock-api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run_api_server.py
```

前端：

```powershell
cd stock-web
pnpm install
pnpm dev
```

示例环境变量，仅在私有后端环境设置，绝不写入 Git、前端或日志：

```env
AI_REPORT_ENABLE_LLM=false
STOCK_API_PROVIDER=akshare
# LLM_API_KEY=<private backend environment only; do not commit>
```

## 演示说明与缓存

`SH600519` 是近期验证过的主演示路径：曾返回 AkShare fresh 缓存的 quote、K 线与 detail，10 条非 mock 新闻、2 条重大事件线索；无 Key 报告样本为 HTTP 200、约 1.5 秒、8 个章节和免责声明完整。该结论受缓存窗口及上游可用性影响，现场必须以响应时间、来源与状态为准。

`SZ000001` 或 `SZ300750` 可用于展示上游超时、mock/fallback、核心数据门禁和安全空状态；它们不是实时数据稳定性的承诺。

## 已知限制

- 重大事件模块是线索整理，不是交易所或公司公告中心。
- 业绩变化概览只基于最新一期财务快照；不支持环比、多期趋势、扣非净利润、现金流、费用率或一次性损益归因。
- 当前财务指标上游可能返回空记录，资金流上游可能连接中断；页面会显示限制，不会伪造可用数据。
- 免费数据源可能超时或字段变化。缓存数据必须结合状态与更新时间判断。
- 浏览器端不直连数据提供商或 LLM Provider。

## Roadmap

功能开发在当前版本冻结。后续需单独评审后再启动：估值解释、行业外部因素、正式公告中心、多期财务趋势、新数据源、用户系统、报告历史、AI 问答。不会扩展自动荐股、买卖点、目标价、仓位或收益预测。

## 免责声明

以上内容由系统根据公开行情数据和规则生成，仅用于信息整理和研究辅助，不构成投资建议。
