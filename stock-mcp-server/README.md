# Stock MCP Server

第一版股票 MCP server，负责把 Finnhub 的行情和新闻接口包装成 Codex 可调用工具。

当前工具：

- `get_quote(symbol)`：查询最新报价。
- `get_company_news(symbol, from, to)`：查询公司新闻。
- `get_market_news(category)`：查询市场新闻。

定位边界：

- 只做数据读取和辅助理解。
- 不构成投资建议。
- 不支持真实交易下单。
- 不要把 Finnhub API Key 提交到 Git。

## 准备

申请 Finnhub API Key：

https://finnhub.io/register

可以复制 `.env.example` 为 `.env`，然后填入 Finnhub API Key：

```env
FINNHUB_API_KEY=your_finnhub_api_key_here
```

也可以直接设置进程环境变量：

```powershell
$env:FINNHUB_API_KEY="your_finnhub_api_key_here"
```

## 安装和构建

```powershell
pnpm install
pnpm build
```

## 本地运行

```powershell
pnpm start
```

MCP server 使用 stdio 通信，所以直接运行时通常不会输出普通 Web 服务地址。服务会优先读取进程环境变量；如果没有设置，也会自动读取项目根目录的 `.env`。

在 Windows/Codex 环境里，如果 Node 内置 `fetch` 到 Finnhub 出现连接重置，服务会自动退到 PowerShell `Invoke-WebRequest`。

## Codex MCP 配置示例

把下面配置里的路径改成你的实际 `build/index.js` 绝对路径：

```toml
[mcp_servers.stock_assistant]
command = "node"
args = ["C:/Users/梁嘉辰/Documents/炒股行情辅助分析/stock-mcp-server/build/index.js"]

[mcp_servers.stock_assistant.env]
FINNHUB_API_KEY = "your_finnhub_api_key_here"
```

如果已经在项目根目录保存了 `.env`，也可以不在 MCP 配置里写 `FINNHUB_API_KEY`。如果 Codex 环境里 `node` 不在 PATH，可以把 `command` 改成实际 Node 可执行文件路径。
