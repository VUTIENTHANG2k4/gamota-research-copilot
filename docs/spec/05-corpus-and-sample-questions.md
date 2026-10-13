# Corpus and sample questions

Part of the gamota-research-copilot spec; see `docs/SPEC.md` for the index.

## 10. Test corpus

20-30 documents, stored as snapshots with URL and access date:

| Group | Count | Content |
|---|---|---|
| A. Strong sources | 6 | Industry reports with methodology, legal documents, officially published data |
| B. Press | 6 | Business and technology articles |
| C. Weak sources | 4 | Publisher PR articles, forum posts |
| D. Planted traps | 5 | Old figures reposted as new; 3 articles quoting one press release; two reports with different measurement definitions; two genuinely conflicting sources; an unrelated document |
| E. Simulated internal | 3 | Simulated operational data, **clearly labelled as simulated** |

**Honesty note:** real documents must come from public sources, with URL and date. Self-written trap documents must be labelled "synthesised for testing" (SYNTHETIC) and must never be presented as real market figures.

**Real sources found so far** (search on 12/10/2026, not yet read in full; re-verify when collecting):

- Scale conflict (Q2): a [Gamota report](https://www.pocketgamer.biz/vietnams-mobile-games-market-reached-825m-in-revenue-in-2025) via PocketGamer.biz states USD 825 million mobile game revenue in Vietnam for 2025. [GameGeek](https://vietnamnews.vn/economy/1720441/gaming-industry-eyes-over-430-million-revenue-this-year.html) via Vietnam News states about USD 315 million for 2024 for games published by Vietnamese studios, a different measurement scope. A Statista excerpt states a much lower figure for 2024, with an unclear update date.
- Draft versus in force (Q3): [VOH](https://voh.com.vn/xa-hoi/gioi-han-thoi-gian-choi-game-cua-nguoi-duoi-18-tuoi-567266.html) describes the current rule under Decree 147/2024/NĐ-CP as 60 minutes per game and 180 minutes per day for people under 18. [LSVN](https://lsvn.vn/du-kien-gioi-han-thoi-gian-choi-game-trong-ngay-voi-tre-em-a176381.html) describes a draft amendment proposing 60 minutes per day for people under 16.
- Conflict of interest: the USD 825 million report is published by Gamota itself, so the rubric must deduct for conflict of interest even though the report has a methodology.

## 11. Sample questions

The pipeline runs on the Vietnamese originals; English is for reference only.

| ID | Question (Vietnamese original) | English reference | Purpose |
|---|---|---|---|
| Q1 | Có nên làm game idle RPG cho mobile Việt Nam năm sau không? | Should we build an idle RPG for Vietnamese mobile next year? | Full flow, several evidence types |
| Q2 | Quy mô doanh thu mobile game Việt Nam gần nhất là bao nhiêu? | What is the most recent revenue size of Vietnamese mobile games? | Conflict from different definitions |
| Q3 | Quy định hiện hành về phát hành game online tại Việt Nam là gì? | What are the current regulations on publishing online games in Vietnam? | Freshness, official sources |
| Q4 | Retention D7 của game X của Gamota quý gần nhất là bao nhiêu? | What was the D7 retention of Gamota's game X last quarter? | No data, must refuse |
| Q5 | Người chơi phàn nàn gì nhiều nhất về game đối thủ Y? | What do players complain about most in competitor game Y? | Qualitative signal, no scale extrapolation |
