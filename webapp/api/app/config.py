"""Runtime configuration, all overridable via environment variables."""
from __future__ import annotations

import os
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent

# Model
ESM_MODEL_NAME = os.getenv("ESM_MODEL_NAME", "facebook/esm2_t33_650M_UR50D")
CLASSIFIER_PATH = os.getenv("CLASSIFIER_PATH", str(APP_DIR / "model" / "glof_clf.pkl"))
MAX_SEQUENCE_LENGTH = int(os.getenv("MAX_SEQUENCE_LENGTH", "1022"))
TORCH_NUM_THREADS = int(os.getenv("TORCH_NUM_THREADS", "2"))

# Labels in the order the classifier emits them (classes_ == [0, 1, 2]).
LABELS = ["NEUTRAL", "LOF", "GOF"]

# Redis (cache + queue)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
RESULT_TTL_SECONDS = int(os.getenv("RESULT_TTL_SECONDS", str(60 * 60 * 24 * 30)))  # 30d
EMBED_TTL_SECONDS = int(os.getenv("EMBED_TTL_SECONDS", str(60 * 60 * 24 * 7)))     # 7d

# Queue
QUEUE_NAME = os.getenv("QUEUE_NAME", "jennie")
JOB_TIMEOUT = int(os.getenv("JOB_TIMEOUT", "300"))     # seconds a job may run
JOB_RESULT_TTL = int(os.getenv("JOB_RESULT_TTL", "600"))  # seconds RQ keeps the result

# GLOF expert-label lookup
GLOF_DB = os.getenv("GLOF_DB", str(APP_DIR / "data" / "glof_lookup.sqlite"))

# Gene -> UniProt sequence resolution
UNIPROT_TIMEOUT = int(os.getenv("UNIPROT_TIMEOUT", "20"))

# Rate limiting (per client IP)
RATE_LIMIT = os.getenv("RATE_LIMIT", "30/minute")

# CORS: comma-separated origins, or "*" for any.
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
