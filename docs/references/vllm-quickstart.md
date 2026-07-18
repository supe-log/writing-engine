# vLLM QuickStart (hackathon technical reference)

> **What this is.** A hackathon technical reference for wiring the
> production-model ports (see [architecture.md](../architecture.md#extension-seams))
> against an OpenAI-compatible vLLM endpoint. It is **not** documentation of an
> implemented integration — the Writing Engine ships no vLLM code. The `Researcher`,
> `Writer`, and `RubricEvaluator` demo adapters are deterministic heuristics; vLLM
> is a documented seam only.
>
> **Provenance & caveats.** This reference was derived from **three presentation
> slides** (Red Hat–branded) on the linked Notion page, extracted 2026-07-18. The
> statistics, model names, ports, and config flags below are **point-in-time
> presentation content** — they reflect what those slides showed on that date, not
> a maintained spec. Treat every number and command as illustrative; verify
> against the upstream [vLLM docs](https://docs.vllm.ai/) before relying on it.

**Source:** [vLLM QuickStart — Notion Page](https://expensive-date-2f9.notion.site/vLLM-QuickStart-3a0213393e85808dbe14e8d832156c43)
**Extracted:** 2026-07-18
**Presentation slides:** 3 (Red Hat–branded, black background with red headings)

---

## Page Structure

The Notion page titled **"vLLM QuickStart"** contains three embedded slide-image blocks (screenshots of a presentation). There are no text blocks outside the slide images, no toggle blocks, no child pages, no attachments, and no additional outbound links beyond those visible inside the slide images. The only interactive elements on the page are the site navigation bar and three embedded figure blocks.

---

## Slide 1 — vLLM Overview

> **Diagram description:** A light-background infographic slide. The vLLM logo (stylized colourful "v") appears in the header followed by the tagline. Five stat-badge boxes run in a row across the top. Below, two columns present "Get started in two commands" (left, with a black terminal block) and "2,900+ contributors from 50+ major companies" (right, with a grid of company logos). A second row shows "Diverse Project ecosystem" (left) and "Broad model support — 200+ architectures" + "Wide hardware support — 15+ platforms" (right).

### Tagline

**vLLM = an ecosystem of models, accelerators, and frameworks**

> The high-throughput, memory-efficient open source inference engine for LLMs — Apache 2.0, hosted in the PyTorch Foundation.

### Key Statistics

> _Point-in-time presentation figures (2026-07-18); not a maintained metric._

| Metric                                                      | Value      |
| ----------------------------------------------------------- | ---------- |
| GitHub stars                                                | **85K+**   |
| PRs per month                                               | **2,000+** |
| Deployed GPU hours, every day                               | **20M+**   |
| Members in [slack.vllm.ai](https://slack.vllm.ai)           | **15K+**   |
| Deploy guides on [recipes.vllm.ai](https://recipes.vllm.ai) | **140+**   |

### Get Started in Two Commands

```bash
$ uv pip install vllm --torch-backend=auto
$ vllm serve deepseek-ai/DeepSeek-V3.2 -tp 8
```

### Community

**2,900+ contributors from 50+ major companies** including (logos visible):
Meta, (unknown), Zendesk/Z, IBM, Red Hat, (security company), LinkedIn, CoreWeave, Huawei, Microsoft, Google, (unknown),
AMD, Oracle, CoreWeave, (unknown), (unknown), Thinking Machines, (emoji/smiley), Amazon, Karpenter,
(unknown), NVIDIA, OpenAI, Spotify, (unknown), Snowflake, Xiaomi, embedded, Roblox, Intel,
Anyscale, ARM, AI21 Labs, Tencent

### Diverse Project Ecosystem

- **llm-d**
- **vLLM-Omni**
- **GuideLLM**
- **LLM Compressor**
- **PECULATORS**
- **Recipes**
- **vLLM Semantic Router**
- **compressed-tensors**
- **agentic-api**

### Broad Model Support — 200+ Architectures

(Architecture/framework logos including Meta, (others), Google, MistralAI, (others), ...)

### Wide Hardware Support — 15+ Platforms

Logos visible: **NVIDIA**, **AMD**, **Intel**, **Google**, **AWS**, **Ampere (A)**, **ARM**,
**Apple**, **MeetaX**, **rebellions\_**, **IBM**, **Cambricon**, **Baidu**, **...**

---

## Slide 2 — Install vLLM from Source & Process Requests

> **Diagram description:** Dark (black) background slide with two columns and Red Hat branding (bottom-right). Left column: "Install vLLM from source" (red heading) with shell commands, then "Developer Hints" (red heading) with annotated shell commands. Right column: "Process Requests" (red heading) with a `curl` JSON example and a Python3 REPL example. Slide number "2" appears bottom-left.

### Install vLLM from Source

```bash
$ git clone https://github.com/vllm-project/vllm
$ VLLM_USE_PRECOMPILED=1 uv pip install -e .
```

### Developer Hints

```bash
# incremental build kernels
$ cmake --build --preset release --target install

# add `breakpoint()`s
$ VLLM_ENABLE_V1_MULTIPROCESSING=0

# resolve install issues for older versions of vLLM
$ vllm install --torch-backend=cu129
```

### Process Requests

#### via `curl` (OpenAI-compatible API)

```bash
$ curl http://localhost:8089/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "RedHatAI/Hy3-NVFP4-FP8",
        "messages": [{
            "role": "user",
            "content": "Explain quantum computing."
        }],
        "max_tokens": 100
    }'
```

> **Note:** The model name shown is `RedHatAI/Hy3-NVFP4-FP8`. The server listens on port **8089** in this example.

#### via Python 3

```python
# python3
>>> from vllm import LLM
>>> llm = LLM("RedHatAI/Hy3-NVFP4-FP8")
>>> llm.generate("Explain quantum computing.")
```

---

## Slide 3 — Quickstart & Advanced Topics

> **Diagram description:** Dark (black) background slide with two columns and Red Hat + vLLM branding. Left column: "Quickstart" (red heading) listing Standard Usage links, Red Hat and Nvidia Model Repositories, and FAQ. Right column: "Advanced Topics" (red heading) listing Extract Hidden States, Structured Outputs, and Tool Calling — each with one or more URLs. Slide number "3" appears bottom-left.

### Quickstart

#### Standard Usage

- <https://docs.vllm.ai/en/latest/getting_started/quickstart/#offline-batched-inference>
- <https://docs.vllm.ai/en/v0.7.2/serving/engine_args.html>
- <https://recipes.vllm.ai>

#### Red Hat and Nvidia Model Repositories

- <https://huggingface.co/RedHatAI>
- <https://huggingface.co/nvidia>

#### FAQ

- <https://docs.vllm.ai/en/latest/usage/faq/>

---

### Advanced Topics

#### Extract Hidden States

- <https://vllm.ai/blog/2026-03-30-extract-hidden-states>
- <https://github.com/vllm-project/vllm/blob/main/docs/features/speculative_decoding/extract_hidden_states.md>

#### Structured Outputs

- <https://docs.vllm.ai/en/latest/features/structured_outputs/#reasoning-outputs>

#### Tool Calling

- <https://docs.vllm.ai/en/v0.7.2/features/tool_calling.html>

---

## Complete Outbound Link Inventory

All URLs that appear in the presentation (slides 1–3):

| Title / Description                      | URL                                                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| vLLM Slack community                     | https://slack.vllm.ai                                                                                      |
| vLLM Recipes / Deploy guides             | https://recipes.vllm.ai                                                                                    |
| vLLM GitHub repository                   | https://github.com/vllm-project/vllm                                                                       |
| Quickstart — Offline Batched Inference   | https://docs.vllm.ai/en/latest/getting_started/quickstart/#offline-batched-inference                       |
| Engine Arguments (v0.7.2)                | https://docs.vllm.ai/en/v0.7.2/serving/engine_args.html                                                    |
| Recipes site                             | https://recipes.vllm.ai                                                                                    |
| Red Hat AI — HuggingFace                 | https://huggingface.co/RedHatAI                                                                            |
| Nvidia — HuggingFace                     | https://huggingface.co/nvidia                                                                              |
| vLLM FAQ                                 | https://docs.vllm.ai/en/latest/usage/faq/                                                                  |
| Blog: Extract Hidden States (2026-03-30) | https://vllm.ai/blog/2026-03-30-extract-hidden-states                                                      |
| GitHub: extract_hidden_states.md         | https://github.com/vllm-project/vllm/blob/main/docs/features/speculative_decoding/extract_hidden_states.md |
| Structured Outputs / Reasoning Outputs   | https://docs.vllm.ai/en/latest/features/structured_outputs/#reasoning-outputs                              |
| Tool Calling (v0.7.2)                    | https://docs.vllm.ai/en/v0.7.2/features/tool_calling.html                                                  |

---

## Attachments, Child Pages, and Toggles

- **Attachments:** None (the three slide images are embedded inline in the Notion page, not listed as file attachments)
- **Child pages:** None
- **Toggle blocks:** None (the page contains no collapsible/toggle sections)
- **Embedded images (slide assets):**
  1. `Screenshot_2026-07-17_at_18.13.58.png` — Slide 1 (vLLM Overview)
     Notion block ID: `3a021339-3e85-8018-a2cc-fe301ce2c674`
  2. `Screenshot_2026-07-17_at_18.14.10.png` — Slide 2 (Install & Process Requests)
     Notion block ID: `3a021339-3e85-8099-9a7b-edd3c758c68c`
  3. `Screenshot_2026-07-17_at_18.14.21.png` — Slide 3 (Quickstart & Advanced Topics)
     Notion block ID: `3a021339-3e85-8084-98b0-cbb259ccfc76`

---

## Notes & Configuration Values

> _Example values from the presentation; illustrative, not a fixed spec._

| Item                              | Value                                       |
| --------------------------------- | ------------------------------------------- |
| vLLM license                      | Apache 2.0                                  |
| Foundation                        | PyTorch Foundation                          |
| Default API server port (example) | 8089                                        |
| Tensor parallelism example flag   | `-tp 8`                                     |
| Example model (serve)             | `deepseek-ai/DeepSeek-V3.2`                 |
| Example model (process requests)  | `RedHatAI/Hy3-NVFP4-FP8`                    |
| CUDA backend flag example         | `--torch-backend=cu129`                     |
| Multiprocessing debug env var     | `VLLM_ENABLE_V1_MULTIPROCESSING=0`          |
| Precompiled build env var         | `VLLM_USE_PRECOMPILED=1`                    |
| Package installer used            | `uv pip`                                    |
| Build system                      | CMake (`--preset release --target install`) |

---

## How this maps to the Writing Engine seams

The `curl`/OpenAI-compatible endpoint above is exactly the interface the
production `Researcher`, `Writer`, and `RubricEvaluator` ports would call. The
evaluator must be a **separate** model call from the writer (independence is a
design principle). None of this is implemented in the demo — see
[architecture.md](../architecture.md#extension-seams) and
[known-limitations.md](../known-limitations.md) for the seam definitions and the
`.env` placeholders that would configure such an endpoint.

---

_Reference derived from the three-slide [vLLM QuickStart on Notion](https://expensive-date-2f9.notion.site/vLLM-QuickStart-3a0213393e85808dbe14e8d832156c43), extracted 2026-07-18. Presentation content is point-in-time._
