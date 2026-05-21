# TreeVision Canopy Trim Pre-Estimator

A static, GitHub-ready browser app for starting preliminary tree canopy trimming estimates.

## What it does

- Uses one full-framed record photo to start the intake for a tree, shrub, bush, hedge, or mixed landscape item.
- Scores whether the one photo is strong enough for responsible preliminary scoping.
- Produces an "Obsessed One-Photo Scope" with included work, exclusions, finish standard, assumptions, and approval gate.
- Adds a bid-ready scope annotation block for each tree: tree ID, DBH, height, condition, risk target, equipment/access plan, utility/811 check, cleanup, priority, required photos, and "done means" acceptance language.
- Asks three simple customer questions:
  1. What do you want done?
  2. What cleanup do you want?
  3. Any access, utility, or safety concerns?
- Asks estimating and annotation questions:
  1. Tree size class
  2. Crew access
  3. Nearest target distance
  4. Tree ID / scope tag
  5. DBH and estimated height
  6. Observed condition and primary risk target
  7. Equipment/access method
  8. Utility or underground check
  9. Final "done means" completion standard
- Classifies likely service preset.
- Flags safety/site-visit triggers.
- Builds a cost-plus preliminary estimate range.
- Generates annotated photo zones, customer message, and internal crew notes.
- Builds a crew package with crew profile, stop-work triggers, approved/forbidden pruning language, and price assumptions.
- Adds a field app workspace for crew and owner modes, local saved job queue, GPS capture, share summary, JSON export, print packet, and completion checklist.
- Installs as a standalone browser app through the web manifest and caches the app shell for field use with poor signal.
- Requires human approval before final quote.

## Files

```text
index.html
styles.css
script.js
portal.html
portal.js
manifest.json
service-worker.js
treevision-icon.svg
README.md
```

## How to run locally

Open `index.html` in your browser.

For install/offline testing, serve the folder from a local web server:

```sh
python3 -m http.server 8097
```

Then open `http://127.0.0.1:8097`.

Open `portal.html` for the company client portal demo. It includes:

- company-specific portal navigation
- new photo scan intake
- client approval queue
- usage metering
- CSV usage export
- account limits and approval settings

## How to upload to GitHub

1. Create a new GitHub repository.
2. Upload these files:
   - `index.html`
   - `styles.css`
   - `script.js`
   - `README.md`
3. Commit the files.
4. Optional: Turn on GitHub Pages:
   - Go to repository `Settings`
   - Go to `Pages`
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
   - Save

## Customize pricing

Open `script.js` and edit:

```js
const DEFAULT_RATES = {
  laborRatePerCrewHour: 185,
  travelBaseCharge: 65,
  fuelCharge: 35,
  equipmentBaseCharge: 75,
  disposalPerCubicYard: 45,
  materialCharge: 15,
  overheadPercent: 0.18,
  profitMarginPercent: 0.22,
  minimumJobCharge: 350,
};
```

For better accuracy, compare the `expected` price against actual completed invoices and adjust:

- crew-hour multipliers
- debris yard estimates
- risk buffer percentages
- access multipliers
- minimum charge
- disposal rates
- profit margin

## Important disclaimer

This app produces a preliminary price range only. It is not a final arborist inspection, utility clearance approval, insurance decision, or final quote. Final scope, price, work method, and visual preview require authorized human approval.
