FROM node:22-slim

WORKDIR /app

# 复制 package.json 并安装依赖
COPY package.json ./
RUN npm install --production

# 复制项目文件
COPY . .

# 创建数据和上传目录
RUN mkdir -p data uploads

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV PORT=3000
ENV NODE_ENV=production

# 启动
CMD ["node", "server/index.js"]
