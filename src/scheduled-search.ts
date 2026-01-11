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

TASK
Search for commercial real estate listings suitable for a wellness / sauna concept (Elahni) expansion in Manhattan.

The goal is to identify real, verifiable opportunities and surface promising leads — not to fabricate completeness.

---

SEARCH STRATEGY (CRITICAL)

Do not attempt to browse listing platforms directly.

Instead, use Google-style site-specific searches to surface indexed listing pages and broker posts.

Run variations of:
  - site:loopnet.com retail [neighborhood] Manhattan lease
  - site:crexi.com [neighborhood] NYC retail space
  - site:commercialcafe.com [neighborhood] Manhattan
  - site:42floors.com [neighborhood] New York retail
  - site:cityfeet.com Manhattan [neighborhood] retail
  - [neighborhood] Manhattan retail space for lease 2024
  - [neighborhood] commercial space basement former restaurant

Prioritize broker-hosted pages and publicly indexable listings over gated platform results.

---

TARGET NEIGHBORHOODS

Search each independently:
  - West Village (ZIP 10014)
  - Tribeca (10007, 10013)
  - SoHo / NoHo (10012)
  - Nolita (10012)
  - Meatpacking District (10014)
  - Backup if inventory is thin: Lower East Side (10002)

---

SPACE & BUDGET REQUIREMENTS
  - Ideal size: 1000–2500 sq ft
  - Budget: ≤ $17,000/month
  - If rent is listed as $/SF/year → convert to monthly
  - If rent is "upon request" → include but mark clearly
  - Must-have: Ground floor and/or basement access

Strong positive signals (note if present):
  - Basement or lower-level component
  - 11'+ ceilings
  - Existing ventilation or HVAC
  - Former restaurant, bar, spa, gym, or fitness use
  - Rear yard or outdoor access
  - Existing plumbing / water lines

---

OUTPUT RULES (IMPORTANT)
  - Do NOT fabricate URLs, rents, sizes, or features
  - Include listings with partial information if they appear promising
  - Clearly mark missing data as "not listed"
  - Login-gated listings are acceptable — note this explicitly
  - Broker contact info is valuable; include if visible
  - Recently leased or "in contract" listings may be included as comps, labeled clearly

---

LISTING FORMAT (PLAIN TEXT ONLY — NO MARKDOWN)

For each listing:

---

Address: [Street address if available, otherwise cross streets / general location]
Neighborhood: [Area]
Source: [LoopNet / Crexi / Broker site / Other]
URL: [Direct public URL OR "Login required / verification needed"]
Size: [Sq ft or "not listed"]
Asking Rent: [Monthly and/or $/SF — or "not listed"]
Key Features: [Basement, ceilings, prior use, ventilation, etc.]
Wellness Fit Notes: [1–2 sentences on sauna/plunge feasibility]
Confidence Level:
  - High = direct URL + concrete details
  - Medium = partial info or login wall
  - Low = secondhand reference only

---

---

AFTER SEARCHING — SUMMARY SECTION

Provide a short synthesis covering:
  - Total number of listings found
  - Neighborhoods with the strongest inventory
  - Most accessible / useful sources
  - Observed pricing patterns (if any)
  - Recommended next steps, such as:
    - Specific brokers to contact
    - Alerts or saved searches to set up
    - Neighborhoods worth expanding search into next`;

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
        options: {
          ...options,
          abortController,
        },
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
      const err = error as Error;
      logger.error('Scheduled search failed', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });

      // Send more detailed error to Slack for debugging
      let errorDetails = err.message;
      if (err.stack) {
        // Get first 2 lines of stack trace
        const stackLines = err.stack.split('\n').slice(0, 3).join('\n');
        errorDetails += `\n\`\`\`${stackLines}\`\`\``;
      }

      await this.config.slackClient.chat.postMessage({
        channel: this.config.channelId,
        text: `❌ *Search failed:* ${errorDetails}`,
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
