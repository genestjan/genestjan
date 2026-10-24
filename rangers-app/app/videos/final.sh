#!/usr/bin/env bash
# Usage: final.sh NAME OUTFILE LOUDNESS   -> H.264 1080x1920 30fps MP4 with the club anthem looped underneath, faded in and out
set -euo pipefail
cd "$(dirname "$0")/out/$1"
dur=$(awk '/^duration/{s+=$2} END{printf "%.3f", s}' list.txt)
fo=$(awk -v d="$dur" 'BEGIN{printf "%.3f", d-3}')
ffmpeg -nostdin -v error -y -f concat -safe 0 -i list.txt -stream_loop -1 -i "${SITE_DIR:-/home/user/rangersfc}/assets/music.mp3" \
  -filter_complex "[0:v]fps=30,scale=1080:1920:flags=lanczos,format=yuv420p[v];[1:a]atrim=0:$dur,asetpts=N/SR/TB,loudnorm=I=$3:TP=-1.5:LRA=11,afade=t=in:st=0:d=1.5,afade=t=out:st=$fo:d=3[a]" \
  -map "[v]" -map "[a]" -t "$dur" -c:v libx264 -preset slow -crf 21 -profile:v high -level 4.1 -r 30 -g 60 \
  -c:a aac -b:a 160k -ar 48000 -movflags +faststart "$2"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height -of compact "$2"
