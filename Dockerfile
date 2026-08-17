FROM python:3.12-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs npm curl && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Build frontend
RUN cd frontend && npm install && npm run build

# Expose ports
EXPOSE 8000 3000

# Run both services
CMD ["bash", "-c", "python -m src.api & cd frontend && npx tsx server.ts"]
