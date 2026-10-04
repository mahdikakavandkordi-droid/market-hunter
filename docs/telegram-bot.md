# Market Hunter Telegram Bot

Private Persian Telegram interface for the existing Market Hunter engine.

## What the bot reads

The bot does not run a second scanner and does not change scanner thresholds.

- Market Hunter stages: `data/v2-latest-scan.json`
- Cross-market pulse: `data/market-pulse-latest.json`
- Overall market report: `data/daily-market-report.json`
- Previous Hunter package: prior Git commit of `data/v2-latest-scan.json`
- Portfolio: Market Hunter Cloud Portfolio in Supabase, then the existing `/api/portfolio` endpoint for current per-position and portfolio analytics

This keeps Telegram as a presentation/navigation layer over the same engine that feeds the web app.

## Telegram menu

- 🌍 Market / indices
  - TSX
  - S&P 500
  - Nasdaq-100
  - Gold
  - Silver
  - Bitcoin
  - Ethereum
  - Overall market report
- 🎯 Market Hunter
  - Early Watch
  - Recovery
  - Attractive Growth
  - Established Move
  - Tap a symbol for a Persian stock report
- 🧭 Market Brief
  - newly observed
  - removed
  - moved between stages
  - still observed
  - current Review First shortlist
- 💼 Portfolio
  - portfolio summary
  - per-position report
- 🔄 Update status

Messages use Telegram HTML rather than Markdown tables so Persian RTL text and Latin tickers/numbers remain readable on mobile.

## Mobile report layout (October 4, 2026)

- Market overview groups equities, metals and crypto, with one short state and an explicit completed-session date per market.
- Individual market and stock views put price, session change and key metrics before navigation to the chart.
- Portfolio summary puts open P/L, positions requiring review and asset/sector exposure first. Holdings are paginated six at a time, with per-position detail buttons and previous/next navigation.
- Per-position reports show quantity, average entry, current value, weight, open P/L, technical concerns and tracking levels without repeated narrative paragraphs.
- Percentages representing allocation use unsigned weights. Latin numbers use directional isolation inside HTML code spans.
- Missing numeric values remain unavailable. Unknown or mixed currencies prevent aggregate values and allocation weights from being displayed.
- These presentation changes do not modify scanner selection, research decisions, or portfolio holdings. Neutral technical labels do not assert that a holding is safe.

Validation: the formatter suite exercises 60 synthetic holdings across all pages, message length and balanced HTML, missing values, mixed/unknown currencies and escaped names. Production verification uses the read-only health endpoint; it does not send a test message to the user.

## Required Vercel environment variables

Create the bot with @BotFather, then configure these variables on the Market Hunter Vercel project:

| Variable | Required | Purpose |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | yes | Bot token from BotFather |
| `TELEGRAM_ALLOWED_USER_ID` | yes | Numeric Telegram user ID allowed to use the private bot. Multiple IDs may be comma-separated. |
| `TELEGRAM_WEBHOOK_SECRET` | recommended | Random secret used to verify Telegram webhook requests |
| `SUPABASE_SERVICE_ROLE_KEY` | only for Portfolio | Server-only key used by the bot endpoint. Never expose this in browser code or GitHub. |
| `TELEGRAM_PORTFOLIO_USER_ID` | only for Portfolio | Supabase Auth user UUID whose Market Hunter portfolio is read |
| `SUPABASE_URL` | optional | Defaults to the existing Market Hunter Supabase project |
| `MARKET_HUNTER_API_BASE` | optional | Override for the Market Hunter deployment used by Portfolio refresh |

The service-role key is used only inside the server-side Vercel function. It must never be prefixed with `NEXT_PUBLIC_` or committed to the repository.

## Portfolio prerequisite

The current web app stores guest/local portfolio data on the device and syncs signed-in portfolios to Supabase.

For the Telegram bot to see the same portfolio:

1. Sign in to Cloud Portfolio in the Market Hunter web app.
2. Confirm the holdings are visible.
3. Use **Sync now** once.
4. Verify a row exists in `market_hunter_portfolio_state`.

If no cloud state exists, the Telegram Portfolio menu explains that Cloud Portfolio has not been synced yet. Market/indices, Hunter stages and Market Brief do not depend on Portfolio sync.

## Webhook activation

After deployment and Vercel environment variables are configured, trigger a fresh deployment so the new secrets are available to the serverless function:

```bash
TELEGRAM_BOT_TOKEN="..." \
TELEGRAM_WEBHOOK_SECRET="..." \
TELEGRAM_WEBHOOK_URL="https://market-hunter-five.vercel.app/api/telegram" \
node scripts/setup-telegram-webhook.mjs
```

The helper registers only `message` and `callback_query` updates, drops stale pending updates, configures the webhook secret, and installs the bot commands.

Health check:

```
GET /api/telegram
```

It reports only whether Telegram and Portfolio integrations are configured. It never returns secrets or the allowed Telegram user ID.

## Security model

- User allowlist is checked on every update.
- Unauthorized Telegram users receive no Market Hunter data.
- A webhook secret can verify that POST requests are from the configured Telegram webhook.
- Portfolio data remains in Supabase; it is not copied into GitHub.
- Service-role credentials remain server-side.
- The bot is read-only. It does not change holdings, scanner rules, thresholds, or research validation data.

## Files

- `api/telegram.js` — webhook/router
- `lib/telegram-data.js` — engine/data adapters
- `lib/telegram-fa.js` — Persian Telegram views/formatters
- `scripts/setup-telegram-webhook.mjs` — one-time webhook activation helper
- `scripts/test-telegram-bot.mjs` — formatter and Market Brief regression checks


## Portfolio backend source of truth

Once paired, the backend copy is canonical. Browser storage is a cache and can be restored from the paired backend.
