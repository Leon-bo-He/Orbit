# Pinned to a specific Playwright base so Chromium / fonts / shared libs match the
# `playwright` npm version. Bump both together.
FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN corepack enable && corepack prepare pnpm@9 --activate \
    && pnpm install --prod=false

COPY tsconfig.json ./
COPY src ./src

RUN pnpm build

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["pnpm", "start"]
