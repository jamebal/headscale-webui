# headscale-webui

一个与 Tailscale 兼容的编排服务器 Web 前端，用于 [headscale](https://github.com/juanfont/headscale)

支持的 Headscale 系列：Headscale `v0.25.x`。

请根据升级策略选择镜像标签：

- `0.0.6-hs0.25` 是不可移动的组合标签，固定 WebUI 版本与 Headscale 兼容系列。
- `0.0.6` 是该 WebUI Release 的不可移动项目版本标签。
- `hs0.25` 是可移动别名，跟随仍兼容 Headscale `v0.25.x` 的最新 WebUI 版本。
- `latest` 指向最新 WebUI 版本；`latest` 不保证兼容旧版 Headscale。

如需可复现部署，请固定使用 `0.0.6-hs0.25`；如需获取同一 Headscale 系列的兼容修复，请使用 `hs0.25`。升级 Headscale 前，请先确认所选镜像标签支持目标系列。

### 部份截图:
![node.png](doc/node.png)
![user.png](doc/user.png)
![route.png](doc/route.png)
![apiKeys.png](doc/apiKeys.png)
![policy.png](doc/policy.png)
![deploy.png](doc/deploy.png)

## 安装

### 环境变量

| Variable | Description                  | Example           |
|----|------------------------------|-------------------|
| VITE_APP_NAME | 项目名称                | `Headscale WebUI` |
| VITE_DEFAULT_LANG | 默认语言, `enUS` or `zh_CN` | `zh_CN`           |

### 部署到 Netlify

Netlify 非常棒，因此如果你需要一个地方来托管你自己版本的这个项目，我强烈推荐它。

[![部署到 Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/jamebal/headscale-webui)

### Docker Compose

```yaml
services:
  headscale-webui:
    image: jmal/headscale-webui:hs0.25
    restart: unless-stopped
    ports:
      - 4567:80
```

### Dev

```shell
git clone https://github.com/jamebal/headscale-webui
cd headscale-webui
```

```shell
npm install
```
```
npm run dev
```
