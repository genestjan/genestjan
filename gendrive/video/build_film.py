"""film.html = the design preview + the film layer, offline (no Google Fonts link), always read as UTF-8."""
import re
from pathlib import Path
HERE = Path(__file__).parent
pre = (HERE.parent / "design" / "preview.html").read_text(encoding="utf-8")
pre = re.sub(r'<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\n?', '', pre)
html = '<meta charset="utf-8">\n' + pre + "\n" + (HERE / "film_layer.html").read_text(encoding="utf-8")
(HERE / "film.html").write_text(html, encoding="utf-8")
print("film.html rebuilt,", len(html), "chars")
