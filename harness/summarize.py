#!/usr/bin/env python3
import os
import json
import uncertain
import sys

TIMINGS_DIR = 'collected'


def mean_latency(data):
    """Summarize the data from a single run."""
    all_latencies = []
    for msg in data['messages']:
        # As a sanity check, we can get an average frame latency for the
        # entire message with:
        # avg_latency = msg['ms'] / msg['frames']

        latencies = msg['latencies']
        all_latencies += latencies

        # TODO Skip the first message as a "warmup" period.

    return uncertain.umean(latencies)


def summarize(as_json):
    """Summarize all the collected data."""
    out = []
    for fn in os.listdir(TIMINGS_DIR):
        path = os.path.join(TIMINGS_DIR, fn)
        with open(path) as f:
            data = json.load(f)
        mean = mean_latency(data)

        if as_json:
            # Emit as a (mean, standard error) pair.
            out.append({
                'name': os.path.basename(data['fn']),
                'value': mean.value,
                'error': mean.error,
            })
        else:
            # Human-readable.
            print(data['fn'])
            print('frame latency:', mean, 'ms')
            print('fps:', 1000.0 / mean)

    if as_json:
        json.dump(out, sys.stdout, sort_keys=True, indent=2)


if __name__ == '__main__':
    summarize('-j' in sys.argv)
