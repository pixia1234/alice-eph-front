立即尝试

https://pixia1234.github.io/alice-eph-front/

Tests

  - npm run build

### 使用方式

  - 开发时运行 npm run dev，前端会把请求发送到 http://localhost:5173/api/...，由 Vite 代理再转发到 Alice API，不会触发 CORS。
  - 若部署到自己的域名，可在部署侧配置同样的反向代理，或在 .env 中设置 VITE_API_BASE_URL=https://app.alice.ws/cli/v1 等同源地址，确保生产环境也通过受控源发起请求。 可以参考worker.js.example 配置自己的cf worker

### GitHub Pages 部署

  - 仓库默认包含 .env.production，生产构建会指向 https://app.alice.ws/cli/v1 并使用 /alice-eph-front/ 作为静态资源前缀。
  - 若要在 GitHub Pages 使用跨域代理，请在部署前将 .env.production 或 Pages secrets 中的 VITE_PROXY_URL 指向你控制的反向代理（或者使用默认的代理）
  - 代理需代表前端向 https://app.alice.ws/cli/v1/* 发起请求，并把原始响应头/体原样返回，同时添加 Access-Control-Allow-Origin: *。
  - 启用 GitHub Pages：在仓库 Settings → Pages 选择 “GitHub Actions” 作为构建来源。
  - 推送到 main 分支或手动触发 workflow_dispatch，.github/workflows/deploy.yml 会自动构建 dist 并发布到 gh-pages 环境。
  - 首次部署完成后，访问 https://**.github.io/alice-eph-front/ 即可体验；若使用自定义域名，更新 DNS 后在 Pages 中绑定。
  - Alice 官方文档 https://api.aliceinit.io/

### 技术栈 

  - React 19.1 + TypeScript
  - Vite 7.1 (开发/构建工具)
  - Node.js 24.x + npm 11.x (本地环境)

### 功能概览

  - 本地持久化保存 Alice API client_id 和 secret
  - 统一选择并发起 Alice EVO 相关的主要接口
  - 展示返回结果、耗时及响应头信息，支持错误反馈
  - Vite 代理转发 /api/* 请求，绕过开发阶段的浏览器 CORS 限制
