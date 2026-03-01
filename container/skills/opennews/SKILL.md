---
name: opennews
description: Crypto news search with AI ratings, trading signals, and real-time updates via the OpenNews 6551 API. Supports keyword search, coin filtering, source filtering, and AI-powered analysis. Use whenever you need crypto news, market intelligence, or trading signals. Triggers on "crypto news", "news", "market update", "trading signal", "bitcoin news", "ethereum news".
allowed-tools: Bash(curl:*)
---

# Crypto News via OpenNews (6551 API)

Query crypto news from the 6551 platform REST API. All endpoints require a Bearer token via `$OPENNEWS_TOKEN`.

**Get your token**: https://6551.io/mcp
**Base URL**: `https://ai.6551.io`

## Prerequisites

The `OPENNEWS_TOKEN` environment variable must be set. If not configured, tell the user:

> To use crypto news features, you need a 6551 API token.
> 1. Visit https://6551.io/mcp
> 2. Sign up and get your API token
> 3. Add `OPENNEWS_TOKEN=<your-token>` to your `.env` file
> 4. Restart NanoClaw

## Authentication

All requests require the header:

```
Authorization: Bearer $OPENNEWS_TOKEN
```

## Available Operations

### 1. Get News Sources

Fetch all available news source categories organized by engine type. Use this to discover what sources are available for filtering.

```bash
curl -s -H "Authorization: Bearer $OPENNEWS_TOKEN" \
  "https://ai.6551.io/open/news_type"
```

Returns a tree with engine types and their sub-categories:
- `news` — Traditional news sources (Bloomberg, Reuters, etc.)
- `listing` — Exchange listing announcements
- `onchain` — On-chain activity alerts
- `meme` — Meme coin and social sentiment
- `market` — Market data and analysis

### 2. Search News

`POST /open/news_search` is the primary search endpoint. Supports keyword search, coin filtering, source filtering, and pagination.

**Get latest news:**
```bash
curl -s -X POST "https://ai.6551.io/open/news_search" \
  -H "Authorization: Bearer $OPENNEWS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "page": 1}'
```

**Search by keyword:**
```bash
curl -s -X POST "https://ai.6551.io/open/news_search" \
  -H "Authorization: Bearer $OPENNEWS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"q": "bitcoin ETF", "limit": 10, "page": 1}'
```

**Search by coin symbol:**
```bash
curl -s -X POST "https://ai.6551.io/open/news_search" \
  -H "Authorization: Bearer $OPENNEWS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"coins": ["BTC"], "limit": 10, "page": 1}'
```

**Filter by engine type and news source:**
```bash
curl -s -X POST "https://ai.6551.io/open/news_search" \
  -H "Authorization: Bearer $OPENNEWS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"engineTypes": {"news": ["Bloomberg", "Reuters"]}, "limit": 10, "page": 1}'
```

**Only news with associated coins:**
```bash
curl -s -X POST "https://ai.6551.io/open/news_search" \
  -H "Authorization: Bearer $OPENNEWS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hasCoin": true, "limit": 10, "page": 1}'
```

All search parameters:
- `limit` (integer, required, 1-100): Max results per page
- `page` (integer, required, 1-based): Page number
- `q` (string, optional): Full-text keyword search
- `coins` (string[], optional): Filter by coin symbols (e.g. `["BTC","ETH"]`)
- `engineTypes` (map[string][]string, optional): Filter by engine and news types
- `hasCoin` (boolean, optional): Only return news with associated coins

## Data Structures

### News Article Response

```json
{
  "id": "unique-article-id",
  "text": "Article headline / content",
  "newsType": "Bloomberg",
  "engineType": "news",
  "link": "https://...",
  "coins": [
    {
      "symbol": "BTC",
      "market_type": "spot",
      "match": "title"
    }
  ],
  "aiRating": {
    "score": 85,
    "grade": "A",
    "signal": "long",
    "status": "done",
    "summary": "Chinese summary",
    "enSummary": "English summary"
  },
  "ts": 1708473600000
}
```

### AI Rating Fields

Each news article may include an AI-generated rating:
- `score` (0-100): Impact/importance score
- `grade` (A-F): Letter grade
- `signal` ("long", "short", "neutral"): Trading signal
- `status` ("done", "pending"): Whether AI analysis is complete
- `summary`: Chinese language summary
- `enSummary`: English language summary

Check `aiRating.status === "done"` before using AI rating data.

## Common Workflows

### Quick Market Overview

Get the latest 10 news items and extract key signals:

```bash
curl -s -X POST "https://ai.6551.io/open/news_search" \
  -H "Authorization: Bearer $OPENNEWS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "page": 1}'
```

### High-Impact News (AI Score >= 80)

Fetch a larger batch and filter for high-impact items:

```bash
curl -s -X POST "https://ai.6551.io/open/news_search" \
  -H "Authorization: Bearer $OPENNEWS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 50, "page": 1}' | jq '[.data[] | select(.aiRating.score >= 80)]'
```

### Bitcoin-Specific News

```bash
curl -s -X POST "https://ai.6551.io/open/news_search" \
  -H "Authorization: Bearer $OPENNEWS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"coins": ["BTC"], "limit": 20, "page": 1}'
```

### Multi-Coin Monitoring

```bash
curl -s -X POST "https://ai.6551.io/open/news_search" \
  -H "Authorization: Bearer $OPENNEWS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"coins": ["BTC", "ETH", "SOL"], "limit": 20, "page": 1}'
```

### News from Specific Sources

```bash
curl -s -X POST "https://ai.6551.io/open/news_search" \
  -H "Authorization: Bearer $OPENNEWS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"engineTypes": {"news": ["Bloomberg", "Reuters", "CoinDesk"]}, "limit": 10, "page": 1}'
```

### Daily Crypto Briefing Workflow

Combine multiple queries for a comprehensive briefing:

```bash
# 1. Get top news
curl -s -X POST "https://ai.6551.io/open/news_search" \
  -H "Authorization: Bearer $OPENNEWS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "page": 1}'

# 2. Get BTC-specific news
curl -s -X POST "https://ai.6551.io/open/news_search" \
  -H "Authorization: Bearer $OPENNEWS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"coins": ["BTC"], "limit": 5, "page": 1}'

# 3. Get exchange listing news
curl -s -X POST "https://ai.6551.io/open/news_search" \
  -H "Authorization: Bearer $OPENNEWS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"engineTypes": {"listing": []}, "limit": 5, "page": 1}'
```

## Notes

- Rate limits apply; max 100 results per request
- AI ratings may not be available on all articles (check `status === "done"`)
- Get your API token at https://6551.io/mcp
- All search endpoints use POST method with JSON body
- The `OPENNEWS_TOKEN` env var must be available in the container
- Timestamps (`ts`) are Unix milliseconds
