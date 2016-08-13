Reproducibility Guide
=====================

To collect and visualize performance numbers for this project:

1. Build the dingus. In the root of the repository, `make dingus`.

2. Build the performance test harness. `cd harness ; npm install ; make`.

3. Generate the test variants programs. `make variants`.

3. Collect the data measurements. `make collect`. This produces a directory called `collected` with the raw measurement data reported from the browser.

4. Aggregate the collected data. `make latencies.json`.

5. Draw the plots. `cd plot ; make`.

Optional bits:

- Type `make latencies.mdk` to produce the human-formatted textual numbers used in the paper. This is meant to be included in a Madoko document.
- In `plot`, you can all type `make view` to open the PDFs.
- Or you can type `make plotname.png` to get a PNG if that's easier.


The `bench` Directory
=====================

These are the example programs.

# phong

- `phong-orig` is the original Phong lighting, with no metaprogramming tricks.
- `phong-stif` uses pure compile-time metaprogramming. It uses macro called `@stif`, which like a safe `#ifdef` evaluated at overall compile time.
- `phong-stif-diffuse` is generated automatically to show the compile-time switch going the "other way".
- `phong-if` uses a run-time GPU-side branch to draw different instances as matte or shiny.
- `phong-spif` converts the `if` in that version to run-time metaprogramming with a macro called `@spif`. This showcases the *presplicing* optimization, which avoids actual code generation and instead switches between two shaders.
- `phong-vertex` is a version of `phong-orig` that promotes all the shading from the fragment stage to the vertex stage.
