# MCP Data Source Resilience Rules

> Last updated: 2026-03-12
> Purpose: Ensure agents can continue operating when MCP data sources are unavailable, degraded, or rate-limited.
> Referenced by: Trend Scout (P9), Keyword Strategist (P10), Outbound Prospecting (P21)

---

## Principle

No agent should halt entirely because a single data source is down. Every agent with external data dependencies MUST implement graceful degradation.

---

## MCP Data Sources & Fallback Chain

### Ahrefs MCP (Keyword Research)

| Priority      | Source                   | Use Case                                                                     |
| ------------- | ------------------------ | ---------------------------------------------------------------------------- |
| 1 (Primary)   | Ahrefs MCP               | Keyword volume, KD, SERP features, competitor analysis                       |
| 2 (Fallback)  | Google Trends (free API) | Relative search interest, trending queries                                   |
| 3 (Fallback)  | Manual keyword list      | `data/evergreen-trends.md` — pre-researched keywords by pillar               |
| 4 (Emergency) | Skip keyword data        | Proceed with content brief using pillar + topic only, flag as `[NO-KW-DATA]` |

### Apify MCP (Social Scraping)

| Priority      | Source           | Use Case                                                |
| ------------- | ---------------- | ------------------------------------------------------- |
| 1 (Primary)   | Apify MCP        | Reddit, LinkedIn, Instagram scraping                    |
| 2 (Fallback)  | Firecrawl MCP    | Web scraping for same sources (slower, less structured) |
| 3 (Fallback)  | Manual scan      | Use `data/evergreen-trends.md` + last week's briefing   |
| 4 (Emergency) | Skip social data | Use evergreen trends only, flag as `[NO-SOCIAL-DATA]`   |

### Firecrawl MCP (Web Scraping)

| Priority      | Source        | Use Case                                               |
| ------------- | ------------- | ------------------------------------------------------ |
| 1 (Primary)   | Firecrawl MCP | Competitor pages, industry blogs, prospect websites    |
| 2 (Fallback)  | Direct fetch  | Claude web search for same URLs                        |
| 3 (Emergency) | Skip scraping | Use cached/historical data, flag as `[NO-SCRAPE-DATA]` |

### Vibe Prospecting MCP (Lead Discovery)

| Priority      | Source                        | Use Case                                            |
| ------------- | ----------------------------- | --------------------------------------------------- |
| 1 (Primary)   | Vibe Prospecting MCP          | Business search, prospect enrichment                |
| 2 (Fallback)  | Google Maps + LinkedIn search | Manual prospect identification                      |
| 3 (Emergency) | Pause outbound                | Do not send outreach without verified prospect data |

---

## Fallback Behavior Rules

### 1. Retry Before Fallback

- Retry failed MCP calls **once** with a 30-second delay
- If retry fails, move to next fallback source
- Log the failure in the agent's output file: `[MCP-FALLBACK] {source} unavailable, using {fallback}`

### 2. Data Freshness Flags

When using fallback data, always flag the output:

| Flag        | Meaning                                     | Action Required                        |
| ----------- | ------------------------------------------- | -------------------------------------- |
| `[FRESH]`   | Primary source data, < 24 hours old         | None                                   |
| `[CACHED]`  | Using data from previous run (1-7 days old) | Acceptable, note in output             |
| `[STALE]`   | Using data > 7 days old                     | Auto-promote to YELLOW tier            |
| `[NO-DATA]` | No data available from any source           | Auto-promote to RED tier, human review |

### 3. Agent-Specific Fallback Rules

| Agent                | If primary source fails...                                                  |
| -------------------- | --------------------------------------------------------------------------- |
| Trend Scout          | Use `data/evergreen-trends.md`, reduce output to top 3 trends (not 5)       |
| Keyword Strategist   | Use Google Trends + evergreen keywords, flag all KD scores as `[ESTIMATED]` |
| Outbound Prospecting | **HALT** — never send outreach with unverified prospect data                |
| Performance Analyst  | Use platform-native analytics only, note missing cross-platform data        |

### 4. Cascading Failure Prevention

- If 2+ MCP sources are down simultaneously, **halt all content creation agents**
- Continue analytics and engagement agents (they use platform-native data)
- Create a RED-tier alert: `[SYSTEM] Multiple MCP sources unavailable — content pipeline paused`

---

## Rate Limit Management

| MCP Source       | Monthly Limit  | Daily Target   | Buffer                      |
| ---------------- | -------------- | -------------- | --------------------------- |
| Ahrefs           | Varies by plan | 10 queries/day | Keep 20% reserve for ad-hoc |
| Apify            | 49 CUs/mo      | ~1.5 CUs/day   | Keep 30% for month-end      |
| Firecrawl        | ~500 pages/mo  | ~15 pages/day  | Keep 20% reserve            |
| Vibe Prospecting | Free tier      | As needed      | N/A                         |

### When Approaching Limits

1. At 70% monthly usage: Reduce non-essential queries, prioritize primary agents
2. At 85% monthly usage: Switch to fallback sources for secondary agents
3. At 95% monthly usage: All agents use fallback sources, log `[RATE-LIMIT]`

---

## Monitoring

- Every agent MUST log MCP call success/failure in its output
- Weekly: Review MCP usage in `reports/weekly-performance-[DATE].md`
- Monthly: Review costs in `system/budget-tracker.md`

---

## Change Log

| Date       | Change           |
| ---------- | ---------------- |
| 2026-03-12 | Initial creation |
