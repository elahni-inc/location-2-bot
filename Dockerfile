FROM node:20-slim

WORKDIR /app

# Install Claude Code CLI globally (required for @anthropic-ai/claude-code SDK)
RUN npm install -g @anthropic-ai/claude-code

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Remove devDependencies after build to slim down image
RUN npm prune --production

# Run the bot
CMD ["node", "dist/index.js"]
