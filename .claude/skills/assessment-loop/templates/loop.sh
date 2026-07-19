#!/usr/bin/env bash
# assessment-loop driver (generalized): run -> measure -> keep/discard ->
# repeat, no human in the inner loop.
#
# Anatomy (trigger -> action -> stop): each iteration invokes a fresh headless
# agent on workspace/task.md with the previous iteration's diagnostics; the
# verifier (pure code + frozen human labels) scores the dev set; keep/discard
# is multi-objective; the stop condition is multi-floor (a measured lesson:
# a total-only stop once declared victory at iteration 1 and the holdout
# refuted it); the frozen holdout is scored exactly once, at the end.
#
# Expects: workspace/{task.md, traits.json, data/...}, harness/eval.py,
# a sibling secret dir with dev-gold.jsonl + holdout.jsonl (see prepare_data).
set -uo pipefail
cd "$(dirname "$0")"

# ---------------- CONFIG ----------------
MAX_ITERS=${MAX_ITERS:-12}          # hard budget (fixed budget per run)
TARGET_LB=${TARGET_LB:-0.70}        # total-QWK CI lower bound target
MIN_ITERS=${MIN_ITERS:-3}           # never stop before this many iterations
TRAIT_LB_FLOOR=${TRAIT_LB_FLOOR:-0.70}      # default per-trait floor (traits.json floor_lb overrides per trait)
ZERO_RECALL_FLOOR=${ZERO_RECALL_FLOOR:-0.5}
CONFIRM_REPEAT=${CONFIRM_REPEAT:-0} # 1 = re-run dev once; floors must hold on the repeat before stopping
ENGINE_TIMEOUT=${ENGINE_TIMEOUT:-900}
AGENT_CMD=${AGENT_CMD:-claude}
AGENT_FLAGS=${AGENT_FLAGS:---permission-mode acceptEdits --allowedTools "Bash(*),Read,Write,Edit,Glob,Grep" --max-turns 60}
HOLDOUT_STRIP=${HOLDOUT_STRIP:-scores,tea_annotation,verification_notes,response_label,original_essay_id}
# -----------------------------------------

LAB="$PWD"
WS="$LAB/workspace"
SECRET=${SECRET_DIR:-"$(dirname "$LAB")/$(basename "$LAB")-secret"}
RUNS="$LAB/runs"
CFG="$WS/traits.json"
mkdir -p "$RUNS" "$WS/feedback" "$WS/engine" "$WS/notes" "$WS/out"

[ -f "$SECRET/dev-gold.jsonl" ] || { echo "run prepare_data.py first (no $SECRET/dev-gold.jsonl)"; exit 2; }
[ -f "$CFG" ] || { echo "missing $CFG (traits config)"; exit 2; }

with_timeout() { perl -e 'alarm shift; exec @ARGV' "$@"; }
lock_secret()   { chmod -R 000 "$SECRET" 2>/dev/null || true; }
unlock_secret() { chmod -R 700 "$SECRET" 2>/dev/null || true; }
trap unlock_secret EXIT

if [ ! -d "$WS/.git" ]; then
  git -C "$WS" init -q
  git -C "$WS" add -A && git -C "$WS" commit -qm "baseline: data + task, no engine"
  git -C "$WS" tag best
fi

# Keep/discard state: full STOP_METRICS of the last kept config.
BEST="$LAB/.best.json"
[ -f "$BEST" ] || echo '{"total_lb": -1, "zero_recall": -1}' > "$BEST"

# Feature-detect --extra on the verifier once (older eval.py templates lack
# it); harness metadata is nice-to-have and must never break a scoring run.
EVAL_HAS_EXTRA=0
python3 "$LAB/harness/eval.py" --help 2>/dev/null | grep -q -- '--extra' && EVAL_HAS_EXTRA=1

