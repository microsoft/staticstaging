Reproducibility Guide
=====================

To collect and visualize performance numbers for this project:

1. Build the dingus. In the root of the repository, `make dingus`.

2. Build the performance test harness. `cd harness ; npm install ; make`.

3. Collect the data measurements. `make collect`.

4. Aggregate the collected data. `make latencies.json`.

5. Draw the plots. `cd plot ; make`.


The `bench` Directory
=====================

These are the example programs.

# phong

- `phong-orig` is the original Phong lighting, with no metaprogramming tricks.
- `phong-stif` uses pure compile-time metaprogramming. It uses macro called `@stif`, which like a safe `#ifdef` evaluated at overall compile time.
- `phong-stif-diffuse` is generated automatically to show the compile-time switch going the "other way".
- `phong-if` uses a run-time GPU-side branch to draw different instances as matte or shiny.
