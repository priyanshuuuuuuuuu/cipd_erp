# CiPD 360 ERP — Fix Handoffs

Use these documents to start **separate chat sessions**, each focused on one domain. Paste the **Prompt Starter** section from the bottom of each doc into a new agent chat.

| Document | Scope | Issues |
|----------|--------|--------|
| **[HANDOFF_ATTENDANCE_ANALYSIS.md](./HANDOFF_ATTENDANCE_ANALYSIS.md)** | **Full attendance deep-dive** — dual systems, pipelines, scoring, APIs, fixes, tests | ATT-1 … ATT-9 + timezone |
| [HANDOFF_ATTENDANCE.md](./HANDOFF_ATTENDANCE.md) | Attendance fix checklist (shorter) | ATT-1 … ATT-7 |
| [HANDOFF_FEEDBACK.md](./HANDOFF_FEEDBACK.md) | Submit guards, deadlines, rollout, analytics, cron reminders | FDB-1 … FDB-4 + rollout/cron |
| [HANDOFF_FEATURES.md](./HANDOFF_FEATURES.md) | Faculty portal, assignments, materials, profile, session cancel | FEA-1 … FEA-7 |
| [HANDOFF_WIRING.md](./HANDOFF_WIRING.md) | UI ↔ API mismatches, tokens, notifications bell, upload helper | WIR-1 … WIR-8 |

**Codebase root:** `cipd_erp/client-next/`

**Suggested chat split:**

1. **Attendance chat** — unify `attendance_records` with student UI; enforce `mac_verified`
2. **Feedback chat** — duplicate prevention + deadline enforcement + rollout deadline fix
3. **Features chat** — pick one of FEA-1, FEA-2, FEA-6 per session
4. **Wiring chat** — WIR-1 + WIR-2 first (assignments + notification bell)

Some work overlaps (e.g. WIR-1 + FEA-2, WIR-3 + FEA-4, WIR-4 + FEA-1) — do wiring first or in the same chat.
