#!/usr/bin/env bash
# Usage: sheet.sh NAME  -> builds out/NAME/draft.mp4 and contact sheets of one frame per caption (2.2s into it)
set -euo pipefail
cd "$(dirname "$0")/out/$1"
[ -f draft.mp4 ] && [ draft.mp4 -nt list.txt ] || ffmpeg -nostdin -v error -y -f concat -safe 0 -i list.txt -vf "fps=30,scale=1080:1920:flags=lanczos,format=yuv420p" -c:v libx264 -preset veryfast -crf 22 draft.mp4
rm -rf sheet && mkdir sheet
i=0
grep -E '^[0-9:,]+ --> ' captions.srt | while read -r a _ b; do
  s=$(echo "$a" | awk -F'[:,]' '{print $1*3600+$2*60+$3+$4/1000}'); e=$(echo "$b" | awk -F'[:,]' '{print $1*3600+$2*60+$3+$4/1000}')
  t=$(awk -v s="$s" -v e="$e" 'BEGIN{m=e-0.5; if (m<s) m=(s+e)/2; print m}')
  i=$((i+1)); ffmpeg -nostdin -v error -y -ss "$t" -i draft.mp4 -frames:v 1 -vf scale=360:-1 "sheet/$(printf %03d $i).png"
done
n=$(ls sheet | wc -l); k=0
for start in $(seq 1 8 "$n"); do k=$((k+1)); ls sheet/*.png | sed -n "${start},$((start+7))p" | xargs -I{} echo {} > /tmp/l.txt; convert $(cat /tmp/l.txt) +append "sheet-$k.png"; done
ffprobe -v error -show_entries format=duration -of csv=p=0 draft.mp4; ls sheet-*.png
