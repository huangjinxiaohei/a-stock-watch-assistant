# A股行情辅助分析 Web

面向普通股民的一站式行情观察工具。前端支持 mock 数据源，也可以通过 `stock-api` 后端代理接入 AkShare、东方财富、百度估值等免费公开数据源。

## 功能

- 首页：大盘指数、市场温度、自选股、市场排行、板块强弱和异动提醒。
- 股票搜索：支持股票代码、名称、行业搜索。
- 个股详情：实时行情、分时图、K线图、均线、MACD/KDJ/RSI/BOLL、财务指标、资金流、新闻与公告线索。
- 自选股：浏览器 `localStorage` 保存，支持添加、删除、刷新。
- 分析总结：输出走势观察、关键区间、量价关系、风险提示和可关注/需回避条件。
- 风险提示：涨幅过大、成交异常、跌破均线、放量下跌、技术指标异常、主力资金流出或资金流待确认。

## 数据源配置

本地 mock：

```env
VITE_STOCK_DATA_PROVIDER=mock
VITE_REFRESH_INTERVAL_MS=60000
```

通过后端代理接真实数据：

```env
VITE_STOCK_DATA_PROVIDER=http
VITE_STOCK_API_BASE_URL=http://127.0.0.1:8787/api
VITE_REFRESH_INTERVAL_MS=60000
```

不要把任何真实密钥放到浏览器前端。当前 PE/PB、总市值、换手率补齐优先由 `stock-api` 使用免费公开源完成。

## 运行

推荐从项目根目录双击或运行一键启动脚本：

```powershell
.\启动行情系统.bat
```

该脚本会分别启动：

- 后端：`http://127.0.0.1:8787/`
- 前端：`http://127.0.0.1:5173/`

如果端口已经监听，脚本会按已运行服务复用，不会主动杀进程。PowerShell 入口 `start-dev.ps1` 仍保留，适合需要在同一个 PowerShell 会话里托管前后端任务时使用。

也可以分别启动：

```powershell
cd ..\stock-api
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8787
```

```powershell
cd ..\stock-web
.\run-web-dev.cmd
```

访问：`http://127.0.0.1:5173`

构建检查：

```powershell
pnpm typecheck
pnpm build
```

本工具只做辅助观察和风险提示，不构成投资建议，不保证任何收益。
