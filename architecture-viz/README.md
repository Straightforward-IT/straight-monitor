# Straight Monitor Architecture Viz

Standalone visual architecture project for the Straight Monitor repository.

Current scope covers phases 1 to 4:

- Separate project shell using Vite, React, and React Flow
- Typed graph schema for architecture nodes, edges, groups, and views
- Curated system inventory seeded from the current codebase
- Encoded view model and manual layout rules for overview, system flows, domain model, and public monitor

## Commands

```bash
cd architecture-viz
npm install
npm run dev
```

The preview server runs on port 4174 and proxies `/api` to `http://localhost:5050` for future live overlays.

## What is already modeled

- External systems: Cloudflare, Microsoft Graph, Asana, Flip, Zvoove, YouSign
- Internal surfaces: office frontend, public monitor, API, public routes, routines, PDF and signature flow
- Data stores: MongoDB, R2
- Domain model: User, Mitarbeiter, Auftrag, Schicht, Einsatz
- Document model: Laufzettel, EventReport, PdfTemplate, PdfVorgang

## Why the layouts are manual

This project is meant to communicate architecture clearly to technical and non-technical readers. The view positions are therefore curated instead of generated entirely from topology.