# CPU-only image for the JENNIE API + worker (same image runs both roles).
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/models/hf \
    TORCH_NUM_THREADS=2

WORKDIR /srv

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY worker.py .

# Pre-cache ESM-2 weights into the image so the first request doesn't pay the
# download (≈2.5 GB). Comment out to keep the image small and download at runtime.
RUN python -c "from transformers import AutoTokenizer, EsmModel; \
    n='facebook/esm2_t33_650M_UR50D'; AutoTokenizer.from_pretrained(n); EsmModel.from_pretrained(n)" \
    || echo 'weights will download at runtime'

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
