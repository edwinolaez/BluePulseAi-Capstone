"""
Project Jasper ML API Package

This package exposes the machine-learning models and environmental simulations
as a set of HTTP endpoints using FastAPI. It serves as the boundary between the
Python ML layer and the Next.js/Convex frontend — the frontend calls these
endpoints to get risk scores, erosion estimates, and contaminant tracking results.

Modules inside this package:
  - model_endpoint.py  — FastAPI app with /predict and /simulate routes
  - sensor_fetch.py    — Pulls live readings from Environment Canada and SRTM
"""
