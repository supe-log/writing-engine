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

run_dev_eval() { # $1 = label
  rm -f "$WS/out/predictions.jsonl"
  ( cd "$WS" && with_timeout "$ENGINE_TIMEOUT" bash engine/run.sh data/dev-responses.jsonl out/predictions.jsonl ) \
    > "$RUNS/$1.engine.log" 2>&1 || echo "[$1] engine exited nonzero (scoring whatever it wrote)"
  python3 "$LAB/harness/eval.py" --config "$CFG" \
    --pred "$WS/out/predictions.jsonl" --gold "$SECRET/dev-gold.jsonl" \
    --label "$1" --diagnostics-out "$WS/feedback/latest_diagnostics.json" \
    --append-log "$WS/experiments.jsonl"
}

floors_hold() { # $1 = metrics json; exit 0 if every floor holds
  python3 -c "
import json
m = json.loads('$1'); cfg = json.load(open('$CFG'))
traits = all(m.get(t['name']+'_lb', -1) >= t.get('floor_lb', $TRAIT_LB_FLOOR) for t in cfg['traits'])
ok = (m['total_lb'] >= $TARGET_LB and traits and m['zero_recall'] >= $ZERO_RECALL_FLOOR)
raise SystemExit(0 if ok else 1)"
}

for i in $(seq 1 "$MAX_ITERS"); do
  iter=$(printf 'iter-%02d' "$i")
  echo "=== $iter (best kept: $(cat "$BEST")) ==="

  prompt="Read task.md and follow the iteration protocol. You are $iter of $MAX_ITERS."
  lock_secret
  ( cd "$WS" && $AGENT_CMD -p "$prompt" $AGENT_FLAGS ) > "$RUNS/$iter.transcript.log" 2>&1
  unlock_secret

  if grep -q "$(basename "$SECRET")" "$RUNS/$iter.transcript.log"; then
    echo "[$iter] AUDIT FAIL: transcript references the secret path — discarding." | tee -a "$RUNS/audit.log"
    git -C "$WS" reset --hard best -q; git -C "$WS" clean -fdq -e out -e feedback; continue
  fi
  if [ ! -f "$WS/engine/run.sh" ]; then
    echo "[$iter] no engine/run.sh produced — discarding."
    git -C "$WS" reset --hard best -q; git -C "$WS" clean -fdq -e out -e feedback; continue
  fi

  evalout=$(run_dev_eval "$iter")
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
  else
    echo "[$iter] discarded ($metrics vs best $(cat "$BEST"))"
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
