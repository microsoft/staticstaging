#!/usr/bin/env python3
import os
import json
import uncertain

TIMINGS_DIR = 'collected'


def summarize_run(data):
    """Summarize the data from a single run."""
    print(data['fn'])
    all_latencies = []
    for msg in data['messages']:
        # As a sanity check, we can get an average frame latency for the
        # entire message with:
        # avg_latency = msg['ms'] / msg['frames']

        latencies = msg['latencies']
        all_latencies += latencies

        # TODO Skip the first message as a "warmup" period.

    mean = uncertain.umean(latencies)
    print('frame latency:', mean, 'ms')
    print('fps:', 1000.0 / mean)


def summarize():
    """Sumarrize all the collected data."""
    for fn in os.listdir(TIMINGS_DIR):
        path = os.path.join(TIMINGS_DIR, fn)
        with open(path) as f:
            data = json.load(f)
        summarize_run(data)


if __name__ == '__main__':
    summarize()
