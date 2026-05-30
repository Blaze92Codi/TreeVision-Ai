# TreeVision AI — Brand Voice Guidelines

> **Scope note (read this first):** These guidelines are reverse-engineered from the customer-facing copy in this codebase: `web/index.html`, `web/admin.html`, `worker/src/notify.ts`, and the Claude prompt in `worker/src/analyze.ts`. They are **not** based on sales calls, founder interviews, marketing assets, or social content — none of those exist in the project yet. Treat this as a strong v1 derived from product UX writing. Re-run `/brand-voice:generate-guidelines` with discovery materials when those sources exist.
>
> **Source documents analyzed:** 3 (product UX copy, transactional emails, AI assessment prompt)
> **Voice attributes extracted:** 12
> **Overall confidence:** Moderate (high for product/UX surfaces, low for marketing/sales surfaces).

---

## 1. Brand-in-one-sentence

We're an **AI-powered tree-service estimator** that gives homeowners a professional-grade quote from a phone photo, then books the work — replacing the awkward "wait for the truck to show up" step that defines the industry.

**Personality:** the calm, credentialed arborist who happens to be good with technology — not the slick tech startup that happens to know trees.

---

## 2. "We Are / We Are Not" table

| We Are | We Are Not |
|---|---|
| Plainspoken professionals | Corporate or jargony |
| Confident in our AI, honest about its limits | Hyped or "revolutionary" |
| Credentialed (ANSI A300, ISA, insured) | Cowboy / "two-guys-and-a-truck" |
| Concrete and concise — "photograph each tree," "1 tree per photo" | Vague — "leverage solutions to optimize outcomes" |
| Warm via contractions ("we'll," "we'd," "you're") | Stiff or aloof |
| Honest about price ranges ("$425 – $925") | Misleading with bait-and-switch headline prices |
| Process-transparent (we name each AI step) | Mysterious black-box AI |
| Gentle in nudges ("Add 1 more tree to unlock 10%") | Pushy or salesy ("BUY NOW!") |
| Mobile-first, scannable, bulleted | Wall-of-text marketing pages |
| Em-dash–friendly for natural pauses | Comma-spliced run-ons |
| Calm in safety language ("Live crown removal not to exceed 25%") | Fear-mongering ("YOUR TREE COULD FALL") |
| Sparing with emoji — one 🌳 as the hero mark | Emoji-stuffed |

**Confidence:** High — these patterns appear consistently across landing, cart, review, contact, scheduling, and confirmation screens.

---

## 3. Tone-by-context matrix

| Context | Tone | Sentence length | Example |
|---|---|---|---|
| Landing / hero | Confident, inviting | Short, paired | "Walk your property, photograph each tree." → "Get a full estimate in minutes — no on-site visit needed." |
| Photo upload | Instructional, friendly | Tight imperatives | "Tap to photograph." "Stand back so the full tree fits in frame." |
| Analyzing screen | Technical, transparent | Verb phrases as labels | "Identifying tree species." "Marking deadwood & hazards on photo." |
| Tree review (AI results) | Clinical-with-warmth | Mixed — facts in cards, observations in bullets | "What we observed" → bulleted arborist notes |
| Cart / budget | Encouraging, math-transparent | Short with visible math | "Subtotal (2 trees) $1,300 – $2,500" + "Add 1 more tree to unlock 10% bundle discount" |
| Contact form | Brief, purposeful | Single-line headlines | "Where should we send this?" → "We'll email your estimate and call to confirm before the visit." |
| Booked confirmation | Warm celebration | One ! allowed | "You're all booked!" → "We'll see you at your scheduled time." |
| Error states | Matter-of-fact, no blame | One sentence + remedy | "Please try a different photo." |
| Disclaimers | Honest, specific | One line each, cite the standard | "AI visual estimate per ANSI A300 standards. Final pricing confirmed on-site by ISA Certified Arborist." |
| Operator dashboard | Terse, data-dense | Labels not sentences | "Estimates · Booked · Final-price todo · Revenue (final)" |

**Confidence:** High for everything except sales/marketing-page tone, which we don't have copy for yet.

---

## 4. Vocabulary: do / don't

### Words we use

| Use | Why |
|---|---|
| **Estimate** (not "quote") | Friendlier, less transactional |
| **Photograph** (not "take a picture") | Slightly elevated register signals professionalism |
| **ANSI A300**, **ISA Certified**, **DBH**, **crown spread**, **risk rating** | Technical terms double as credibility markers — never hide them, always cite |
| **Tree / trees** | Concrete; never "vegetation," "specimens," "assets" |
| **Bundle & save** | Consumer-recognizable, neutral |
| **Walk your property** | Action-first metaphor; the product *is* the walk |
| **We'll**, **we'd**, **you're** | Contractions soften authority |
| **Confirmed on-site** | The recurring honesty qualifier on every price claim |

### Words we avoid

| Avoid | Reason |
|---|---|
| "Revolutionary," "game-changing," "leverage," "solutions" | Empty SaaS-speak; sounds like every other startup |
| "Quote" (in marketing copy) | OK on internal/legal pages; on customer surfaces use "estimate" |
| "Cheap," "best price," "lowest" | Race-to-the-bottom framing — we compete on accuracy and professionalism |
| "Guaranteed price" | We always say ranges + "confirmed on-site" |
| "Click here" | Use action verbs in the link itself |
| Emoji walls | One 🌳 hero is the mark; per-screen icons (📸, ✅, 📅) are functional, not decorative |
| Exclamation points everywhere | Reserve for genuine celebration moments (max one per screen) |

**Confidence:** High for product surfaces, Medium for marketing surfaces (extrapolated).

---

## 5. Structural patterns

