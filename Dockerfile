# 使用官方的 Node.js 镜像作为基础镜像
FROM node:20-alpine as build-stage

# 设置工作目录
WORKDIR /app

# 复制项目的 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制项目的所有文件到容器中
COPY . .

# 运行构建命令
RUN npm run build

# 使用 Nginx 作为基础镜像来提供构建后的静态文件
FROM nginx:stable-alpine as production-stage

# 将构建好的文件复制到 Nginx 的静态资源目录
COPY --from=build-stage /app/dist /usr/share/nginx/html

# 复制自定义的 Nginx 配置文件（如果有）
# COPY nginx.conf /etc/nginx/nginx.conf

# 暴露 Nginx 的默认端口
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]
