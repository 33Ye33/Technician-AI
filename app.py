"""Local development entrypoint for the Technician AI API."""

import os

from technician_ai.api import app


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("technician_ai.api:app", host="127.0.0.1", port=port, reload=True)

