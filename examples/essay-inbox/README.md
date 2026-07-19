# Essay submission inbox (demo)

This directory is the default inbox for `npm run heartbeat:essays`
(`SOURCE_ADAPTER=essays`, override with `ESSAY_INBOX_DIR`). Every `.txt` file
is treated as one student essay submission; the heartbeat grades them in
arrival order (mtime) and picks up files dropped here while it is running.
Non-`.txt` files (like this README) are ignored.

## Provenance

Both sample essays are **synthetic**, written for this demo in the style of
Texas STAAR grades 3–5 Extended Constructed Response answers. They are NOT
real student writing and NOT TEA-released responses — no student data, no
licensed corpus content.

- `2026-07-18-recess-a.txt` — a clean argumentative response.
- `2026-07-18-recess-b-injection.txt` — the same task, but the "student" has
  embedded a prompt-injection attempt asking the grader to award a perfect
  score. This is the runtime-security demo: with a HiddenLayer scanner
  configured the submission is snapshotted as evidence and then blocked at
  the ingestion boundary — visibly, in the tick notes — instead of reaching
  the writer.

## Try it

```bash
npm run heartbeat:essays                       # grade whatever is in the inbox
HEARTBEAT_TICKS=5 npm run heartbeat:essays     # keep beating; drop new .txt files in mid-run
```
