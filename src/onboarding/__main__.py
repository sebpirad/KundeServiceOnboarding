"""Run the onboarding app with uvicorn: ``python -m onboarding``."""

from __future__ import annotations

import os

import uvicorn


def main() -> None:
    uvicorn.run(
        "onboarding.app:app",
        host=os.getenv("PM_HOST", "127.0.0.1"),
        port=int(os.getenv("PM_PORT", "8000")),
        reload=bool(os.getenv("PM_RELOAD")),
    )


if __name__ == "__main__":
    main()
