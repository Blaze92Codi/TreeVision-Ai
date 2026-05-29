# AI Healthcare CE / Certification Auto-Ingest

Reads certificate PDFs/images, extracts the key details with AI, and appends
**draft** rows into the `CE Log` sheet of
`Michigan_Healthcare_CE_Certification_AI_Tracker.xlsx` for human review.

Supports Michigan EMS, OTA, social work, First Aid/CPR/BLS, and Stop the Bleed
tracker fields.

> ⚠️ **Human review is required before using any entry for license renewal.**
> Every ingested row defaults to `Review Status = Needs Review` and
> `Count for Renewal = No`.

## Setup

```bash
pip install -r requirements.txt
export OPENAI_API_KEY="sk-..."
# Optional: override the default model (gpt-4o-mini)
export OPENAI_MODEL="gpt-4o-mini"
```

Image (OCR) inputs also require the Tesseract binary on the system:

```bash
# Debian/Ubuntu
sudo apt-get install tesseract-ocr
# macOS
brew install tesseract
```

## Usage

1. Place certificate files (`.pdf`, `.png`, `.jpg`, `.jpeg`, `.tiff`, `.bmp`)
   into `certificates_inbox/`.
2. Ensure `Michigan_Healthcare_CE_Certification_AI_Tracker.xlsx` (with a
   `CE Log` sheet) is in the working directory.
3. Run:

   ```bash
   python ce_auto_ingest.py
   ```

4. Files that process successfully move to `certificates_processed/`; files
   that fail move to `certificates_error/`. New draft rows appear in the
   `CE Log` sheet for review.

## Folders (created automatically)

| Folder                     | Purpose                                  |
| -------------------------- | ---------------------------------------- |
| `certificates_inbox/`      | Drop certificates here to be processed   |
| `certificates_processed/`  | Successfully processed source files      |
| `certificates_error/`      | Files that failed extraction/parsing     |

## Notes

- Uses the OpenAI **Responses API** with JSON output.
- A confidence gate forces `Needs Review` whenever AI confidence is below
  `0.80` or the model did not mark the row `Ready`.
- CPR/BLS/First Aid expiration dates are auto-derived only when missing, and
  are always flagged in notes to "verify card".
