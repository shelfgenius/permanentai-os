FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements_cloud.txt ./
RUN pip install --no-cache-dir -r requirements_cloud.txt

COPY . .

EXPOSE 8000
CMD ["python", "main.py"]
