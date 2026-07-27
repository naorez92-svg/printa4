"""Central logging setup + in-memory ring buffer of recent errors for the admin page."""
import logging
from collections import deque

RECENT_ERRORS: deque[str] = deque(maxlen=50)


class _ErrorBufferHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        if record.levelno >= logging.WARNING:
            RECENT_ERRORS.append(self.format(record))


def setup_logging() -> None:
    root = logging.getLogger()
    if any(isinstance(h, _ErrorBufferHandler) for h in root.handlers):
        return
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    handler = _ErrorBufferHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    root.addHandler(handler)
