\# 技术架构文档





\## 整体架构





用户



↓



Frontend



↓



Backend



↓



AI Agent Layer



↓



Data Layer







\---



\# 前端





负责：



\- 页面展示

\- 用户交互

\- 报告展示





技术：



根据当前项目保持。





\---



\# 后端





负责：



\- API接口

\- 用户请求处理

\- Agent流程管理





\---



\# AI Agent架构





\## Research Manager Agent





负责：



理解用户任务。



决定调用哪些Agent。





\---



\## Market Agent





负责：



行情数据。





\---



\## News Agent





负责：



新闻信息整理。





\---



\## Analysis Agent





负责：



综合分析。





\---



\## Report Agent





负责：



生成最终报告。





\---



\# 数据层





包括：



\- 股票数据接口

\- 新闻数据

\- 用户历史记录





\---



\# 数据库





保存：



用户信息



报告记录



自选股票