- **Sentences average 8–12 words** in headlines and CTAs. Long sentences appear only in disclaimers, and they're always followed by the cite.
- **Em-dash for parenthetical thought:** "AI analyzes each one — and marks what we'd do." Preferred over parens or commas for the same job.
- **Price formatting:** always a range, always with thousand separators, always `$X,XXX – $X,XXX` (em-dash with spaces).
- **Time formatting:** weekday + month-day + time-with-zone — "Wed, Jun 3, 11:00 AM" — never bare timestamps.
- **Lists:** bulleted with ✓ for tips/benefits, with ▸ for arborist observations, no numbered lists outside of process steps.
- **CTAs:** verb + object + arrow when forward navigation — "Start your estimate →" / "Add to estimate →".

**Confidence:** High.

---

## 6. Credibility playbook

Every customer-facing claim about price, safety, or process is backed by a citation. The three reliable trust markers:

1. **ANSI A300 (Part 1–9)** — pruning, removal, treatment standards. Cite the relevant part where possible: "ANSI A300 Part 1 — Pruning" for trim, "Part 6" for treatment.
2. **ISA (International Society of Arboriculture)** — credentials and Z133 safety standard for removals.
3. **Insured + licensed crew** — short trust chip on landing.

These appear in three places at minimum: landing trust badges, results disclaimer, package descriptions. They're never decorative — they always link to a specific claim (price, method, safety).

**Confidence:** High.

---

## 7. Emotional register

We are calm. Tree services often arrive with two emotions in the air: customer anxiety ("is this expensive? will they damage my house?") and operator transactional rush. Our job is to lower both.

- **Anxiety reducers:** transparent process, named steps, price ranges (not single numbers), "confirmed on-site" honesty, ANSI cites.
- **Rush reducers:** save-and-resume link, "we'll confirm within an hour" (not "URGENT — book now"), gentle bundle nudges rather than countdown timers.
- **Never use:** scarcity tactics, urgency language, fear copy about falling branches, before/after gore.

**Confidence:** High — backed by the absence of any urgency/scarcity language across the codebase, which is itself a deliberate choice.

---

## 8. AI-as-character

The AI itself has a voice in this product — the analysis prompt frames it as "a professional ISA Certified Arborist." That framing should hold in any customer-facing AI surfaces (chat, follow-up SMS, voice if added):

- Identifies as the company's AI assistant, not as "Claude" or "an AI model"
- Cites standards when it makes claims
- Defers to human arborist for final pricing
- Surfaces uncertainty honestly ("estimated 18–22 in DBH" not "exactly 18 in")
- Never apologizes excessively or hedges every sentence — confident in its lane, deferential outside it

**Confidence:** Medium — derived from the assessment prompt only; no agent/chat copy exists yet.

---

## 9. Differentiation positioning

When writing comparative copy (which we haven't yet), the contrast points are:

| TreeVision | Competition (typical local tree service) |
|---|---|
| Estimate in 60 seconds from your phone | Wait 3–5 days for a truck to show up |
| Itemized per-tree, bundled total, transparent math | Verbal "I'll get back to you with a number" |
| Cited standards (ANSI A300) on every estimate | "We've been doing this 20 years, trust us" |
| Save link, come back, finish later | One-shot in-person visit |

Lead with the *time* angle (no on-site visit) over the *price* angle (cheaper). Time is the more universal pain point.

**Confidence:** Medium — derived from product positioning, not from competitive research.

---

## 10. Open questions (needs founder input)

These are intentional gaps where the in-product copy doesn't give us enough signal:

1. **What's the founder's voice for long-form content?** (About page, founder story, blog) — Nothing in the codebase informs this.
2. **How playful are we allowed to be?** The product copy is restrained-warm. Is the brand willing to be funnier on social, or do we hold the calm-professional line everywhere?
3. **Do we name our AI?** Currently it's just "TreeVision AI" or "AI." Some brands name their AI (Erica at BofA, Aria at Opera) — should we?
4. **First-person plural vs singular?** All current copy is "we" (the company). If voice chat or a named AI launches, does it speak as "I"?
5. **How direct can we be in sales follow-up?** The 48h SMS reads "Hi {first}, Dynamic Tree Service here — your tree estimate ($X–$Y) is still waiting if you'd like to book. Anything we can answer?" Is this the right balance, or should it push harder?
6. **Voice for the operator-facing side** (admin dashboard, ops emails). It currently reads as terse internal tooling. Is that the right register, or do we want the same calm-professional voice the customer sees?
7. **What's our stance on competitor naming?** Some local services we'd happily contrast with; others we wouldn't.

I recommend running `/brand-voice:discover-brand` once you have any of: a founder bio, a Notion brand doc, sales call recordings, or an existing About-page draft.

---

## 11. Quick reference card (for `/brand-voice:enforce-voice`)

```
Voice:    plainspoken professional, credentialed, calm
Tone:     confident-but-qualified, warm-via-contractions, no hype
Length:   short. headlines 6-10 words. sentences ≤12.
Lexicon:  estimate (not quote). photograph (not take a pic).
          ANSI A300, ISA Certified, DBH, risk rating — cite always.
Avoid:    revolutionary, leverage, solutions, guaranteed, cheap,
          emoji walls, exclamation points except for celebration.
Cite:     every price claim with "confirmed on-site"
          every method claim with the ANSI A300 part
          every credential claim with ISA / licensure
Format:   prices as $X–$Y ranges with em-dash
          times as "Wed, Jun 3, 11:00 AM"
          em-dashes for parenthetical thoughts
          ✓ for tips, ▸ for arborist observations
CTAs:     verb + object + arrow ("Start your estimate →")
```
