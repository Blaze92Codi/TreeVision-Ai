# TreeVision Canopy Trim Pre-Estimator

A static, GitHub-ready browser app for starting preliminary tree canopy trimming estimates.

## What it does

- Uses one full-framed record photo to start the intake.
- Asks three simple customer questions:
  1. What do you want done?
  2. What cleanup do you want?
  3. Any access, utility, or safety concerns?
- Asks three simple estimating questions:
  1. Tree size class
  2. Crew access
  3. Nearest target distance
- Classifies likely service preset.
- Flags safety/site-visit triggers.
- Builds a cost-plus preliminary estimate range.
- Generates customer message and internal crew notes.
- Requires human approval before final quote.

## Files

```text
index.html
styles.css
script.js
README.md
```

## How to run locally

Open `index.html` in your browser.

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
