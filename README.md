# Elahni Location 2 — Real Estate Search Agent

## Project Overview

Build a Slack-integrated Claude agent that searches for commercial real estate listings relevant to Elahni's second location. The agent should search multiple listing platforms, filter based on specific criteria, and deliver summarized findings directly in Slack.

---

## Business Context

**What we're looking for:**
- Commercial/retail spaces in West Village or Tribeca
- Under 2000 sq ft
- High ceilings 12 ft+
- Ventilation-friendly (critical for sauna build-out)
- Street-level or accessible entrance

**Why an agent:**
- Manual searching across multiple platforms is time-consuming
- Want to catch new listings quickly in a competitive market
- Need structured data (price/sq ft, lease terms, broker contact) not just links

---

## Technical Architecture

### Stack
- **Runtime:** Node.js 18+
- **Framework:** claude-code-slack-bot (https://github.com/mpociot/claude-code-slack-bot)
- **AI:** Claude via Anthropic API with web search enabled
- **Interface:** Slack (DM or channel mentions)
- **Hosting:** Local dev initially, can deploy to Railway/Render/fly.io

### Core Capabilities
1. **Web Search** — Query LoopNet, Crexi, commercial listing sites
2. **Slack Integration** — Receive commands, respond in-thread
3. **Structured Output** — Return formatted listings, not raw search dumps

---

## Setup Instructions

### Prerequisites
- Node.js 18+ installed
- Slack workspace with admin access to add apps
- Anthropic API key

### Step 1: Create Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From an app manifest"
3. Select your Elahni workspace
4. Paste the manifest below:

```yaml
display_information:
  name: Elahni Real Estate Bot
  description: Searches for Location 2 commercial spaces
  background_color: "#1a1a2e"
features:
  app_home:
    home_tab_enabled: false
    messages_tab_enabled: true
    messages_tab_read_only_enabled: false
  bot_user:
    display_name: elahni-realestate
    always_online: true
oauth_config:
  scopes:
    bot:
      - app_mentions:read
      - channels:history
      - chat:write
      - groups:history
      - im:history
      - im:read
      - im:write
      - mpim:history
settings:
  event_subscriptions:
    bot_events:
      - app_mention
      - message.im
  interactivity:
    is_enabled: true
  org_deploy_enabled: false
  socket_mode_enabled: true
  token_rotation_enabled: false
```

5. Install to workspace
6. Copy these credentials:
   - Bot Token (starts with `xoxb-`)
   - App Token (starts with `xapp-`) — generate under "Basic Information" → "App-Level Tokens"
   - Signing Secret

### Step 2: Clone and Configure

```bash
git clone https://github.com/mpociot/claude-code-slack-bot
cd claude-code-slack-bot
npm install
cp .env.example .env
```

Edit `.env`:

```env
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_APP_TOKEN=xapp-your-token
SLACK_SIGNING_SECRET=your-secret
ANTHROPIC_API_KEY=your-api-key
```

### Step 3: Configure Agent for Real Estate Search

Create or modify the agent configuration to include web search and a system prompt tailored to real estate:

**System Prompt (add to agent config):**

```
You are a commercial real estate research assistant for Elahni, a wellness speakeasy expanding to a second NYC location.

SEARCH CRITERIA:
- Neighborhoods: West Village, Tribeca (Manhattan)
- Size: Under 1,500 sq ft
- Type: Retail/commercial, street-level preferred
- Must-haves: Ventilation potential, basement access is a plus
- Budget: Market rate for the area

WHEN SEARCHING:
1. Query LoopNet, Crexi, and general commercial listings
2. For each relevant listing, extract:
   - Address
   - Square footage
   - Asking rent ($/month and $/sq ft)
   - Lease terms if available
   - Key features (basement, outdoor, corner, etc.)
   - Broker/contact info
   - Listing URL

OUTPUT FORMAT:
Present findings as a clean summary. Lead with the most promising options. Flag anything with basement access or unusual ventilation potential.

If asked to track or remember listings, note that you don't have persistent memory yet — suggest the user save promising ones.
```

### Step 4: Run the Agent

```bash
npm run dev
```

The agent will connect to Slack via Socket Mode. You can now:
- DM the bot directly
- @mention it in any channel it's added to

---

## Example Interactions

**Basic search:**
```
@elahni-realestate Find available commercial spaces in West Village under 1500 sq ft
```

**Specific query:**
```
@elahni-realestate Search LoopNet and Crexi for retail spaces in Tribeca with basement access. Summarize the top 5 options.
```

**Comparison request:**
```
@elahni-realestate What's the average asking rent per sq ft for retail in West Village vs Tribeca right now?
```

---

## Future Enhancements

### Phase 2: Scheduled Monitoring
Add a cron job or scheduler to run searches automatically:
- Daily or weekly scans
- Post new listings to a dedicated Slack channel
- Filter out previously-seen listings

```javascript
// Example: node-cron for scheduled searches
const cron = require('node-cron');

cron.schedule('0 9 * * 1-5', async () => {
  // Trigger agent search
  // Post results to #location-2-search channel
});
```

### Phase 3: Persistent Memory
Add a database layer (SQLite, Supabase, Airtable) to:
- Track all listings found
- Mark listings as "reviewed," "interested," "passed"
- Query historical data ("show me everything we've seen under $80/sq ft")

### Phase 4: MCP Integrations
Connect additional tools:
- **Google Drive:** Save listing summaries to a shared folder
- **Airtable/Notion:** Populate a tracking database automatically
- **Email:** Forward promising listings to your broker

---

## Limitations

- **Web scraping limits:** Some listing sites may block automated access or require login. The agent uses web search, not direct scraping, so it works with publicly indexed content.
- **No persistent memory (yet):** The agent doesn't remember past searches between sessions unless you add a database.
- **Rate limits:** Anthropic API has usage limits; heavy use may require a higher tier.

---

## Cost Estimate

- **Anthropic API:** ~$0.01-0.05 per search interaction (varies by length)
- **Hosting:** Free for local dev; $5-20/month if deployed to Railway/Render
- **Slack:** Free (standard workspace features)

Estimated monthly cost for moderate use: **$10-30**

---

## Questions / Next Steps

1. **Specific criteria:** Any other must-haves beyond basement + ventilation?
2. **Neighborhoods:** Strictly West Village/Tribeca, or open to adjacent areas (SoHo, NoHo, Greenwich Village)?
3. **Timeline:** How urgently are you looking? Daily monitoring vs. weekly digest?
4. **Broker coordination:** Want the agent to surface broker contact info, or are you working through someone specific?

---

## Resources

- [claude-code-slack-bot repo](https://github.com/mpociot/claude-code-slack-bot)
- [Anthropic API docs](https://docs.anthropic.com)
- [Slack API — Creating Apps](https://api.slack.com/apps)
- [LoopNet](https://www.loopnet.com)
- [Crexi](https://www.crexi.com)
