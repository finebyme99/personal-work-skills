---
name: lark-weekly-brief-publish
description: Generate and safely publish a concise team weekly brief from Lark/Feishu calendars, tasks, chats, documents, and meeting artifacts. Use when the user asks for a 周报、周速览、要闻速览、团队周度进展，especially when the workflow must distinguish the user's or named team members' work, use evidence from multiple Lark sources, render a message/card, send a test version, and require approval before a formal-group send.
---

# Lark Weekly Brief Publish

Produce an evidence-backed weekly brief and move it through a test-to-production publishing gate. Treat collection, editorial judgment, and sending as separate stages.

## Required skills

Read and follow the installed Lark skills for every surface used. Always read `lark-shared`; then read only the relevant skills among `lark-calendar`, `lark-task`, `lark-im`, `lark-doc`, `lark-vc`, `lark-note`, and `lark-minutes`.

## Workflow

### 1. Resolve the run contract

Determine:

- Reporting interval and timezone. Default to the previous completed Monday–Sunday in `Asia/Shanghai`; compute dates with a system date tool.
- Subject scope: the user, explicitly named team members, or both.
- Output template, priority order, test group, formal group, and sending profile.
- Whether the request is draft-only, test-send, or formal-send.

Never silently broaden the subject scope. Do not attribute another person's work to the user. Include a team member's work only when that person is explicitly in scope.

### 2. Preflight before expensive collection

Verify configured identity, required permissions, group access, and bot membership before collecting all sources.

- Use existing authenticated profiles. Never search configuration files for secrets, print secrets, or place secrets in command arguments, prompts, logs, or deliverables.
- Fix the sending profile for the run; do not silently substitute another bot.
- Fail early with the shortest recovery action when the chosen bot cannot access the target group.
- For scheduled runs, verify the stored next-run time in the intended timezone, not only the recurrence text.

### 3. Collect source evidence

Collect the smallest sufficient evidence set within the interval:

1. Tasks completed, advanced, blocked, or newly assigned.
2. Calendar events that show decisions, reviews, launches, or milestones.
3. Relevant chats from known project/team groups.
4. Project documents and meeting artifacts containing decisions, metrics, or deliverables.

Paginate all relevant result sets. Exclude casual chat, repeated bot messages, future plans presented as completed work, and facts outside the date range.

Build an internal evidence ledger before drafting:

| Candidate item | Owner | Date | Status | Evidence source | Confidence |
| --- | --- | --- | --- | --- | --- |

Require at least one direct source for every published item. Use two sources when ownership, status, or metrics conflict. Mark unresolved facts for user review instead of guessing.

### 4. Select actual “news”

Keep items that contain a material milestone, decision, measurable result, launch, validated conclusion, risk, or next-step commitment. Drop routine activity with no meaningful change.

Rank by user-supplied priority; otherwise rank by business impact, cross-team relevance, and recency. Merge duplicate mentions into one item while preserving the strongest evidence and the correct owner.

### 5. Draft in the user's house style

Write plain, compact Chinese unless the user requests otherwise.

- Start each item with `项目/主题：本周结论`.
- Follow with one or two sentences covering evidence, impact, and the next decisive step.
- Prefer exact dates, counts, percentages, and named deliverables.
- Remove process narration, inflated language, and generic praise.
- Generate title dates and reporting ranges dynamically; never reuse a previous run's hard-coded date.

Return a short “needs confirmation” section for low-confidence facts. Do not place uncertain facts in the publishable card body.

### 6. Render and verify

Follow the user's provided template. If none exists, use a compact Lark card or Markdown message with a title, grouped items, and reporting interval.

Validate:

- Title date, reporting range, item order, owner scope, and metrics.
- Card JSON or message structure before sending.
- Client-supported card components and color enums. Do not assume arbitrary CSS or RGBA styling works in Lark cards.

### 7. Publish through gates

Use this state machine:

`draft → test sent → user-approved → formal sent`

- A scheduled run may collect, draft, and send to the configured test group.
- Never send to the formal group without explicit approval for that exact version.
- After approval, send the unchanged approved version with the same fixed bot identity.
- Report target group, send time, and message ID.

If a sent card needs changes, explain whether in-place editing is supported. Recalling a message is a destructive action: require explicit `撤回并重发` or equivalent confirmation unless the user already gave that exact instruction.

### 8. Record run integrity

Store or report a stable run key consisting of interval, subject scope, target group, and content hash when the surrounding system supports it. Use it to prevent duplicate formal sends.

For failures, report the failed stage, what completed, what did not change externally, and the smallest safe recovery action. Never downgrade silently from the selected identity, source scope, or formal-send gate.
