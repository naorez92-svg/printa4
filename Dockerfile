FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto \
    fonts-noto-color-emoji \
    fonts-dejavu \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin
ENV CHROME_EXECUTABLE=/usr/bin/chromium

WORKDIR /app
COPY requirements.txt .
RUN pip install flask playwright
RUN python -m playwright install chromium

COPY . .
EXPOSE 10000
CMD ["python", "app_cloud.py"]
