
# 🚀 Alice Eph Front

> 一个基于 **React + Vite** 的前端界面，用于与 **Alice API (EVO)** 进行交互。
> 支持快速测试 API、查看响应详情，并通过代理机制无痛解决跨域问题。

在线体验：
🔗 **[https://pixia1234.github.io/alice-eph-front](https://pixia1234.github.io/alice-eph-front/)**

---

## 📦 技术栈

* **React 19.1** + **TypeScript**
* **Vite 7.1** — 开发与构建工具
* **Node.js 24.x** + **npm 11.x** — 本地环境
* **GitHub Pages** — 自动化部署

---

## ⚙️ 功能概览

* 本地持久化保存 **Alice API client_id** 和 **secret**
* 支持调用主要的 **Alice EVO API 接口**
* 展示返回结果、响应头与耗时
* 错误提示与调试信息可视化
* Vite 内置 `/api/*` 请求代理，自动绕过开发阶段的浏览器 CORS 限制

---

## 🧩 使用方式

### 🧑‍💻 本地开发

1. 安装依赖

   ```bash
   npm install
   ```

2. 启动开发服务器

   ```bash
   npm run dev
   ```

   * 前端请求会发送到 `http://localhost:5173/api/...`
   * Vite 会代理请求至 **Alice API**，不会触发 CORS

3. 构建测试

   ```bash
   npm run build
   ```

---

## 🌐 生产部署与配置

### 方法一：部署在自己的服务器

若部署到自有域名，可：

* 在服务器反向代理层设置转发规则，或
* 在 `.env` 文件中配置：

  ```bash
  VITE_API_BASE_URL=https://app.alice.ws/cli/v1
  ```

  以确保生产环境同样通过受控源访问 API。

> 💡 可参考仓库内的 `worker.js.example` 配置 Cloudflare Worker 作为代理。

---

### 方法二：部署到 GitHub Pages

仓库默认包含 `.env.production`，生产构建时会：

* 指向 `https://app.alice.ws/cli/v1`
* 使用 `/alice-eph-front/` 作为静态资源前缀

#### 如需自定义代理

可在 `.env.production` 或 Pages 的 Secrets 中设置：

```bash
VITE_PROXY_URL=https://your-proxy.example.com
```

该代理需：

* 转发请求至 `https://app.alice.ws/cli/v1/*`
* 返回原始响应头与响应体
* 添加：

  ```
  Access-Control-Allow-Origin: *
  ```

#### 启用 Pages 自动部署

1. 在仓库 **Settings → Pages** 选择 **“GitHub Actions”** 作为构建来源
2. 推送到 `main` 分支，或手动触发 `workflow_dispatch`
3. GitHub Actions (`.github/workflows/deploy.yml`) 会自动构建并发布至 `gh-pages`

完成后访问：

```
https://<your-username>.github.io/alice-eph-front/
```

若使用自定义域名，请在 DNS 与 Pages 中绑定。

---

## 📚 参考资源

* **Alice 官方文档：** [https://api.aliceinit.io/](https://api.aliceinit.io/)
* **项目主页：** [https://pixia1234.github.io/alice-eph-front/](https://pixia1234.github.io/alice-eph-front/)
* **Vite 文档：** [https://vitejs.dev](https://vitejs.dev/)
* **React 官方文档：** [https://react.dev](https://react.dev/)

---

## 🧠 备注

* 若你计划部署自定义代理，可考虑使用 **Cloudflare Worker** 或 **Nginx 反向代理**
* 若要调试 API，可直接在界面内输入 client_id 和 secret，数据会保存在本地浏览器中（不会上传）

