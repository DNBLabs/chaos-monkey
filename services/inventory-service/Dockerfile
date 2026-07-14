FROM python:3.13-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir .

RUN useradd --create-home --uid 1000 app
USER app

EXPOSE 8080
CMD ["uvicorn", "inventory_service.app:app", "--host", "0.0.0.0", "--port", "8080"]
