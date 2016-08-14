#!/usr/bin/env python3
import os
import json
import uncertain
import sys

TIMINGS_DIR = 'collected'


def mean_latency(data):
    """Get the average frame latency from a benchmark run. Return a pair of
    uncertain numbers: the overall latency and the draw latency.
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
    # print(data['fn'], file=sys.stderr)
    for l, dl in zip(all_latencies, all_draw_latencies):
        # print(l, dl, file=sys.stderr)
        if l == dl == 0:
            continue
        assert dl < l

    return uncertain.umean(all_latencies), uncertain.umean(all_draw_latencies)


def summarize_unc(unc):
    """Format an uncertain value as a Vega-ready JSON-style dictionary.
    """
    return {
        'value': unc.value,
        'error': unc.error,
        'err_min': unc.value - unc.error,
        'err_max': unc.value + unc.error,
    }


def summarize(as_json, as_madoko):
    """Summarize all the collected data."""
    out = []
    for fn in os.listdir(TIMINGS_DIR):
        path = os.path.join(TIMINGS_DIR, fn)
        with open(path) as f:
            data = json.load(f)
        latency, draw_latency = mean_latency(data)
        name, _ = os.path.splitext(os.path.basename(data['fn']))

        if as_json:
            # Emit a Vega-ready data record.
            out.append({
                'name': name,
                'latency': summarize_unc(latency),
                'draw_latency': summarize_unc(draw_latency),
            })
        elif as_madoko:
            # Emit Madoko definitions for inclusion in text.
            prefix = 'data-{}-'.format(name)
            ms = '&nbsp;ms'
            print(prefix + 'latency:',
                  '{:.1f}'.format(latency.value) + ms)
            print(prefix + 'draw-latency:',
                  '{:.1f}'.format(draw_latency.value) + ms)
            draw_frac = draw_latency.value / latency.value
            print(prefix + 'draw-frac: {:.0%}'.format(draw_frac))
        else:
            # Human-readable.
            print(data['fn'])
            print('frame latency:', latency, 'ms')
            print('draw latency:', draw_latency, 'ms')
            print('fps:', 1000.0 / latency)

    if as_json:
        json.dump(out, sys.stdout, sort_keys=True, indent=2)


if __name__ == '__main__':
    summarize('-j' in sys.argv, '-m' in sys.argv)
