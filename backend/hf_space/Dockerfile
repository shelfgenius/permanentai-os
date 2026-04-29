FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ffmpeg libsndfile1 git \
    && rm -rf /var/lib/apt/lists/*

# HF Spaces requires non-root user
RUN useradd -m -u 1000 appuser

COPY requirements_cloud.txt ./
RUN pip install --no-cache-dir -r requirements_cloud.txt

COPY . .

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 7860
ENV PORT=7860
CMD ["python", "main.py"]
