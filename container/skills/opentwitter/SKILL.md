---
name: opentwitter
description: Query Twitter/X data — user profiles, tweet search, user tweets, follower events, deleted tweets, and KOL followers via the 6551 REST API. Use whenever you need Twitter/X intelligence, social monitoring, or crypto KOL tracking. Triggers on "twitter", "tweet", "x user", "followers", "kol", "deleted tweets".
allowed-tools: Bash(curl:*)
---

# Twitter/X Data via OpenTwitter (6551 API)

Query Twitter/X data from the 6551 platform REST API. All endpoints require a Bearer token via `$TWITTER_TOKEN`.

**Get your token**: https://6551.io/mcp
**Base URL**: `https://ai.6551.io`

## Prerequisites

The `TWITTER_TOKEN` environment variable must be set. If not configured, tell the user:

> To use Twitter/X data features, you need a 6551 API token.
> 1. Visit https://6551.io/mcp
> 2. Sign up and get your API token
> 3. Add `TWITTER_TOKEN=<your-token>` to your `.env` file
> 4. Restart NanoClaw

## Authentication

All requests require the header:

```
Authorization: Bearer $TWITTER_TOKEN
```

## Available Operations

### 1. Get Twitter User Info

Get user profile by username (without @).

```bash
curl -s -X POST "https://ai.6551.io/open/twitter_user_info" \
  -H "Authorization: Bearer $TWITTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "elonmusk"}'
```

### 2. Get Twitter User by ID

Get user profile by numeric user ID.

```bash
curl -s -X POST "https://ai.6551.io/open/twitter_user_by_id" \
  -H "Authorization: Bearer $TWITTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": "44196397"}'
```

### 3. Get User Tweets

Get recent tweets from a user. Supports filtering by type.

```bash
curl -s -X POST "https://ai.6551.io/open/twitter_user_tweets" \
  -H "Authorization: Bearer $TWITTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "elonmusk", "maxResults": 20, "product": "Latest"}'
```

Parameters:
- `username` (string, required): Twitter username without @
- `maxResults` (integer, 1-100, default 20): Maximum tweets to return
- `product` (string, "Latest" or "Top", default "Latest"): Sort order
- `includeReplies` (boolean, default false): Include reply tweets
- `includeRetweets` (boolean, default false): Include retweets

### 4. Search Twitter

Search tweets with powerful filters — keywords, users, hashtags, engagement thresholds, date ranges, and language.

**Search by keyword:**
```bash
curl -s -X POST "https://ai.6551.io/open/twitter_search" \
  -H "Authorization: Bearer $TWITTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"keywords": "bitcoin", "maxResults": 20, "product": "Top"}'
```

**Search from specific user:**
```bash
curl -s -X POST "https://ai.6551.io/open/twitter_search" \
  -H "Authorization: Bearer $TWITTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fromUser": "VitalikButerin", "maxResults": 20}'
```

**Search by hashtag with engagement filter:**
```bash
curl -s -X POST "https://ai.6551.io/open/twitter_search" \
  -H "Authorization: Bearer $TWITTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hashtag": "crypto", "minLikes": 100, "maxResults": 20}'
```

All search parameters:
- `keywords` (string): Search keywords
- `fromUser` (string): Tweets from specific user
- `toUser` (string): Tweets to specific user
- `mentionUser` (string): Tweets mentioning user
- `hashtag` (string): Filter by hashtag (without #)
- `excludeReplies` (boolean, default false): Exclude reply tweets
- `excludeRetweets` (boolean, default false): Exclude retweets
- `minLikes` (integer, default 0): Minimum likes threshold
- `minRetweets` (integer, default 0): Minimum retweets threshold
- `minReplies` (integer, default 0): Minimum replies threshold
- `sinceDate` (string, YYYY-MM-DD): Start date
- `untilDate` (string, YYYY-MM-DD): End date
- `lang` (string): Language code (e.g. "en", "zh")
- `product` (string, "Top" or "Latest", default "Top"): Sort order
- `maxResults` (integer, 1-100, default 20): Maximum tweets to return

### 5. Get Follower Events

Get new followers or unfollowers for a user.

```bash
# New followers
curl -s -X POST "https://ai.6551.io/open/twitter_follower_events" \
  -H "Authorization: Bearer $TWITTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "elonmusk", "isFollow": true, "maxResults": 20}'

# Unfollowers
curl -s -X POST "https://ai.6551.io/open/twitter_follower_events" \
  -H "Authorization: Bearer $TWITTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "elonmusk", "isFollow": false, "maxResults": 20}'
```

Parameters:
- `username` (string, required): Twitter username without @
- `isFollow` (boolean, default true): true = new followers, false = unfollowers
- `maxResults` (integer, 1-100, default 20): Maximum events to return

### 6. Get Deleted Tweets

Get deleted tweets from a user.

```bash
curl -s -X POST "https://ai.6551.io/open/twitter_deleted_tweets" \
  -H "Authorization: Bearer $TWITTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "elonmusk", "maxResults": 20}'
```

Parameters:
- `username` (string, required): Twitter username without @
- `maxResults` (integer, 1-100, default 20): Maximum tweets to return

### 7. Get KOL Followers

Get which KOLs (Key Opinion Leaders) are following a user. Useful for evaluating influence in the crypto space.

```bash
curl -s -X POST "https://ai.6551.io/open/twitter_kol_followers" \
  -H "Authorization: Bearer $TWITTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "elonmusk"}'
```

Parameters:
- `username` (string, required): Twitter username without @

## Data Structures

### Twitter User Response

```json
{
  "userId": "44196397",
  "screenName": "elonmusk",
  "name": "Elon Musk",
  "description": "...",
  "followersCount": 170000000,
  "friendsCount": 500,
  "statusesCount": 30000,
  "verified": true
}
```

### Tweet Response

```json
{
  "id": "1234567890",
  "text": "Tweet content...",
  "createdAt": "2024-02-20T12:00:00Z",
  "retweetCount": 1000,
  "favoriteCount": 5000,
  "replyCount": 200,
  "userScreenName": "elonmusk",
  "hashtags": ["crypto", "bitcoin"],
  "urls": [{"url": "https://..."}]
}
```

## Common Workflows

### Monitor a Crypto KOL

```bash
# Get their latest tweets
curl -s -X POST "https://ai.6551.io/open/twitter_user_tweets" \
  -H "Authorization: Bearer $TWITTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "VitalikButerin", "maxResults": 10}'

# Check who's following them (KOL network)
curl -s -X POST "https://ai.6551.io/open/twitter_kol_followers" \
  -H "Authorization: Bearer $TWITTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "VitalikButerin"}'
```

### Find Trending Crypto Discussion

```bash
curl -s -X POST "https://ai.6551.io/open/twitter_search" \
  -H "Authorization: Bearer $TWITTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"keywords": "bitcoin", "minLikes": 1000, "product": "Top", "maxResults": 20}'
```

### Track Follower Changes

```bash
# New followers today
curl -s -X POST "https://ai.6551.io/open/twitter_follower_events" \
  -H "Authorization: Bearer $TWITTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "target_user", "isFollow": true, "maxResults": 50}'
```

## Notes

- Rate limits apply; max 100 results per request
- Twitter usernames should NOT include the @ symbol
- Get your API token at https://6551.io/mcp
- All endpoints use POST method with JSON body
- The `TWITTER_TOKEN` env var must be available in the container
