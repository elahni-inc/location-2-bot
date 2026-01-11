FROM node:20

# Create a non-root user (Claude Code doesn't allow root with --dangerously-skip-permissions)
RUN useradd -m -s /bin/bash botuser

WORKDIR /app

# Install latest Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code@latest

# Verify Claude Code is installed and show version
RUN claude --version

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
