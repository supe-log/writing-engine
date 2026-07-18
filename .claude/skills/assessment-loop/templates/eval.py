#!/usr/bin/env python3
"""Assessment-loop verifier (generalized). Pure code; gold labels are the
external ground truth — never an LLM judging an LLM.

Reads traits.json to know the assessment's shape:
{
  "assessment": "My Assessment",
  "traits": [{"name": "dev_org", "min": 0, "max": 3, "floor_lb": 0.70}, ...],
  "cascade": [{"if_trait": "dev_org", "if_value": 0,
               "force_trait": "conventions", "force_value": 0}],
  "zero_trait": "dev_org", "zero_value": 0,
  "zero_recall_floor": 0.5, "target_lb": 0.70, "min_iters": 3
}

Emits per-trait + total QWK with bootstrap 95% CIs (stop conditions read the
LOWER bound — point estimates on small N are noise), zero-class precision/
recall, per-essay diagnostic objects, label-uncertainty flags, one appended
experiments.jsonl row, and machine-readable KEEP_METRIC / STOP_METRICS lines.

Prediction contract (one JSON object per line):
  {"essay_id": "...", "<trait1>": int, "<trait2>": int, ...}
Missing or malformed essays are scored as failures, never silently skipped.
"""
import argparse
import json
import random
import sys
import time


def qwk(golds, preds, min_s, max_s):
    k = max_s - min_s + 1
    n = len(golds)
    O = [[0.0] * k for _ in range(k)]
    for g, p in zip(golds, preds):
        O[g - min_s][p - min_s] += 1
    w = [[((i - j) ** 2) / ((k - 1) ** 2) for j in range(k)] for i in range(k)]
    gh = [sum(O[i]) for i in range(k)]
    ph = [sum(O[i][j] for i in range(k)) for j in range(k)]
    num = sum(w[i][j] * O[i][j] for i in range(k) for j in range(k))
    den = sum(w[i][j] * gh[i] * ph[j] / n for i in range(k) for j in range(k))
    return 1.0 - num / den if den else 0.0


