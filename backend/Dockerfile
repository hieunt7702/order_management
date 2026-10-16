# Stage 1: Build NestJS backend
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL & libc6-compat for Prisma native engine on Alpine Linux
RUN apk add --no-cache openssl libc6-compat
RUN npm install -g pnpm@9

COPY .npmrc* ./
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma/
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src/

RUN pnpm install
RUN pnpm prisma:generate
RUN pnpm build
RUN pnpm prune --prod

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PATH="/app/node_modules/.bin:$PATH"

RUN apk add --no-cache openssl libc6-compat

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./
COPY scripts ./scripts

EXPOSE 3000

CMD ["sh", "-c", "node scripts/bootstrap.js && node dist/main"]
