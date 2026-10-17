# Personal Offer Workspace — Functional Foundation

Branch: feature/personal-offer-workspace

## Product goal

A personal command center for finding suitable client opportunities and managing each offer from discovery through human-reviewed outreach and ongoing conversation. The interface prioritizes a calm light theme, compact but readable information density, fast navigation, and clear next actions.

## What this branch introduces

- A new workspace shell with persistent navigation for My Flow, Funnel, Offer Studio, Knowledge Base, and Sources & Settings.
- A unified lead list with search, source and stage filters, priority/newest sorting, match-score cues, and source labels.
- A funnel board organized by the existing lead statuses.
- A lead detail drawer with Overview, Offer, and Activity tabs.
- An editable offer draft with generation instructions, save, copy, regenerate, and source-opening actions.
- One-click triggers for the existing HH.ru, Telegram, freelance, and Avito collectors, plus a combined collection action.
- Existing knowledge-base and settings screens remain available.

## Current implementation boundaries

This is a frontend foundation built on the current API and database model. It does not pretend that unavailable backend capabilities already exist.

- Collection buttons call the existing trigger endpoints. The UI refreshes after a short delay; proper polling, run IDs, per-source progress, retries, and durable run history remain backend work.
- The current backend status vocabulary is reused. A later schema migration should formalize stage transitions and split outreach preparation, clipboard copy, opening the target page, confirmed manual submission, and verified response into distinct events.
- Offer editing currently saves to the existing generated_offer field. Version history, snapshots of source data, case provenance, and audit events need dedicated data structures.
- The Activity tab clearly identifies that a complete event log is not yet implemented.
- Sending remains manual. Copying a draft or opening a source must never be treated as proof that a message was actually submitted.

## Recommended next vertical slices

1. **Data contracts and event history**
   - Add durable collector-run records and source health.
   - Add activity events for stage changes, generation, editing, copying, and human-confirmed outreach.
   - Add offer versions with model, instructions, case references, source snapshot, and created timestamp.
2. **Reliable ingestion**
   - Make collection triggers idempotent and return a run identifier.
   - Poll run status rather than assuming a fixed completion time.
   - Surface partial failures and preserve successful results from other sources.
   - Strengthen cross-source deduplication without merging separate jobs from the same company.
3. **Offer quality**
   - Use factual, versioned case retrieval.
   - Add checks for invented claims, generic phrases, missing evidence, and platform-appropriate length.
   - Preserve human edits and allow regeneration into a separate version rather than silently overwriting.
4. **Outreach and client lifecycle**
   - Separate lead, company/client, contact, offer, outreach attempt, and next action.
   - Store follow-up date, response state, outcome reason, and deal value.
   - Keep manual confirmation until a platform-specific, permitted send integration is genuinely available.
5. **Verification**
   - Run frontend build and type checks.
   - Test loading/error/empty states, filters, status changes, offer save/generate, and source failures.
   - Add backend tests for state transitions, deduplication, and truthful outreach state.

## Acceptance criteria for the first foundation milestone

- A morning workflow can refresh the lead list and start all available collectors from one place.
- The user can search and filter leads without losing the current context.
- Each lead opens a detail drawer with original source, score rationale, source description, stage, and offer editor.
- Draft generation and saving are separate from outreach; no UI action claims a message was sent unless that fact is confirmed.
- A failed collector does not block the other collectors from running.
- The app remains usable on desktop and narrower screens, with a clear empty state and visible errors.
