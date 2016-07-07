#!/usr/bin/env python3
import os
import json

TIMINGS_DIR = 'collected'


def mean(values):
    return sum(values) / len(values)


def summarize_run(data):
    print(data['fn'])
    for msg in data['messages']:
        frames = msg['frames']
        elapsed = msg['ms']
        latencies = msg['latencies']

        print(latencies)
        print('simple', elapsed / frames)
        print('complicated', mean(latencies))


def summarize():
    for fn in os.listdir(TIMINGS_DIR):
        path = os.path.join(TIMINGS_DIR, fn)
        with open(path) as f:
            data = json.load(f)
        summarize_run(data)


if __name__ == '__main__':
    summarize()
