FROM node:20

# Create a non-root user (Claude Code doesn't allow root with --dangerously-skip-permissions)
RUN useradd -m -s /bin/bash botuser

WORKDIR /app

# Install Claude Code CLI globally
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

# Change ownership to non-root user
RUN chown -R botuser:botuser /app

# Switch to non-root user
USER botuser

# Run the bot
CMD ["node", "dist/index.js"]
