# Project Jasper – Sprint 4 Query Benchmark Report

## Objective

Verify that the spatial query executes within the required performance target.

## Query

Spatial search using `ST_DWithin` on the `environmental_layers` table with a 5 km radius.

## Results

Planning Time: 35.789 ms

Execution Time: 1.215 ms

## Target

Target: < 500 ms

Result: PASS ✅

## Notes

The query completed successfully with an execution time of 1.215 ms, well below the required 500 ms performance target.
