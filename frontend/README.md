# Technician AI Frontend

React + Vite frontend for Technician AI.

For full setup, configuration, and demo instructions, see the root
[README.md](../README.md).

## Install

```bash
npm install
```

## Development

Run the FastAPI backend from the repo root:

```bash
source .venv/bin/activate
python app.py
```

Then start Vite from this directory:

```bash
npm run dev
```

The Vite dev server runs at [http://localhost:5173](http://localhost:5173)
and proxies `/api/*` requests to the backend on port `8000`.

## Build

```bash
npm run build
```

The production build is written to `../static/`, which FastAPI serves from
[http://localhost:8000](http://localhost:8000) when you run:

```bash
cd ..
python app.py
```
