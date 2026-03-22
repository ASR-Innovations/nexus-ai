FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev) for building
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ---- Production image ----
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built output from builder
COPY --from=builder /app/dist ./dist

# Bind to all interfaces (required for Railway/Docker)
ENV HOST=0.0.0.0

# Expose port (Railway overrides with its own PORT env var)
EXPOSE 3000

# Start the application
CMD ["node", "dist/main"]
