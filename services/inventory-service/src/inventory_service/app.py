from fastapi import FastAPI

app = FastAPI(title="inventory-service")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
