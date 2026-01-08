import { query, type SDKMessage } from '@anthropic-ai/claude-code';
import { WebClient } from '@slack/web-api';
import { Logger } from './logger';
import { SYSTEM_PROMPT } from './system-prompt';

const logger = new Logger('ScheduledSearch');

interface SearchConfig {
  slackClient: WebClient;
  channelId: string;
  searchIntervalHours: number;
}

const SEARCH_PROMPT = `${SYSTEM_PROMPT}

---

TASK: Search for commercial real estate listings and return ONLY listings with actual URLs.

Search LoopNet, Crexi, and commercial listing sites for retail spaces in West Village, Tribeca, Nolita, NoHo, Meatpacking, and SoHo (Manhattan).

CRITICAL REQUIREMENTS:
- ONLY include listings where you have the ACTUAL URL to the listing page
- DO NOT make up or guess URLs
- If you cannot find a direct link, do not include that listing

For each listing, format EXACTLY like this (use plain text, no markdown):

---
📍 [Full Street Address]
🔗 [Full URL to listing - REQUIRED]
📐 Size: [X] sq ft
💰 Rent: $[X]/month ($[X]/sq ft)
✨ Features: [list key features]
⭐ Why it fits: [1 sentence on sauna/wellness potential]
---

Search for 3-5 listings maximum. Quality over quantity - only include listings with verified URLs.

Prioritize listings mentioning: basement, high ceilings, ventilation, former restaurant/bar space.

BUDGET: Max $15,000/month - skip anything above this.`;

export class ScheduledSearch {
  private config: SearchConfig;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(config: SearchConfig) {
    this.config = config;
  }

  async runSearch(): Promise<string> {
    logger.info('Starting scheduled real estate search');

    let result = '';

    try {
      // Post "searching" message
      await this.config.slackClient.chat.postMessage({
        channel: this.config.channelId,
        text: '🔍 *Running scheduled real estate search...*',
      });

      const abortController = new AbortController();

      // Set a 3 minute timeout for the search
      const timeout = setTimeout(() => {
        logger.warn('Search timeout - aborting after 3 minutes');
        abortController.abort();
      }, 3 * 60 * 1000);

      const options: any = {
        outputFormat: 'stream-json',
        permissionMode: 'bypassPermissions',
        cwd: '/tmp',
      };

      logger.info('Starting Claude Code query...');

      for await (const message of query({
        prompt: SEARCH_PROMPT,
        abortController,
        options,
      })) {
        logger.info('Received message from Claude', { type: message.type, subtype: (message as any).subtype });

        if (message.type === 'assistant' && message.message.content) {
          for (const part of message.message.content) {
            if ((part as any).type === 'text') {
              result += (part as any).text;
            }
          }
        } else if (message.type === 'result' && message.subtype === 'success') {
          const finalResult = (message as any).result;
          if (finalResult && !result.includes(finalResult)) {
            result += finalResult;
          }
        }
      }

      clearTimeout(timeout);

      // Post results to Slack
      if (result.trim()) {
        // Split long messages (Slack has 4000 char limit)
        const chunks = this.splitMessage(result, 3900);

        for (let i = 0; i < chunks.length; i++) {
          const header = i === 0 ? '🏢 *Location 2 Search Results*\n\n' : '';
          await this.config.slackClient.chat.postMessage({
            channel: this.config.channelId,
            text: header + chunks[i],
            unfurl_links: true,  // Show link previews
          });
        }
      } else {
        await this.config.slackClient.chat.postMessage({
          channel: this.config.channelId,
          text: '📭 No new compelling listings found in this search.',
        });
      }

      logger.info('Scheduled search completed', { resultLength: result.length });
    } catch (error) {
      logger.error('Scheduled search failed', error);

      await this.config.slackClient.chat.postMessage({
        channel: this.config.channelId,
        text: `❌ *Search failed:* ${(error as Error).message}`,
      });
    }

    return result;
  }

  private splitMessage(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      // Find a good break point (newline or space)
      let breakPoint = remaining.lastIndexOf('\n', maxLength);
      if (breakPoint === -1 || breakPoint < maxLength / 2) {
        breakPoint = remaining.lastIndexOf(' ', maxLength);
      }
      if (breakPoint === -1) {
        breakPoint = maxLength;
      }

      chunks.push(remaining.substring(0, breakPoint));
      remaining = remaining.substring(breakPoint).trim();
    }

    return chunks;
  }

  start(): void {
    const intervalMs = this.config.searchIntervalHours * 60 * 60 * 1000;

    logger.info('Starting scheduled search', {
      intervalHours: this.config.searchIntervalHours,
      channelId: this.config.channelId,
    });

    // Run immediately on start
    this.runSearch();

    // Then run on schedule
    this.intervalId = setInterval(() => {
      this.runSearch();
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Scheduled search stopped');
    }
  }

  // Run a one-time search (useful for testing)
  async runOnce(): Promise<string> {
    return this.runSearch();
  }
}
