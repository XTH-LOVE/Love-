# Love 小家

Love 小家是一个面向情侣的私密空间 Web 应用，同时支持 Capacitor Android 打包。它包含共同回忆、相册、时光轴、悄悄话、纪念日、AI 记录和宠物互动等功能。

## 本地开发

```bash
npm install
cp .env.example .env
npm run dev
```

Windows PowerShell 可使用：

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

## 环境变量

请在 `.env` 中填写 Supabase、地图和可选通话配置。`.env` 已被 Git 忽略，禁止提交真实密钥；请参考 `.env.example`。

生产环境中的 ZEGO ServerSecret 必须只配置在 Supabase Edge Function Secrets 中，不能放进前端环境变量。

## 常用命令

```bash
npm run dev       # 启动开发服务器
npm run generate  # 生成静态网页
npm run build     # 生产构建
npx tsc --noEmit  # TypeScript 检查
npx cap sync android
```

## 项目目录

- `app/`：Nuxt 页面、组件和业务逻辑
- `public/`：图标、图片和静态资源
- `supabase/`：数据库迁移与 Edge Functions
- `android/`：Capacitor Android 工程
- `desktop/`：桌面端壳工程
- `infra/`：可选的通话基础设施配置

## 安全说明

- 不要提交 `.env`、Supabase service role key、ZEGO ServerSecret 或其他访问令牌。
- 公开仓库只包含示例配置和前端公开变量。
- 私密媒体应使用 Supabase Storage 签名地址，并由情侣空间 RLS 控制访问。

