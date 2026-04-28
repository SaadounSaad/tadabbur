"""
Extract Fi Zilal Al-Quran (Sayyid Qutb) from HTML files to 114 surah text files.
Input:  docs/Qotb/sura{N}-aya{M}.html  (one file per ayah)
Output: data/tafsir/fi-zilal/{NNN}.txt  (one file per surah)

Usage:  python scripts/extract-qotb.py
"""

import os
import re
import glob

INPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "docs", "Qotb")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "tafsir", "fi-zilal")

# ── Extract content between div tags with proper nesting ───────────────────

def extract_div_content(html: str, div_id: str) -> str | None:
    """Extract content of a div with a specific id, handling nested divs."""
    pattern = rf'<div\s+[^>]*id="{div_id}"[^>]*>'
    match = re.search(pattern, html)
    if not match:
        return None
    
    start = match.end()
    depth = 1
    i = start
    
    while i < len(html) and depth > 0:
        open_tag = html.find("<div", i)
        close_tag = html.find("</div", i)
        
        if close_tag == -1:
            break
        
        if open_tag != -1 and open_tag < close_tag:
            depth += 1
            i = open_tag + 5
        else:
            depth -= 1
            i = close_tag + 6
    
    if depth == 0:
        return html[start:close_tag]
    return None

# ── Clean HTML content ────────────────────────────────────────────────────

def clean_html_content(raw: str) -> str:
    """Remove HTML tags, buttons, links, and normalize whitespace."""
    raw = re.sub(r'<script[^>]*>.*?</script>', '', raw, flags=re.DOTALL)
    raw = re.sub(r'<style[^>]*>.*?</style>', '', raw, flags=re.DOTALL)
    raw = re.sub(r'<a\s+[^>]*class="btn_tag[^"]*"[^>]*>.*?</a>', '', raw, flags=re.DOTALL)
    raw = re.sub(r'<a\s+[^>]*class="btn[^"]*"[^>]*>.*?</a>', '', raw, flags=re.DOTALL)
    raw = re.sub(r'<span\s+class="anchor"[^>]*>.*?</span>', '', raw, flags=re.DOTALL)
    raw = re.sub(r'<span\s+class="text-gray[^"]*"[^>]*>.*?</span>', '', raw, flags=re.DOTALL)
    raw = re.sub(r'<i\s+class="fa[^"]*"[^>]*>.*?</i>', '', raw, flags=re.DOTALL)
    raw = re.sub(r'<hr\s*/?>', '', raw, flags=re.DOTALL)
    raw = re.sub(r'<br\s*/?>', '\n', raw, flags=re.DOTALL)
    raw = re.sub(r'</p>', '\n', raw, flags=re.DOTALL)
    raw = re.sub(r'</div>', '\n', raw, flags=re.DOTALL)
    raw = re.sub(r'<[^>]+>', '', raw)
    raw = raw.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    raw = re.sub(r'[ \t]+', ' ', raw)
    raw = re.sub(r'\n{3,}', '\n\n', raw)
    raw = re.sub(r'^\s+', '', raw, flags=re.MULTILINE)
    return raw.strip()

# ── Extract content from a single ayah HTML file ───────────────────────────

def extract_ayah_content(filepath: str) -> str | None:
    """Extract the tafsir text from a Qotb HTML file."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            html = f.read()
    except Exception as e:
        print(f"  ⚠ Cannot read {filepath}: {e}")
        return None

    raw = extract_div_content(html, "div_qotb")
    if not raw:
        print(f"  ⚠ No div_qotb found in {filepath}")
        return None
    
    text = clean_html_content(raw)
    if not text:
        print(f"  ⚠ Empty content in {filepath}")
        return None
    
    return text

# ── Parse filename to get surah and ayah numbers ───────────────────────────

def parse_filename(filename: str) -> tuple[int, int] | None:
    m = re.match(r'sura(\d+)-aya(\d+)\.html', filename)
    if m:
        return int(m.group(1)), int(m.group(2))
    return None

# ── Main ───────────────────────────────────────────────────────────────────

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    pattern = os.path.join(INPUT_DIR, "sura*.html")
    files = glob.glob(pattern)
    print(f"Found {len(files)} HTML files in {INPUT_DIR}")

    surah_verses: dict[int, dict[int, str]] = {}
    for filepath in sorted(files):
        filename = os.path.basename(filepath)
        parsed = parse_filename(filename)
        if not parsed:
            continue
        surah_num, ayah_num = parsed
        if surah_num not in surah_verses:
            surah_verses[surah_num] = {}
        content = extract_ayah_content(filepath)
        if content:
            surah_verses[surah_num][ayah_num] = content
            print(f"  OK {filename} ({len(content)} chars)")
        else:
            print(f"  -- {filename} — empty")

    written = 0
    for surah_num in sorted(surah_verses.keys()):
        verses = surah_verses[surah_num]
        if not verses:
            continue
        sorted_ayahs = sorted(verses.keys())
        lines = []
        for ayah_num in sorted_ayahs:
            lines.append(f"[{ayah_num}]")
            lines.append(verses[ayah_num])
            lines.append("")
        output_path = os.path.join(OUTPUT_DIR, f"{surah_num:03d}.txt")
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        written += 1
        print(f"  📄 {output_path} — {len(sorted_ayahs)} verses")

    print(f"\n✅ Done — {written} surah files written to {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
