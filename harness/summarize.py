#!/usr/bin/env python3
import os
import json
import math

TIMINGS_DIR = 'collected'


def _mean(values):
    """The arithmetic mean."""
    return sum(values) / len(values)


def _mean_err(vals):
    """The mean and standard error of the mean."""
    if len(vals) <= 1:
        return 0.0
    mean = _mean(vals)
    stdev = math.sqrt(sum((x - mean) ** 2 for x in vals) / (len(vals) - 1))
    return mean, stdev / math.sqrt(len(vals))


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

    mean, err = _mean_err(latencies)
    print('frame latency:', mean, '+/-', err, 'ms')


def summarize():
    """Sumarrize all the collected data."""
    for fn in os.listdir(TIMINGS_DIR):
        path = os.path.join(TIMINGS_DIR, fn)
        with open(path) as f:
            data = json.load(f)
        summarize_run(data)


if __name__ == '__main__':
    summarize()
