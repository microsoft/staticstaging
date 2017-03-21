#!/usr/bin/env python3
import sys
import re


def adjust_knob():
    for line in sys.stdin:
        if 'knob:' in line:
            val = re.search(r'knob: (.*)', line).group(1)
            out = re.sub(r'\([^\)*]\)', '({})'.format(val), line)
            sys.stdout.write(out)
        else:
            sys.stdout.write(line)


if __name__ == '__main__':
    adjust_knob()
