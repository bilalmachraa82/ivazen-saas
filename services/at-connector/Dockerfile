FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json ./
COPY src ./src

ENV NODE_ENV=production
EXPOSE 8787

CMD ["node", "src/index.js"]
