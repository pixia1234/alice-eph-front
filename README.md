Tests

  - npm run build

使用方式

  - 开发时运行 npm run dev，前端会把请求发送到 http://localhost:5173/api/...，由 Vite 代理再转发到 Alice API，不会触发 CORS。
  - 若部署到自己的域名，可在部署侧配置同样的反向代理，或在 .env 中设置 VITE_API_BASE_URL=https://app.alice.ws/cli/v1 等同源地址，确保生产环境也通过受控源发起请求。

技术栈

  - React 18.3 + TypeScript
  - Vite 7.1 (开发/构建工具)
  - Node.js 24.x + npm 11.x (本地环境)

功能概览

  - 本地持久化保存 Alice API client_id 和 secret
  - 统一选择并发起 Alice EVO 相关的主要接口
  - 展示返回结果、耗时及响应头信息，支持错误反馈
  - Vite 代理转发 /api/* 请求，绕过浏览器 CORS 限制
