#!/bin/bash
# wait for pass 1 to exit, then immediately run pass 2
while pgrep -f "[e]nrich.py" > /dev/null; do sleep 15; done
echo "=== PASS 1 DONE ===" >> chain.log
python3 enrich2.py >> chain.log 2>&1
echo "=== PASS 2 DONE ===" >> chain.log
python3 export.py >> chain.log 2>&1
echo "=== EXPORT DONE ===" >> chain.log
