#!/usr/bin/env python3
"""Judge B: independent cross-provider judge (Anthropic) for the
disagreement-escalation experiment. One call per essay, generic rubric
prompt per family — deliberately NOT task-tuned; its job is independence."""
import argparse, concurrent.futures, json, os, re, sys, time, urllib.request

API = "https://api.anthropic.com/v1/messages"

EN_SYSTEM = """You are an expert, calibrated STAAR rater for {band} Extended Constructed Response essays (Texas). Score exactly as official TEA raters do, on two traits:

ORGANIZATION AND DEVELOPMENT OF IDEAS (0-3):
0 = lack of understanding of the writing purpose: no clear central idea or position, does not address the asked question (evidence irrelevant or answering a different question), no evident structure. Fluent length alone never prevents a 0.
1 = limited: central idea present but not developed; minimal/weak structure; little or vague evidence, insufficiently explained.
2 = partial: central idea with some real development; structure exists but limited/inconsistent; some relevant evidence not fully explained.
3 = thorough: clear central idea, consistent focus, purposeful structure with effective introduction and conclusion, specific relevant evidence clearly explained.
Ignore spelling/grammar/punctuation entirely for this trait. Calibrate to what is reasonable for {band} students writing on demand.

CONVENTIONS (0-2):
0 = little/no control: pervasive run-ons/fragments, missing capitalization and end punctuation across most of the response; errors impede clarity.
1 = inconsistent control: mix of correct and run-on/fragmented sentences; recurring errors that sometimes interfere.
2 = consistent command: sentences generally well constructed; a few errors that do not affect clarity.
Weight sentence-boundary mechanics (capitals, end punctuation, run-ons) at least as heavily as spelling density.

OFFICIAL RULE: if Ideas = 0 then Conventions = 0.
Respond ONLY with JSON: {{"dev_org": <0-3>, "conventions": <0-2>}}"""

ES_SYSTEM = """Eres un evaluador experto y calibrado de STAAR Spanish RLA (SLAR) para ensayos de grados 3-5. Califica EXACTAMENTE como los evaluadores oficiales de TEA:

ORGANIZACIÓN Y DESARROLLO DE IDEAS (0-3):
0 = falta de comprensión del propósito: sin idea central clara o sin responder a la pregunta planteada (evidencia irrelevante o responde a OTRA pregunta), sin estructura evidente. La fluidez o longitud nunca impiden un 0.
1 = comprensión limitada: idea central presente pero sin desarrollo; estructura mínima; poca evidencia o vaga.
2 = comprensión parcial: idea central con algo de desarrollo; estructura limitada; evidencia relevante pero no suficientemente explicada.
3 = comprensión completa: idea central clara, estructura intencional con introducción y conclusión, evidencia específica y claramente explicada.
Ignora ortografía/gramática/acentos por completo en este rasgo. Calibra al grado escolar (niño de 8-11 años).

CONVENCIONES (0-2):
0 = poco o ningún control: oraciones corridas por la mayor parte, sin mayúsculas ni puntos; los errores impiden la claridad.
1 = control inconsistente: mezcla de oraciones correctas y corridas; errores recurrentes.
2 = control consistente: oraciones bien construidas; pocos errores que no afectan la claridad. No cuentes tildes faltantes.

REGLA OFICIAL: si Ideas = 0, Convenciones = 0.
Responde SOLO con JSON: {{"dev_org": <0-3>, "conventions": <0-2>}}"""

BANDS = {"g35": "grades 3-5", "g68": "grades 6-8", "eoc": "high-school (grades 9-10 EOC)", "slar": None}

def call(key, system, essay):
    grade = essay.get("grade") or essay.get("grade_level") or essay.get("course") or ""
    user = (f"Grade/course: {grade}\n\nWriting task:\n{essay.get('prompt_text','')}\n\n"
            f"Student response (verbatim):\n<<<\n{essay.get('student_response','')}\n>>>\n\nScore with the indicated JSON.")
    body = {"model": "claude-sonnet-5", "max_tokens": 300, "system": system,
            "messages": [{"role": "user", "content": user}]}
    req = urllib.request.Request(API, data=json.dumps(body).encode(),
        headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                out = json.load(r)
            txt = "".join(b.get("text","") for b in out.get("content",[]))
            m = json.loads(re.search(r"\{.*\}", txt, re.S).group(0))
            d = max(0, min(3, int(m["dev_org"]))); c = max(0, min(2, int(m["conventions"])))
            if d == 0: c = 0
            return {"essay_id": essay["essay_id"], "dev_org": d, "conventions": c}
        except Exception as e:
            if attempt == 3:
                sys.stderr.write(f"[fail] {essay.get('essay_id')}: {e}\n")
                return {"essay_id": essay["essay_id"], "dev_org": 1, "conventions": 1, "fallback": True}
            time.sleep(2*(attempt+1))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--family", required=True)
    ap.add_argument("--dev", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    key = os.environ["ANTHROPIC_API_KEY"]
    system = ES_SYSTEM if a.family == "slar" else EN_SYSTEM.format(band=BANDS[a.family])
    essays = [json.loads(l) for l in open(a.dev) if l.strip()]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        rows = list(ex.map(lambda e: call(key, system, e), essays))
    with open(a.out, "w") as f:
        for r in rows: f.write(json.dumps(r)+"\n")
    print(f"{a.family}: {len(rows)} scored, {sum(1 for r in rows if r.get('fallback'))} fallbacks")

if __name__ == "__main__":
    main()