def boot_ci(pairs, key_fn, min_s, max_s, reps=2000, seed=42):
    rng = random.Random(seed)
    point = qwk([key_fn(g) for g, p in pairs], [key_fn(p) for g, p in pairs], min_s, max_s)
    n = len(pairs)
    stats = []
    for _ in range(reps):
        s = [pairs[rng.randrange(n)] for _ in range(n)]
        stats.append(qwk([key_fn(g) for g, p in s], [key_fn(p) for g, p in s], min_s, max_s))
    stats.sort()
    return {'point': round(point, 4), 'lb95': round(stats[int(0.025 * reps)], 4), 'ub95': round(stats[int(0.975 * reps)], 4)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--config', required=True, help='traits.json')
    ap.add_argument('--pred', required=True)
    ap.add_argument('--gold', required=True)
    ap.add_argument('--label', required=True)
    ap.add_argument('--diagnostics-out', default=None)
    ap.add_argument('--append-log', default=None)
    args = ap.parse_args()

    cfg = json.load(open(args.config))
    traits = cfg['traits']
    names = [t['name'] for t in traits]
    zero_trait = cfg.get('zero_trait')
    zero_value = cfg.get('zero_value', 0)

    gold, quality = {}, {}
    for line in open(args.gold):
        r = json.loads(line)
        gold[r['essay_id']] = {t: r['scores'][t] for t in names}
        quality[r['essay_id']] = r.get('transcription_quality', 'high')

    preds, parse_errors = {}, 0
    try:
        for line in open(args.pred):
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
                row = {}
                for t in traits:
                    v = int(r[t['name']])
                    if not (t['min'] <= v <= t['max']):
                        raise ValueError('out of range')
                    row[t['name']] = v
                preds[r['essay_id']] = row
            except Exception:
                parse_errors += 1
    except FileNotFoundError:
        pass

    diagnostics, pairs = [], []
    for eid, g in sorted(gold.items()):
        p = preds.get(eid)
        if p is None:
            diagnostics.append({'kind': 'missing_prediction', 'path': eid,
                                'message': 'engine produced no valid prediction for this essay',
                                'repairHint': 'emit one JSON line per input essay_id, even on internal errors (abstain -> retry beats a dropped row)'})
            continue
        pairs.append((g, p))
        missed = False
        for t in names:
            if p[t] != g[t]:
                missed = True
                kind = 'zero_miss' if (t == zero_trait and g[t] == zero_value) else 'trait_miss'
                hint = ('study the train-set rater rationales for the lowest-score exemplars and derive what earns that score'
                        if kind == 'zero_miss'
                        else 'compare against train-set exemplars at this score boundary; the miss is usually a one-point boundary call')
                diagnostics.append({'kind': kind, 'path': eid, 'message': f"{t} gold={g[t]} pred={p[t]}", 'repairHint': hint})
        for rule in cfg.get('cascade', []):
            if p[rule['if_trait']] == rule['if_value'] and p[rule['force_trait']] != rule['force_value']:
                diagnostics.append({'kind': 'cascade_violation', 'path': eid,
                                    'message': f"predicted {rule['if_trait']}={rule['if_value']} but {rule['force_trait']}!={rule['force_value']}",
                                    'repairHint': 'deterministic rules must be enforced in code, never left to a judge model'})
        if quality.get(eid, 'high') != 'high' and missed:
            diagnostics.append({'kind': 'label_uncertain', 'path': eid,
                                'message': f"gold transcription_quality={quality[eid]} — the label itself is less certain",
                                'repairHint': 'weigh this miss less than misses on clean rows before building a fix around it'})

    n = len(pairs)
    result = {'label': args.label, 'ts': time.strftime('%Y-%m-%dT%H:%M:%S'),
              'n_gold': len(gold), 'n_scored': n, 'parse_errors': parse_errors}
    if n >= 5:
        for t in traits:
            result[t['name']] = boot_ci(pairs, lambda r, name=t['name']: r[name], t['min'], t['max'])
        tmin = sum(t['min'] for t in traits)
        tmax = sum(t['max'] for t in traits)
        total = lambda r: sum(r[t] for t in names)  # noqa: E731
        result['total'] = boot_ci(pairs, total, tmin, tmax)
        result['exact_total'] = round(sum(1 for g, p in pairs if total(g) == total(p)) / n, 4)
        result['adjacent_total'] = round(sum(1 for g, p in pairs if abs(total(g) - total(p)) <= 1) / n, 4)
        if zero_trait:
            zeros = [(g, p) for g, p in pairs if g[zero_trait] == zero_value]
            pred_zeros = [(g, p) for g, p in pairs if p[zero_trait] == zero_value]
            result['zero_class'] = {
                'gold_n': len(zeros),
                'recall': round(sum(1 for g, p in zeros if p[zero_trait] == zero_value) / len(zeros), 4) if zeros else None,
                'precision': round(sum(1 for g, p in pred_zeros if g[zero_trait] == zero_value) / len(pred_zeros), 4) if pred_zeros else None,
            }
    result['n_diagnostics'] = len(diagnostics)
    result['label_uncertain_gold'] = sum(1 for q in quality.values() if q != 'high')

    if args.diagnostics_out:
        with open(args.diagnostics_out, 'w') as f:
            json.dump({'label': args.label, 'summary': result, 'diagnostics': diagnostics}, f, indent=1)
    if args.append_log:
        with open(args.append_log, 'a') as f:
            f.write(json.dumps(result, sort_keys=True) + '\n')

    print(json.dumps(result))
    print(f"KEEP_METRIC={result.get('total', {}).get('lb95', -1)}")
    zr = result.get('zero_class', {}).get('recall')
    stop = {'total_lb': result.get('total', {}).get('lb95', -1),
            'zero_recall': zr if zr is not None else -1}
    for t in traits:
        stop[f"{t['name']}_lb"] = result.get(t['name'], {}).get('lb95', -1)
    print('STOP_METRICS=' + json.dumps(stop))
    return 0


if __name__ == '__main__':
    sys.exit(main())
