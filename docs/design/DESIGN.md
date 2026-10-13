# DESIGN.md: gamota-research-copilot UI

Single source of truth for the UI (P5). The visual sketch has been approved by the user: artifact "gamota-research-copilot: bản phác Memo và đoạn gốc" (one Memo screen with a source-passage side panel). If this file and the sketch differ, ask the user. Figures in the sketch are illustrative only; the real UI shows only data from the API.

All visible UI text is in **Vietnamese** (the Vietnamese strings in the sketch are the reference copy). This document is in English.

## Principles

1. The memo is the main document; everything else exists to verify the memo.
2. Clicking a claim or source chip opens the source passage beside it, with the figures highlighted.
3. Confidence is a banded level with a reason, never a percentage.
4. Weak states (Low, conflict, "Chưa đủ căn cứ", inference, SYNTHETIC) must be easy to see, never faded.
5. Colour never stands alone: source grades always carry the letter A-D, confidence always carries text.
6. A calm, document-like interface with a single accent colour.

## Fonts

| Used for | Font | Note |
|---|---|---|
| All text, headings, numbers | Inter 400/500/600/700 | OFL licence, supports Vietnamese. Fallback: system-ui |
| Claim IDs (C-014), uppercase labels, scores | IBM Plex Mono 400/500 | ASCII characters only |

Sizes: body 15px (line-height 1.6); conclusion 26px/1.35, weight 600, letter-spacing -0.015em; large figures 24px/600 with `tabular-nums`; captions 13px; section labels 12px mono, uppercase, letter-spacing 0.06em.

## Colour tokens

| Token | Value | Used for |
|---|---|---|
| `bg` | #EEF2F5 | Page background |
| `surface` | #FFFFFF | Cards, memo panel |
| `surface-subtle` | #F6F8FA | Secondary blocks, quotes |
| `border` | #D5DDE5 | Card borders |
| `text` | #12202C | Main text |
| `text-muted` | #4A5B6A | Secondary text |
| `accent` | #0E5A6B | Section labels, primary button, active tab (alternatives: #1F4E9C, #5B3F8C, #2E6B3A) |
| `warn-bg` / `warn-text` / `warn-border` | #FCEBC8 / #4A3000 / #B97A00 | Low confidence, grade C, illustrative banner |
| `danger-bg` / `danger-text` | #F8DAD3 / #8A2A1A | Grade D, rejected claim, reject action |
| `ok-bg` / `ok-text` | #DDF3E7 / #0B5A33 | Grade A/B, confirmed, passed citation check |
| `highlight` | #FFE49A | Figures inside the source passage |

Grade A/B use `ok`, C uses `warn`, D uses `danger`; always show the text "Hạng X" (Grade X). If dark mode is added, redefine every token; do not auto-invert.

## Layout

- Page width up to about 1360px, horizontal padding 32px. Two columns: memo (wide, minimum 640px) and source-passage panel (minimum 380px). Below about 1000px the panel moves under the memo; small screens must never scroll horizontally.
- Cards: 1px `border`, 12px radius, 24-40px padding. Gap between blocks 24-28px.
- Header: logo + project name (mono), MVP badge, step bar (Brief, Evidence store, Reconciliation, Memo; the current step underlined in `accent`), the question being viewed.
- Buttons: minimum height 44px, 8px radius, 14px/600 text. Primary: `accent` fill; secondary: `text` outline; destructive: `danger-text` outline.

## Key components

- **Honesty banner:** a `warn-bg` bar at the top when illustrative data, SYNTHETIC documents or an unreviewed version is shown. The SYNTHETIC banner is never removed.
- **Claim chip:** pill with mono ID + grade + review state (check mark or "đã loại"). Selected: `text` fill, white text.
- **Confidence band:** four cells (Chưa đủ căn cứ, Thấp, Trung bình, Cao); the current cell has a heavier border and bold text; a "Why ..." line is always visible.
- **Point:** one sentence + claim chip on the right. Inference sentences: a dashed-border "SUY LUẬN" tag, italic, muted colour.
- **Conflict:** two cards side by side (source, year, scope, figure), below them the cause and a suggestion of which figure to use for which purpose.
- **Chưa đủ căn cứ (not enough evidence):** a dashed-border block with a dashed-circle icon, stating what is missing and plainly that the system does not estimate.
- **Source-passage panel:** claim ID + grade; title and metadata (source, reposted from, publish date, data date, number of independent sources); verbatim quote with figures in `highlight`; a citation-check line (icon + text, not colour only); a "Why grade X" table with each criterion's score and the total; a review row: Xác nhận (Confirm), Loại khỏi memo (Remove from memo), Hoàn tác (Undo).
- **Memo footer:** states that the memo was compiled by AI and passed the automatic citation check, and that the reader should open the source passage before using it; shows the number of analyst-confirmed claims; Export Word and Export PDF buttons. Exports carry the limitations note.

## Special states

Each needs its own design that says plainly what happened: not enough evidence, model-call error, timeout, citation check failed (claim rejected, reason shown), empty corpus. Never replace them with fake content.

## Accessibility

Text/background contrast at least 4.5:1; real `<button>`/`<a>` elements; visible focus; no emoji, icons are stroke SVG; every state has accompanying text.
