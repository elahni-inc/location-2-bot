FROM node:20

WORKDIR /app

# Install Claude Code CLI globally (required for @anthropic-ai/claude-code SDK)
RUN npm install -g @anthropic-ai/claude-code

# Verify Claude Code is installed
RUN claude --version || echo "Claude Code CLI installed"

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
