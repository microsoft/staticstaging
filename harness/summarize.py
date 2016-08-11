#!/usr/bin/env python3
import os
import json
import uncertain
import sys

TIMINGS_DIR = 'collected'


def mean_latency(data):
    """Get the average frame latency from a benchmark run.
    """
    msgs = data['messages'][1:]  # Skip the first message as a "warmup."

    all_latencies = []
    all_draw_latencies = []
    for msg in msgs:
        # As a sanity check, we can get an average frame latency for the
        # entire message with:
        # avg_latency = msg['ms'] / msg['frames']

        all_latencies += msg['latencies']
        all_draw_latencies += msg['draw_latencies']

    # More sanity checking: we should have the same number of overall and
    # draw-call latencies, and the draw latency should always be less than the
    # overall latency.
    assert len(all_latencies) == len(all_draw_latencies)
    for l, dl in zip(all_latencies, all_draw_latencies):
        assert dl < l

    return uncertain.umean(all_latencies)


def summarize(as_json):
    """Summarize all the collected data."""
    out = []
    for fn in os.listdir(TIMINGS_DIR):
        path = os.path.join(TIMINGS_DIR, fn)
        with open(path) as f:
            data = json.load(f)
        mean = mean_latency(data)

        if as_json:
            # Emit a Vega-ready data record.
            name, _ = os.path.splitext(os.path.basename(data['fn']))
            out.append({
                'name': name,
                'value': mean.value,
                'error': mean.error,
                'err_min': mean.value - mean.error,
                'err_max': mean.value + mean.error,
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
