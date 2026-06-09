# JENNIE

A free web tool that predicts whether a missense variant is loss-of-function
(LOF), gain-of-function (GOF), or neutral, using a supervised classifier on
ESM-2 embeddings trained on the GLOF benchmark.

Live: https://victormaricato-jennie.static.hf.space

## Links

- Web tool: https://victormaricato-jennie.static.hf.space
- Backend API: https://victormaricato-jennie-api.hf.space
- Classifier weights: https://huggingface.co/victormaricato/glof-lof-gof-classifier
- GLOF benchmark dataset: https://huggingface.co/datasets/victormaricato/glof
- Benchmark experiments: https://github.com/victormaricato/jennie-paper

## How it works

Zero-shot foundation-model likelihoods predict pathogenicity but not the
LOF-vs-GOF direction, so JENNIE serves a supervised classifier for the 3-class
call: it mean-pools ESM-2 650M embeddings of the wild-type and mutant sequences
and feeds the concatenation to a gradient-boosted model. Direction (GOF vs LOF)
AUROC is about 0.76 on held-out genes under gene-disjoint cross-validation, so
the direction call should be read as a weak prior. Variants already present in
GLOF return their expert-curated label.

## Layout

```
api/      FastAPI backend (classifier + Redis result/embedding cache + RQ queue
          + rate limiting), Dockerized
ui/       Next.js 15 + shadcn (new-york) static front end
```

## Run locally

Backend (needs a Redis instance; point `REDIS_URL` at it):

```bash
cd webapp/api && pip install -r requirements.txt
uvicorn app.main:app --port 8000   # API
python worker.py                   # RQ worker (separate process)
```

Frontend:

```bash
cd webapp/ui && pnpm install
NEXT_PUBLIC_API_BASE=http://localhost:8000 pnpm dev
```

## Deployment and security

The front end is a static site rebuilt and redeployed by GitHub Actions on push
to `main` only (never on pull requests), so contributions cannot reach deploy
secrets. See [`SECURITY.md`](SECURITY.md). MIT-licensed.
