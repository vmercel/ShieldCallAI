FROM python:3.12-slim

# Audio libs needed by the voice pipeline
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY agent.py .

# LiveKit agent worker: connects outbound to LiveKit Cloud, no inbound ports needed.
CMD ["python", "agent.py", "start"]
