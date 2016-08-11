Reproducibility Guide
=====================

To collect and visualize performance numbers for this project:

1. Build the dingus. In the root of the repository, `make dingus`.

2. Build the performance test harness. `cd harness ; npm install ; make`.

3. Collect the data measurements. `make collect`.

4. Aggregate the collected data. `make latencies.json`.

5. Draw the plots. `cd plot ; make`.
