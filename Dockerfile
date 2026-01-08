FROM node:20-slim

WORKDIR /app

# Install Claude Code CLI globally (required for @anthropic-ai/claude-code SDK)
RUN npm install -g @anthropic-ai/claude-code

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source and build
COPY . .
RUN npm run build

# Run the bot
CMD ["node", "dist/index.js"]
