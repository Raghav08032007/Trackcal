FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 NLTK_DATA=/app/nltk_data
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY requirements-production.txt requirements-integrations.txt ./
RUN pip install --no-cache-dir --upgrade pip==26.2.2 && pip install --no-cache-dir -r requirements-production.txt -r requirements-integrations.txt
COPY . .
RUN python -m nltk.downloader -d /app/nltk_data averaged_perceptron_tagger_eng && useradd --uid 10001 --create-home trackcal && mkdir -p uploads runtime && chown -R trackcal:trackcal /app
USER trackcal
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
