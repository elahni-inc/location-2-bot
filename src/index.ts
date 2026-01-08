import { App } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { config, validateConfig } from './config';
import { ClaudeHandler } from './claude-handler';
import { SlackHandler } from './slack-handler';
import { McpManager } from './mcp-manager';
import { Logger } from './logger';
import { ScheduledSearch } from './scheduled-search';

const logger = new Logger('Main');

async function start() {
  try {
    // Validate configuration
    validateConfig();

    logger.info('Starting Claude Code Slack bot', {
      debug: config.debug,
      useBedrock: config.claude.useBedrock,
      useVertex: config.claude.useVertex,
    });

    // Initialize Slack app
    const app = new App({
      token: config.slack.botToken,
      signingSecret: config.slack.signingSecret,
      socketMode: true,
      appToken: config.slack.appToken,
    });

    // Initialize MCP manager
    const mcpManager = new McpManager();
    const mcpConfig = mcpManager.loadConfiguration();
    
    // Initialize handlers
    const claudeHandler = new ClaudeHandler(mcpManager);
    const slackHandler = new SlackHandler(app, claudeHandler, mcpManager);

    // Setup event handlers
    slackHandler.setupEventHandlers();

    // Start the app
    await app.start();
    logger.info('⚡️ Claude Code Slack bot is running!');
    logger.info('Configuration:', {
      usingBedrock: config.claude.useBedrock,
      usingVertex: config.claude.useVertex,
      usingAnthropicAPI: !config.claude.useBedrock && !config.claude.useVertex,
      debugMode: config.debug,
      baseDirectory: config.baseDirectory || 'not set',
      mcpServers: mcpConfig ? Object.keys(mcpConfig.mcpServers).length : 0,
      mcpServerNames: mcpConfig ? Object.keys(mcpConfig.mcpServers) : [],
    });

    // Start scheduled search if configured
    const searchChannelId = process.env.SEARCH_CHANNEL_ID;
    const searchIntervalHours = parseInt(process.env.SEARCH_INTERVAL_HOURS || '6', 10);

    if (searchChannelId && searchChannelId !== 'your-channel-id') {
      const slackClient = new WebClient(config.slack.botToken);
      const scheduledSearch = new ScheduledSearch({
        slackClient,
        channelId: searchChannelId,
        searchIntervalHours,
      });

      scheduledSearch.start();
      logger.info('📅 Scheduled search enabled', {
        channelId: searchChannelId,
        intervalHours: searchIntervalHours,
      });
    } else {
      logger.info('📅 Scheduled search disabled (no SEARCH_CHANNEL_ID configured)');
    }
  } catch (error) {
    logger.error('Failed to start the bot', error);
    process.exit(1);
  }
}

start();