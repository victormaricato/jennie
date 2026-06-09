"""RQ worker entrypoint. Run one or more of these alongside the API.

    python worker.py

Each worker loads ESM-2 + the LightGBM classifier lazily on its first job and
then serialises CPU inference, which is exactly the back-pressure we want on a
shared free-tier box.
"""
from __future__ import annotations

from redis import Redis
from rq import Queue, Worker

from app import config


def main() -> None:
    conn = Redis.from_url(config.REDIS_URL)
    worker = Worker([Queue(config.QUEUE_NAME, connection=conn)], connection=conn)
    worker.work(with_scheduler=False)


if __name__ == "__main__":
    main()
