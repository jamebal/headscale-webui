# headscale-webui

一个与 Tailscale 兼容的编排服务器 Web 前端，用于 [headscale](https://github.com/juanfont/headscale)

支持的 Headscale 系列：Headscale `v0.29.x`。

请根据升级策略选择镜像标签：

- `0.0.8-hs0.29` 是不可移动的组合标签，固定 WebUI 版本与 Headscale 兼容系列。
- `0.0.8` 是该 WebUI Release 的不可移动项目版本标签。
- `hs0.29` 是可移动别名，跟随仍兼容 Headscale `v0.29.x` 的最新 WebUI 版本。
- `latest` 指向最新 WebUI 版本；`latest` 不保证兼容旧版 Headscale。

如需可复现部署，请固定使用 `0.0.8-hs0.29`；如需获取同一 Headscale 系列的兼容修复，请使用 `hs0.29`。升级 Headscale 前，请先确认所选镜像标签支持目标系列。

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

### 登录连接配置

登录时可填写 Headscale 的 `dns.base_domain`。配置后，节点 IP 地址列的复制菜单会增加 `givenName.base_domain` 完整域名。

`Server URL` 和 `Base Domain` 会保存在浏览器 `localStorage`。Headscale API Key 只保存在当前 tab 的 `sessionStorage`：刷新页面后仍有效，关闭 tab 后需要重新输入。请仅通过可信的 HTTPS 地址访问 WebUI。

### 部署到 Netlify

Netlify 非常棒，因此如果你需要一个地方来托管你自己版本的这个项目，我强烈推荐它。

[![部署到 Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/jamebal/headscale-webui)

### Docker Compose

```yaml
services:
  headscale-webui:
    image: jmal/headscale-webui:hs0.29
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
