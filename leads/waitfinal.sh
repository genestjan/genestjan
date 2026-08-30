#!/bin/bash
cd /home/user/genestjan/leads
while pgrep -f "scrape[.]js" >/dev/null || pgrep -f "enrich[.]py" >/dev/null || pgrep -f "extract[_]emails" >/dev/null; do
  sleep 30
done
echo "=== ALL UPSTREAM JOBS DONE ===" > final.log
./finalize.sh >> final.log 2>&1
echo "=== FINALIZE COMPLETE ===" >> final.log