run_dev_eval() { # $1 = label, $2 = optional JSON metadata merged into the log row
  rm -f "$WS/out/predictions.jsonl"
  ( cd "$WS" && with_timeout "$ENGINE_TIMEOUT" bash engine/run.sh data/dev-responses.jsonl out/predictions.jsonl ) \
    > "$RUNS/$1.engine.log" 2>&1 || echo "[$1] engine exited nonzero (scoring whatever it wrote)"
  # Poisoned-round guard: fewer than half the expected prediction rows means a
  # BROKEN round (crash/outage), not evidence about the engine idea — do not
  # score it, so garbage never reaches the journal or the keep gate.
  local expected got
  expected=$(wc -l < "$WS/data/dev-responses.jsonl" | tr -d ' ')
  got=0; [ -f "$WS/out/predictions.jsonl" ] && got=$(wc -l < "$WS/out/predictions.jsonl" | tr -d ' ')
  if [ "$got" -lt $((expected / 2)) ]; then
    echo "BROKEN_ROUND rows=$got expected=$expected"
    return 0
  fi
  if [ "$EVAL_HAS_EXTRA" = "1" ] && [ -n "${2:-}" ]; then
    python3 "$LAB/harness/eval.py" --config "$CFG" \
      --pred "$WS/out/predictions.jsonl" --gold "$SECRET/dev-gold.jsonl" \
      --label "$1" --diagnostics-out "$WS/feedback/latest_diagnostics.json" \
      --append-log "$WS/experiments.jsonl" --extra "$2"
  else
    python3 "$LAB/harness/eval.py" --config "$CFG" \
      --pred "$WS/out/predictions.jsonl" --gold "$SECRET/dev-gold.jsonl" \
      --label "$1" --diagnostics-out "$WS/feedback/latest_diagnostics.json" \
      --append-log "$WS/experiments.jsonl"
  fi
}

floors_hold() { # $1 = metrics json; exit 0 if every floor holds
  python3 -c "
import json
m = json.loads('$1'); cfg = json.load(open('$CFG'))
traits = all(m.get(t['name']+'_lb', -1) >= t.get('floor_lb', $TRAIT_LB_FLOOR) for t in cfg['traits'])
ok = (m['total_lb'] >= $TARGET_LB and traits and m['zero_recall'] >= $ZERO_RECALL_FLOOR)
raise SystemExit(0 if ok else 1)"
}

# Anti-memorization scan input: the fixed dev id list (opaque salted ids; an
# engine that hardcodes ANY of them is cheating regardless of opacity).
python3 -c "
import json
[print(json.loads(l)['essay_id']) for l in open('$WS/data/dev-responses.jsonl')]" > "$LAB/.dev-ids" 2>/dev/null || true

# Stall counter: consecutive discards. After 2+, the next builder is told to
# change the CATEGORY of its approach — the measured failure mode of stuck
# loops is polite no-op variations on the same falsified idea.
STALL=0

