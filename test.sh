#!/bin/sh
fn=$1
name=$2
output=$(node atw.js $fn)
expected=$(sed -n 's/^# -> \(.*\)/\1/p' $fn)
echo $name $output $expected
