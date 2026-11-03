# 🧾 Receipt Detective

A daily browser puzzle. Each day you get one real receipt (a photo plus a digital copy) with the store and date blurred out. Guess the year from the prices, then the region for bonus points, and share your result.

## How it plays

The daily puzzle rotates through the real receipts in `real.js`. The receipt generator (`receipt.js`, `data.js`) is still in the repo but no longer shown on the page.

- Guess the year (1950–2025) on a slider. You get 4 guesses; landing within 2 years solves it.
- Each miss gives a hotter/colder hint and reveals more: two more items, then the subtotal and tax line, then the receipt's original printing style (handwritten slip, purple register tape, dot matrix or thermal).
- Bonus round: pick the region (Northeast, Midwest, South, West) on a tile map.
- The reveal shows the real year and state, a then-vs-now price comparison against 2025, the clues you could have caught, and a spoiler-free share card.
- "Practice receipt" plays random receipts that don't count toward stats. `?practice=<number>` links to a specific practice receipt.

## How it works

Everything is static: no server, no build step.

| File | What it does |
| --- | --- |
| `index.html` | Page layout |
| `style.css` | Page styles and the four era receipt styles |
| `data.js` | Staple price series, CPI, branded products with launch/retire years and regions, state tax rates |
| `receipt.js` | Seeded generator and renderer: picks the day's year and region, builds a single-year basket, rounds prices the way stores did |
| `real.js` | Real receipt photos with transcriptions, masks and clues |
| `game.js` | Guess flow, region map, reveal, share, stats (saved in `localStorage`) |

Puzzle #1 is November 2, 2026. Daily years come from a shuffled deck of all 76 years, so every year appears once per 76-day cycle. Regions rotate in blocks of four days.

## About the data

Staple prices (eggs, milk, bread, ground beef, coffee, bananas, sugar, butter, potatoes, chicken, flour, bacon) are approximations anchored on BLS average-price series and interpolated between anchor years. Branded items are scaled from a 2025 shelf price by CPI. State tax histories are simplified. All of it is good enough to feel right, and the obvious next step is to replace the anchors in `data.js` with exact BLS series (and regional series where BLS publishes them).

## Real receipts

`real.js` holds real receipts of any kind (grocery, restaurant, store purchase, service), played from the "Real receipts" switch. Each one shows the photo and a digital copy, uncovered clue by clue. To add one:

- It must come from a credible source: a photo shared with permission, or an archive item that is public domain or openly licensed (credit it).
- It needs a reliable year, a US location and at least 4 line items with readable, reasonable prices. Entries with fewer are skipped automatically.
- Blur private details (card numbers, transaction IDs, barcodes, names) into the image file itself.
- Add the transcribed `items`, totals, photo masks and clues.

Generated daily receipts also mix in non-grocery items such as health products, small appliances, electronics and household goods, each with its own launch and retirement years.

## Run locally

```sh
python3 -m http.server
# open http://localhost:8000
```

## Host on GitHub Pages

Settings → Pages → Source: "Deploy from a branch" → Branch: `main`, folder `/ (root)`.
