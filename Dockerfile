# 使用 Nginx 作为基础镜像来提供构建后的静态文件
FROM nginx:stable-alpine as production-stage

# 设置工作目录
WORKDIR /usr/share/nginx/html

# 复制 GitHub Actions 中构建好的静态文件到 Nginx 的静态资源目录
COPY dist /usr/share/nginx/html

# 暴露 Nginx 的默认端口
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]
