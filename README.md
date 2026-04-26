# Tally

A free, browser-based calorie log. No accounts, no backend, no tracking. Your food log lives in your own browser.

**Live demo:** _add link after enabling GitHub Pages_

## What it does

- Search foods across multiple databases (USDA, Nutritionix, Open Food Facts) in parallel
- Compare calorie estimates from different sources side-by-side and pick what fits
- Log entries with portion presets or branded size variants (Grande, Venti, etc.)
- 7-day history with daily totals and goal tracking
- Export/import your log as JSON
- Works offline after first load (except for new searches)

## Why three sources?

No single database covers everything well. USDA is excellent for whole foods but doesn't know what a Caramel Macchiato is. Nutritionix has restaurant chains. Open Food Facts has packaged groceries. Tally queries all three you've configured and lets you choose.

## Setup

You'll need free API keys from one or more sources. **You only need one to get started — USDA covers most basics.**

### USDA FoodData Central (recommended, takes 2 minutes)

1. Visit https://fdc.nal.usda.gov/api-key-signup.html
2. Fill in name + email, submit
3. Key arrives via email instantly
4. Paste into Tally → Settings → USDA API Key

### Nutritionix (recommended for branded items / restaurants)

1. Visit https://developer.nutritionix.com/signup
2. Sign up for the free tier (200 requests/day)
3. Copy your **App ID** and **App Key** from the dashboard
4. Paste both into Tally → Settings

### Open Food Facts

No key required. Already enabled.

## Running locally

```bash
git clone https://github.com/g9tp4bqq5c-lgtm/tally-calorie-log.git
cd tally-calorie-log
open index.html
```

That's it. No npm install, no build step.

## Deploying to GitHub Pages

1. Push to `main`
2. Repo → Settings → Pages → Source: "Deploy from a branch" → `main` / `/ (root)`
3. Visit `https://<your-username>.github.io/tally-calorie-log/`

## Privacy

- All data lives in your browser's localStorage
- API keys are stored locally and only sent to the corresponding API
- No analytics, no telemetry, no third-party scripts beyond Google Fonts
- To wipe everything: Settings → Clear all data

## Tech

Plain HTML, CSS, vanilla JS. Zero dependencies. Hosted on GitHub Pages.

## License

MIT
