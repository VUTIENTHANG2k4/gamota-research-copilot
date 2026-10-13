# Answers to the 3 mandatory questions (draft)

Part of the gamota-research-copilot spec; see `docs/SPEC.md` for the index. The contest submission itself is written in Vietnamese; this is the English working draft.

## 14. Draft answers

**Question 1. The most important piece and why it is feasible**

I chose the engine that turns sources into evidence-backed statements: extracting claims with verifiable citations, grading sources, handling conflicts and missing data, then generating a memo with a confidence level. This is the riskiest piece because AI easily errs in a convincing way. If the system proves that every number in the memo traces back to the original passage, weak sources do not raise confidence, and questions without data are refused correctly, then the core question "both trustworthy and useful for decisions" has an answer at small scale. The remaining pieces are source expansion and experience.

**Question 2. Changes versus Mission 1**

In the MVP design I changed four things. One, dropped live web crawling and used a frozen corpus so tests are repeatable. Two, the confidence label is no longer written by the AI but computed by explicit rules in code. Three, added a code citation check, because the original plan trusted the AI to attach the right source. Four, added a direct-answer LLM baseline to have comparison evidence. The shared reason: if it cannot be measured, we cannot know where the product is good. **This section must be extended with changes that arise after real runs.**

**Update 13/10/2026.** After confirming with the user, four more changes: the model changed to Nemotron 3 Ultra via OpenRouter, so the multi-local-model trial is dropped and the new model's JSON-schema support must be measured; the UI moved to full Next.js, so it is placed after testing in the build order; added a mandatory honesty rule (never hide limitations, a Known limitations page); added scenario T9 and split the work into phases with approval gates. This section still needs changes that arise after real runs.

**Question 3. The scenario handled least well**

My prediction: scenario T7, figures inside PDF tables or charts, or in a different unit, currency or definition. The expected cause is in the document-reading step (the PDF reader breaks tables) and the definition-normalisation step, not in the language model. With more time I would prioritise: a dedicated table extractor, a dictionary that normalises units and definitions, and forcing analyst confirmation for numeric claims with low confidence. **This is a hypothesis and must be updated after the test results.**