for i in $(seq 1 "$MAX_ITERS"); do
  iter=$(printf 'iter-%02d' "$i")
  ITER_T0=$(date +%s)
  echo "=== $iter (best kept: $(cat "$BEST"); stall=$STALL) ==="

  prompt="Read task.md and follow the iteration protocol. You are $iter of $MAX_ITERS."
  if [ "$STALL" -ge 2 ]; then
    prompt="$prompt NOTE: the last $STALL iterations were DISCARDED. Do not try another variation of the same idea — change the CATEGORY of your approach (e.g., structural component instead of prompt wording, different trait, variance reduction, or combining two prior near-misses). Deleting complexity that keeps metrics equal is also a win."
  fi
  lock_secret
  ( cd "$WS" && $AGENT_CMD -p "$prompt" $AGENT_FLAGS ) > "$RUNS/$iter.transcript.log" 2>&1
  unlock_secret

  if grep -q "$(basename "$SECRET")" "$RUNS/$iter.transcript.log"; then
    echo "[$iter] AUDIT FAIL: transcript references the secret path — discarding." | tee -a "$RUNS/audit.log"
    git -C "$WS" reset --hard best -q; git -C "$WS" clean -fdq -e out -e feedback; continue
  fi
  # Anti-memorization audit: no dev essay id may appear in engine source.
  if [ -s "$LAB/.dev-ids" ] && grep -rFf "$LAB/.dev-ids" "$WS/engine/" 2>/dev/null | grep -q .; then
    echo "[$iter] AUDIT FAIL: engine hardcodes dev essay ids — discarding." | tee -a "$RUNS/audit.log"
    git -C "$WS" reset --hard best -q; git -C "$WS" clean -fdq -e out -e feedback; continue
  fi
  if [ ! -f "$WS/engine/run.sh" ]; then
    echo "[$iter] no engine/run.sh produced — discarding."
    git -C "$WS" reset --hard best -q; git -C "$WS" clean -fdq -e out -e feedback; continue
  fi

  ITER_DUR=$(( $(date +%s) - ITER_T0 ))
  evalout=$(run_dev_eval "$iter" "{\"duration_s\": $ITER_DUR, \"stall\": $STALL}")

  if echo "$evalout" | grep -q '^BROKEN_ROUND'; then
    echo "[$iter] BROKEN ROUND ($(echo "$evalout" | grep '^BROKEN_ROUND')) — not scored." | tee -a "$RUNS/audit.log"
    STALL=$((STALL + 1))
    git -C "$WS" reset --hard best -q; git -C "$WS" clean -fdq -e out -e feedback
    continue
  fi

  echo "$evalout" | head -1
  metrics=$(echo "$evalout" | sed -n 's/^STOP_METRICS=//p')

  # Keep or discard: total LB must improve AND zero recall must not regress
  # (-1 on either side means "not measured" and never blocks).
  verdict=$(python3 -c "
import json
best = json.load(open('$BEST')); m = json.loads('$metrics')
keep = m['total_lb'] > best['total_lb'] and (
    best['zero_recall'] < 0 or m['zero_recall'] < 0 or m['zero_recall'] >= best['zero_recall'])
print('keep' if keep else 'discard')")
  if [ "$verdict" = "keep" ]; then
    echo "$metrics" > "$BEST"
    git -C "$WS" add -A && git -C "$WS" commit -qm "$iter: KEPT ($metrics)"
    git -C "$WS" tag -f best
    echo "[$iter] KEPT ($metrics)"
    STALL=0
  else
    echo "[$iter] discarded ($metrics vs best $(cat "$BEST"))"
    STALL=$((STALL + 1))
    # Preserve loop memory (log, diagnostics, learnings journal — without the
    # journal, future iterations blindly retry falsified ideas).
    cp "$WS/experiments.jsonl" "$LAB/.exp.keep" 2>/dev/null || true
    cp "$WS/feedback/latest_diagnostics.json" "$LAB/.diag.keep" 2>/dev/null || true
    cp "$WS/notes/learnings.md" "$LAB/.learn.keep" 2>/dev/null || true
    git -C "$WS" reset --hard best -q; git -C "$WS" clean -fdq -e out
    mv "$LAB/.exp.keep" "$WS/experiments.jsonl" 2>/dev/null || true
    mkdir -p "$WS/feedback" "$WS/notes"
    mv "$LAB/.diag.keep" "$WS/feedback/latest_diagnostics.json" 2>/dev/null || true
    mv "$LAB/.learn.keep" "$WS/notes/learnings.md" 2>/dev/null || true
    git -C "$WS" add -A && git -C "$WS" commit -qm "$iter: discarded engine change; kept log+diagnostics+learnings" -q
    git -C "$WS" tag -f best
  fi

  # Multi-floor stop: minimum iterations AND every floor holds on the best.
  if [ "$i" -ge "$MIN_ITERS" ] && floors_hold "$(cat "$BEST")"; then
    if [ "$CONFIRM_REPEAT" = "1" ]; then
      echo "[$iter] floors met — confirmation repeat..."
      git -C "$WS" reset --hard best -q
      confirmout=$(run_dev_eval "$iter-confirm")
      cmetrics=$(echo "$confirmout" | sed -n 's/^STOP_METRICS=//p')
      if ! floors_hold "$cmetrics"; then
        echo "[$iter] confirmation repeat FAILED floors ($cmetrics) — continuing."
        continue
      fi
    fi
    echo "TARGET MET: all floors hold on $(cat "$BEST")"; break
  fi
done

# ---- Final: score the frozen holdout ONCE with the best kept engine. ----
echo "=== FINAL: holdout (never seen, scored once) ==="
git -C "$WS" reset --hard best -q
python3 -c "
import json
strip = '$HOLDOUT_STRIP'.split(',')
with open('$LAB/.holdout-responses.jsonl', 'w') as out:
    for l in open('$SECRET/holdout.jsonl'):
        r = json.loads(l)
        for k in strip: r.pop(k, None)
        out.write(json.dumps(r) + '\n')
"
rm -f "$WS/out/holdout-predictions.jsonl"
( cd "$WS" && with_timeout "$ENGINE_TIMEOUT" bash engine/run.sh "$LAB/.holdout-responses.jsonl" out/holdout-predictions.jsonl ) > "$RUNS/final.engine.log" 2>&1 || true
python3 "$LAB/harness/eval.py" --config "$CFG" \
  --pred "$WS/out/holdout-predictions.jsonl" --gold "$SECRET/holdout.jsonl" \
  --label FINAL-HOLDOUT --append-log "$WS/experiments.jsonl" | tee "$LAB/FINAL.txt"
echo "Claim only the holdout number. A large dev-over-holdout gap = the loop memorized its dev set."
