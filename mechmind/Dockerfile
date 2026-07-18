# MechMind backend — כולל את ספריות המערכת ש-WeasyPrint ו-CadQuery/OCC דורשים.
FROM python:3.11-slim

# WeasyPrint: pango/cairo/gdk-pixbuf/ffi + mime + פונטים (כולל עברית).
# CadQuery/OCC: libGL + libX ל-headless rendering.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangocairo-1.0-0 libpangoft2-1.0-0 \
    libgdk-pixbuf-2.0-0 libcairo2 libffi8 shared-mime-info \
    libgl1 libglu1-mesa libxrender1 libxext6 libsm6 \
    fonts-dejavu fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend

ENV ARTIFACTS_DIR=/app/artifacts \
    DATABASE_URL=sqlite:////app/data/mechmind.db \
    PYTHONUNBUFFERED=1
RUN mkdir -p /app/artifacts /app/data

# ריצה כמשתמש לא-root — שכבת בידוד נוספת ל-sandbox של ה-CAD.
RUN useradd -m -u 10001 mechmind && chown -R mechmind:mechmind /app
USER mechmind

EXPOSE 8000
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
