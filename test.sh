#!/bin/sh
fn=$1
name=$2
output=$(node atw.js $fn)
expected=$(sed -n 's/^# -> \(.*\)/\1/p' $fn)
if [ "$output" = "$expected" ] ; then
    echo $name ✓
else
    echo $name ✘: $output $expected
fi
