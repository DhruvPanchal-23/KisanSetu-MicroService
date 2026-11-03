FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY shared ./shared
COPY scripts ./scripts
COPY auth-service ./auth-service
COPY farm-service ./farm-service
COPY gateway ./gateway
COPY weather-service ./weather-service
RUN mkdir /app/storage && chown node:node /app/storage
USER node
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"
CMD ["node", "gateway/main.js"]