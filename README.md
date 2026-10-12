# Hotel QR Menu — every guest reads the menu in their own language

Guest scans the table QR code with the phone camera or Google Lens → picks their language (156 languages, each written in its own script) → picks their home country → sees the full menu translated, with prices in their own numerals, an approximate price in their home currency, and a "perfect meal" recommended for the taste of their country. They build an order and show the screen to the waiter, who sees it in English with the table number.

Static site. No build step, no database, no API keys, no tracking.

## Deploy (GitHub → Vercel)

1. Create a new GitHub repository and upload **all files from this zip to the repository root** (no subfolder).
2. In Vercel: **Add New → Project → Import** that repository.
3. Framework Preset: **Other**. Leave Build Command and Output Directory **empty**. Click **Deploy**.
4. Open `https://<your-project>.vercel.app/qr` → it pre-fills your site address → set table numbers → **Generate** → **Print**. Put one QR on each table.

## Pages

| URL | Who | What |
|---|---|---|
| `/` | Guests | Language → country → translated menu, picks, order |
| `/?t=12` | Guests | Same, tagged with table 12 (what the QR codes open) |
| `/?lang=ru` | Optional | Skip the language screen |
| `/qr` | Staff | Printable QR codes per table |

## Change the menu

Edit **`data-menu.js`** only — restaurant name, currency (`INR`), categories and dishes. Write everything in English; translation happens automatically. Tags (`soup`, `grill`, `rice`…) drive the recommendations; allergens drive the "Contains" line and filters. Commit → Vercel redeploys automatically.

To tune recommendations by country edit **`taste.js`** (`PROFILES`, `COUNTRY_TWEAKS`, `LIKE_HOME`).

## Files

| File | Purpose |
|---|---|
| `index.html`, `styles.css`, `app.js` | Guest app |
| `translate.js` | Batch translation + per-language cache on the phone |
| `taste.js` | Country taste profiles and scoring |
| `data-menu.js` | **Your menu** |
| `data-languages.js` | 156 languages, native names, RTL list, native digit systems |
| `data-countries.js` | All 243 countries/territories → currency + taste profile |
| `qr.html`, `qr.js`, `qrcode.js` | Staff QR printing (qrcode.js is MIT, see `QRCODE-LICENSE.txt`) |
| `vercel.json` | Clean URLs, translation/currency proxy routes, security headers |

## Security

Strict Content-Security-Policy (no inline scripts, no third-party scripts), `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, HSTS, locked-down Permissions-Policy. All translated text is rendered as plain text (never HTML), so a bad translation response cannot inject code. Table numbers and stored data are validated. No cookies, no personal data collected — the order lives only on the guest's phone.

## Known limits — read before going live

- **Translation engine**: uses Google Translate's free public endpoint (no key, no cost). It is unofficial; Google can rate-limit or change it. If it fails the app does not break — it shows English with a warning and a "Try again" button. For a production SLA, switch to the paid Google Cloud Translation API (needs a small serverless function and an API key).
- **Machine translation of dish names can be wrong.** That is why the original English name is always shown under the translated one, and the order screen for staff is in English.
- **Allergens**: the app only shows what you enter in `data-menu.js`. Guests are told to confirm allergies with the waiter.
- **Recommendations are regional taste heuristics**, not personal profiling. Guests can override them with the diet filters ("No pork" is pre-selected for some countries and can be switched off).
- **Exchange rates** come from open.er-api.com (free, daily). Shown as "≈" only; if unavailable, the approximate price is simply hidden.
- **Ordering is not sent to the kitchen.** The guest shows the screen to the waiter. Kitchen/POS integration needs a backend.
- Flag emojis do not render on Windows desktops (they show letters). Phones are fine.
