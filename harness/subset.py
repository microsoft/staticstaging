#!/usr/bin/env python3
import sys
import json


def subset(map_fn):
    """Subset a latency dump to include only a subset of benchmarks with
    specified names.
    """
    # Load name mapping.
    with open(map_fn) as f:
        name_mapping = json.load(f)

    # Load latency data from stdin.
    latencies = json.load(sys.stdin)
    out = []
    for old_name, new_name in name_mapping:
        for bench in latencies:
            if bench['name'] == old_name:
                new_bench = dict(bench)
                new_bench['name'] = new_name
                out.append(new_bench)
                break

    json.dump(out, sys.stdout)


if __name__ == '__main__':
    subset(sys.argv[1])
