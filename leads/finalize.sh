#!/bin/bash
# Final assembly once the Maps scrape and enrichment have finished.
set -e
cd /home/user/genestjan/leads
echo "== 1. parse Google Maps results =="
python3 parse_maps.py
echo "== 2. merge into the registry list =="
python3 merge.py
echo "== 3. collect newly discovered websites =="
python3 build_todo.py
echo "== 4. pull emails from those websites =="
python3 extract_emails.py
echo "== 5. audit + export =="
python3 export.py
echo "== FINALIZE DONE =="
