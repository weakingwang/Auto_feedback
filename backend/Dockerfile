FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm config set registry https://registry.npmmirror.com

RUN npm ci --omit=dev

COPY . .

RUN mkdir -p uploads

EXPOSE 3000

CMD ["npm", "start"]
