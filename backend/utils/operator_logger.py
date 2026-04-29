"""
[OPERATOR_OS] tactical logger for the Python backend.

Usage:
    from utils.operator_logger import get_logger
    log = get_logger("auth")
    log.info("user signed in: %s", email)

Output format:
    [OPERATOR_OS][auth][INFO] 2026-04-21 14:23:10  user signed in: ...

Set env var `OPERATOR_LOG_LEVEL=DEBUG|INFO|WARNING|ERROR` to tune verbosity.
"""
from __future__ import annotations

import logging
import os
import sys
from typing import Dict

_LEVEL = os.getenv("OPERATOR_LOG_LEVEL", "INFO").upper()

_FMT = "[OPERATOR_OS][%(subsys)s][%(levelname)s] %(asctime)s  %(message)s"
_DATEFMT = "%Y-%m-%d %H:%M:%S"


class _SubsysFilter(logging.Filter):
    """Injects the subsystem tag on every record so `%()s` can pick it up."""

    def __init__(self, subsys: str) -> None:
        super().__init__()
        self._subsys = subsys

    def filter(self, record: logging.LogRecord) -> bool:
        record.subsys = self._subsys
        return True


_LOGGERS: Dict[str, logging.Logger] = {}


def get_logger(subsys: str = "core") -> logging.Logger:
    """Return a tagged logger. Re-uses the same logger per subsystem."""
    if subsys in _LOGGERS:
        return _LOGGERS[subsys]

    logger = logging.getLogger(f"operator.{subsys}")
    logger.setLevel(_LEVEL)
    logger.propagate = False  # don't double-log through the root logger

    # Stream handler (stderr is conventional for logs; stdout also fine for docker)
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(logging.Formatter(_FMT, datefmt=_DATEFMT))
    handler.addFilter(_SubsysFilter(subsys))
    logger.addHandler(handler)

    _LOGGERS[subsys] = logger
    return logger
