FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY backend/pyproject.toml /app/backend/
RUN pip install --no-cache-dir /app/backend

# Copy application code and content
COPY backend/ /app/backend/
COPY content/ /app/content/

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 8000
CMD ["/app/start.sh"]
