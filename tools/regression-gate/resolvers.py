#!/usr/bin/env python3
"""Escalation resolvers for disagreement essays.

Resolver MED3: third judge C (gpt-4.1, generic gate prompt) -> per-trait
median(A,B,C). Resolver ANCHOR: dev_org via anchor-referenced placement
against three gold train exemplars (gpt-4o), conventions via median(A,B,C).
Agree essays always keep Judge A (the engine). Cascade enforced in code."""
import concurrent.futures, json, os, re, sys, time, urllib.request

G = "/Users/loganwork/Projects/hackathons/regression-gate"
OPENAI = "https://api.openai.com/v1/chat/completions"

def openai_call(model, system, user, key, max_tokens=500):
    body = {"model": model, "temperature": 0.0, "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    req = urllib.request.Request(OPENAI, data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                out = json.load(r)
            return json.loads(re.search(r"\{.*\}", out["choices"][0]["message"]["content"], re.S).group(0))
        except Exception:
            if attempt == 3: raise
            time.sleep(2*(attempt+1))

def median3(a, b, c): return sorted([a, b, c])[1]

def main(family):
    key = os.environ["OPENAI_API_KEY"]
    fams = json.load(open(f"{G}/families.json"))
    f = fams[family]
    dis = json.load(open(f"{G}/results/{family}-disagreement.json"))
    dev = {json.loads(l)["essay_id"]: json.loads(l) for l in open(os.path.join(f["lab"], f["dev"]))}
    train = [json.loads(l) for l in open(os.path.join(f["lab"], f["train"]))]

    # Judge C reuses judge_b prompt text (OpenAI side)
    import importlib.util
    spec = importlib.util.spec_from_file_location("jb", f"{G}/judge_b.py")
    jb = importlib.util.module_from_spec(spec); spec.loader.exec_module(jb)
    c_system = jb.ES_SYSTEM if family == "slar" else jb.EN_SYSTEM.format(band=jb.BANDS[family])

    # anchors: median-length gold dev_org 1, 2, 3 from train
    anchors = {}
    for lvl in (1, 2, 3):
        cands = sorted([t for t in train if t["scores"]["dev_org"] == lvl],
                       key=lambda t: len(t["student_response"]))
        if cands: anchors[lvl] = cands[len(cands)//2]
    es = family == "slar"
    anc_txt = "\n\n".join(
        (f"EJEMPLO CALIBRADO — Ideas = {lvl} (calificación oficial):\n<<<\n{a['student_response']}\n>>>" if es else
         f"CALIBRATED EXAMPLE — Ideas = {lvl} (official score):\n<<<\n{a['student_response']}\n>>>")
        for lvl, a in anchors.items())
    anc_system = ("Eres un evaluador experto de STAAR. Coloca la respuesta del estudiante RELATIVA a los ejemplos calibrados según el desarrollo de ideas (idea central, estructura, evidencia explicada). Ignora la ortografía. Responde SOLO JSON: {\"placement\": <0-3>} donde 0 = claramente peor que el ejemplo de 1 (sin comprensión del propósito)."
                  if es else
                  "You are an expert STAAR rater. Place the student response RELATIVE to the calibrated examples by development of ideas (central idea, structure, explained evidence). Ignore spelling/grammar. Respond ONLY JSON: {\"placement\": <0-3>} where 0 = clearly worse than the score-1 example (lack of understanding of the purpose).")

    def resolve(rec):
        eid = rec["eid"]; e = dev[eid]
        grade = e.get("grade") or e.get("grade_level") or e.get("course") or ""
        user = (f"Grade/course: {grade}\n\nWriting task:\n{e.get('prompt_text','')}\n\n"
                f"Student response (verbatim):\n<<<\n{e.get('student_response','')}\n>>>\n\nScore with the indicated JSON.")
        out = {"eid": eid}
        try:
            c = openai_call("gpt-4.1", c_system, user, key)
            c_d = max(0, min(3, int(c["dev_org"]))); c_c = max(0, min(2, int(c["conventions"])))
        except Exception:
            c_d, c_c = rec["a_d"], rec["a_c"]  # C fails -> neutral (A's vote twice)
        med_d = median3(rec["a_d"], rec["b_d"], c_d)
        med_c = median3(rec["a_c"], rec["b_c"], c_c)
        if med_d == 0: med_c = 0
        out["med3"] = {"dev_org": med_d, "conventions": med_c}
        try:
            pa_user = anc_txt + "\n\n" + ("RESPUESTA A COLOCAR:" if es else "RESPONSE TO PLACE:") + \
                      f"\n<<<\n{e.get('student_response','')}\n>>>\n\nTask/prompt:\n{e.get('prompt_text','')[:1200]}"
            p = openai_call("gpt-4o", anc_system, pa_user, key)
            an_d = max(0, min(3, int(p["placement"])))
        except Exception:
            an_d = med_d
        an_c = med_c if an_d != 0 else 0
        out["anchor"] = {"dev_org": an_d, "conventions": an_c}
        return out

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        resolved = {r["eid"]: r for r in ex.map(resolve, dis["disagree"])}

    A = {json.loads(l)["essay_id"]: json.loads(l) for l in open(f"{G}/preds/{family}-baseline.jsonl")}
    for variant in ("med3", "anchor"):
        with open(f"{G}/preds/{family}-{variant}.jsonl", "w") as fh:
            for eid, a in A.items():
                row = {"essay_id": eid, "dev_org": a["dev_org"], "conventions": a["conventions"]}
                if eid in resolved:
                    row.update(resolved[eid][variant])
                fh.write(json.dumps(row)+"\n")
    print(f"{family}: resolved {len(resolved)} disagreements; variants written")

if __name__ == "__main__":
    main(sys.argv[1])
