# Multi-stage build para alto rendimiento y tamaño reducido
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

COPY pyproject.toml uv.lock* ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev --no-install-project || true

COPY . /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install -e .

FROM python:3.12-slim-bookworm

WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

COPY --from=builder /app /app

EXPOSE 8100

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python -c "import httpx; resp = httpx.get('http://127.0.0.1:8100/health'); assert resp.status_code == 200" || exit 1

ENTRYPOINT ["analista"]
CMD ["serve", "--host", "0.0.0.0", "--port", "8100"]
