FROM python:3.12-slim AS builder
WORKDIR /build
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY scripts ./scripts
COPY config ./config
COPY src ./src
COPY ref/production ./ref/production
RUN python scripts/build.py

FROM node:24-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8085
WORKDIR /app
COPY --from=builder --chown=node:node /build/dist ./dist
COPY --chown=node:node server.mjs ./
RUN mkdir -p /data/enquiries && chown node:node /data/enquiries && chmod 700 /data/enquiries
USER node
EXPOSE 8085
CMD ["node", "server.mjs"]
