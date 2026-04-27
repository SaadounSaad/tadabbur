"""
Extract التفسير المحرر from HTTrack mirror of dorar.net.
Input:  C:\Mes Sites Web\dorar\dorar.net\tafseer\{surah}\{page}.html
Output: data/tafsir/muharrar/{001-114}.txt
"""
import os, re, sys
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8")

MIRROR_DIR = r"C:\Mes Sites Web\dorar\dorar.net\tafseer"
OUT_DIR    = r"C:\Mes Projets\tadabbur\data\tafsir\muharrar"
os.makedirs(OUT_DIR, exist_ok=True)

def strip_html(html: str) -> str:
    """Remove HTML tags and normalise whitespace."""
    text = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>",  " ", text,  flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&[a-z]+;", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def extract_content(html: str) -> str:
    """Extract the main tafsir text from amiri_custom_content divs."""
    # Each amiri_custom_content div is self-closing at the first </div>
    # Use a more robust approach: find all such divs
    chunks = re.findall(
        r'class="[^"]*amiri_custom_content[^"]*"[^>]*>(.*?)</div>',
        html, re.DOTALL
    )
    parts = []
    for c in chunks:
        text = strip_html(c).strip()
        # Skip nav/header chunks (short or no Arabic)
        if len(text) < 50:
            continue
        if not re.search(r'[؀-ۿ]', text):
            continue
        parts.append(text)
    return "\n\n".join(parts)

def get_surah_and_page(filepath: str):
    """
    Return (surah_num, page_num) from path like:
      .../tafseer/2/1.html  -> (2, 1)
      .../tafseer/2.html    -> (2, 0)   [surah intro]
    """
    rel = os.path.relpath(filepath, MIRROR_DIR)
    parts = rel.replace("\\", "/").split("/")
    if len(parts) == 2 and parts[1].endswith(".html"):
        # {surah}.html — intro page
        try:
            s = int(parts[0].replace(".html","")) if "/" not in parts[0] else int(parts[0])
        except ValueError:
            return None, None
        try:
            s2 = int(parts[1].replace(".html","").replace(".tmp",""))
            return s2, 0
        except ValueError:
            return None, None
    if len(parts) == 2:
        # sub-page: parts[0]=surah_dir, parts[1]=page.html
        try:
            surah = int(parts[0])
            page  = int(parts[1].replace(".html","").replace(".tmp",""))
            return surah, page
        except ValueError:
            return None, None
    return None, None

# ── Collect all HTML files ────────────────────────────────────────────────────
surah_pages: dict[int, list[tuple[int, str]]] = defaultdict(list)

for root, dirs, files in os.walk(MIRROR_DIR):
    for fname in files:
        if not fname.endswith(".html") or fname.endswith(".tmp"):
            continue
        # Skip non-numeric files
        stem = fname.replace(".html","")
        if not stem.isdigit():
            continue
        fpath = os.path.join(root, fname)
        rel   = os.path.relpath(fpath, MIRROR_DIR).replace("\\", "/")
        parts = rel.split("/")

        surah = page = None
        if len(parts) == 1:
            # {surah}.html at top level
            try:
                surah, page = int(stem), 0
            except ValueError:
                continue
        elif len(parts) == 2:
            # {surah}/{page}.html
            try:
                surah = int(parts[0])
                page  = int(stem)
            except ValueError:
                continue

        if surah and 1 <= surah <= 114:
            surah_pages[surah].append((page, fpath))

# ── Extract and write ─────────────────────────────────────────────────────────
total_written = 0
for surah in range(1, 115):
    pages = sorted(surah_pages.get(surah, []))  # sort by page number
    if not pages:
        print(f"  Surah {surah:3d}: MISSING")
        continue

    parts = []
    for page_num, fpath in pages:
        try:
            with open(fpath, encoding="utf-8") as f:
                html = f.read()
        except Exception as e:
            print(f"  Error reading {fpath}: {e}")
            continue

        # Extract title (verse range) for section header
        title_m = re.search(r"<title>(.*?)</title>", html, re.DOTALL)
        page_title = ""
        if title_m:
            raw = strip_html(title_m.group(1)).strip()
            # Remove "الدرر السنية - موسوعة التفسير - " prefix
            raw = re.sub(r"^الدرر السنية\s*[-–]\s*موسوعة التفسير\s*[-–]\s*", "", raw)
            page_title = raw.strip()

        content = extract_content(html)
        if content:
            header = f"=== {page_title} ===" if page_title else f"=== صفحة {page_num} ==="
            parts.append(f"{header}\n\n{content}")

    if parts:
        out_path = os.path.join(OUT_DIR, f"{surah:03d}.txt")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write("\n\n\n".join(parts))
        total_written += 1
        print(f"  Surah {surah:3d}: {len(pages)} pages -> {out_path.split(chr(92))[-1]}")

print(f"\nDone. {total_written} surahs written.")
