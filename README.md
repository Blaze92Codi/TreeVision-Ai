# TreeVision AI Annotated Estimate - Version 2A

A GitHub/Vercel-ready static website for preliminary tree canopy trimming estimates.

## What this version does

- Client/estimator uploads one full-framed record photo.
- User answers the three TreeVision customer questions:
  1. What do you want done?
  2. What cleanup do you want?
  3. Any access, utility, or safety concerns?
- User answers three pricing questions:
  1. Tree size class
  2. Access class
  3. Nearest target distance
- User can place annotation pins on the uploaded photo:
  - Crown Raising Zone
  - Clearance Pruning Area
  - Crown Cleaning / Deadwood Review
  - Selective Reduction Area
  - Target / Obstacle Area
  - Access Route
  - Drop Zone / Work Zone
  - Safety Review Flag
- The app generates a structured preliminary estimate report:
  - Job Snapshot
  - Intake Completeness
  - Missing Items
  - Photo Packet Score
  - Visible Tree/Shrub Review
  - Recommended Service Preset
  - Safety / Risk Flags
  - Quote Factor Breakdown
  - Preliminary Estimate Range
  - Confidence Level
  - Site Visit Decision
  - Customer Message Draft
  - Internal Crew Notes
  - Visual Preview Instructions
  - Human Approval Requirement
- User can export:
  - Annotated PNG
  - JSON estimate report
  - Print / save PDF from browser

## Important limitation

This is a static front-end app. It does not yet save leads, store photos, send emails, connect to Google Sheets, or connect to a CRM.

Final pricing, pruning method, safety plan, and customer-facing visual require authorized human approval.

## Deploy on Vercel

Use these Vercel settings:

```txt
Framework / Application Preset: Other
Root Directory: ./
Build Command: leave blank
Output Directory: .
Install Command: leave blank
```

Then click Deploy.

## File structure

```txt
index.html
styles.css
script.js
README.md
.gitignore
vercel.json
```

## Next recommended upgrade

Version 2B should add lead capture:

```txt
Client submits form
↓
Photo uploads to storage
↓
Estimate + annotations send to email
↓
Lead saves to Google Sheets / Airtable / CRM
↓
Manager approves final quote
```

Recommended backend options:

- Pipedream
- Supabase
- Firebase
- Airtable
- Google Apps Script
- Custom Vercel serverless function
