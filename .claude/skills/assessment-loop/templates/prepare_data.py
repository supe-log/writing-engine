#!/usr/bin/env python3
"""Assessment-loop data preparation (generalized).

Splits a scored corpus three ways, leakage-safe, and quarantines the answers:
  train   -> workspace/data/train.jsonl        (full gold + rater rationales)
  dev     -> workspace/data/dev-responses.jsonl (responses ONLY, anonymized)
  secrets -> <secret dir>/dev-gold.jsonl + holdout.jsonl (+ salt.txt, MANIFEST)

Splits MUST be grouped (by time period, prompt family, or another field that
keeps related essays together) — random row-level splits leak prompt context
between train and test.

Leak guard (a measured lesson: essay ids and label fields have leaked gold
before): dev/holdout rows get salted opaque ids; the salt lives only in the
secret dir; every field in --strip is removed from public rows.

Usage:
  prepare_data.py --corpus corpus.jsonl --group-field year \
    --train 2023 --dev 2024 --holdout 2025 \
    --strip scores,tea_annotation,response_label --secret ../my-lab-secret
"""
import argparse
import hashlib
import json
import os


def write_jsonl(path, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        for r in rows:
            f.write(json.dumps(r, sort_keys=True) + '\n')
    h = hashlib.sha256(open(path, 'rb').read()).hexdigest()[:16]
    print(f'{path}  n={len(rows)}  sha256:{h}')
    return h


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--corpus', required=True)
    ap.add_argument('--group-field', required=True)
    ap.add_argument('--train', required=True, help='comma-separated group values')
    ap.add_argument('--dev', required=True)
    ap.add_argument('--holdout', required=True)
    ap.add_argument('--strip', default='scores', help='comma-separated fields removed from public rows')
    ap.add_argument('--secret', required=True, help='secret dir OUTSIDE the workspace')
    ap.add_argument('--lab', default=os.path.dirname(os.path.abspath(__file__)))
    args = ap.parse_args()

    strip = set(args.strip.split(','))
    rows = [json.loads(l) for l in open(args.corpus) if l.strip()]

    seen = set()
    for r in rows:
        assert r['essay_id'] not in seen, f"duplicate id {r['essay_id']}"
        seen.add(r['essay_id'])

    def group(vals):
        wanted = set(vals.split(','))
        return [r for r in rows if str(r[args.group_field]) in wanted]

    train, dev, holdout = group(args.train), group(args.dev), group(args.holdout)
    assert train and dev and holdout, 'every split must be non-empty'
    ids = lambda rs: {r['essay_id'] for r in rs}  # noqa: E731
    assert not (ids(train) & ids(dev)) and not (ids(train) & ids(holdout)) and not (ids(dev) & ids(holdout))
    for name, rs in (('train', train), ('dev', dev), ('holdout', holdout)):
        if len(rs) < 40:
            print(f'WARNING: {name} has only {len(rs)} rows — CI half-widths will exceed ~0.1; '
                  'treat gate decisions as provisional below ~40 per split.')

    os.makedirs(args.secret, exist_ok=True)
    salt_path = os.path.join(args.secret, 'salt.txt')
    if os.path.exists(salt_path):
        salt = open(salt_path).read().strip()
    else:
        salt = hashlib.sha256(os.urandom(32)).hexdigest()
        open(salt_path, 'w').write(salt)

    def anon(eid):
        return 'essay-' + hashlib.sha256((salt + eid).encode()).hexdigest()[:12]

    def public(rs):
        out = []
        for r in rs:
            pub = {k: v for k, v in r.items() if k not in strip}
            pub['essay_id'] = anon(r['essay_id'])
            out.append(pub)
        return out

    def secret(rs):
        out = []
        for r in rs:
            s = dict(r)
            s['original_essay_id'] = r['essay_id']
            s['essay_id'] = anon(r['essay_id'])
            out.append(s)
        return out

    write_jsonl(os.path.join(args.lab, 'workspace/data/train.jsonl'), train)
    write_jsonl(os.path.join(args.lab, 'workspace/data/dev-responses.jsonl'), public(dev))
    hashes = {'dev-gold': write_jsonl(os.path.join(args.secret, 'dev-gold.jsonl'), secret(dev)),
              'holdout': write_jsonl(os.path.join(args.secret, 'holdout.jsonl'), secret(holdout))}
    json.dump(hashes, open(os.path.join(args.secret, 'MANIFEST.json'), 'w'), indent=1)
    print('done. Now grep the PUBLIC dev file for anything that could reconstruct '
          'gold (score digits in ids, label fields) before running the loop.')


if __name__ == '__main__':
    main()
