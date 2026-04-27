"""
Extract tafsir from Shamela v4.
Output: data/tafsir/{source}/{001-114}.txt
"""
import jpype, jpype.imports, glob, os, json, sqlite3, re
from collections import defaultdict

JVM_DLL    = r"C:\shamela4\app\win\64\jre\1\bin\server\jvm.dll"
LUCENE_DIR = r"C:\shamela4\app\lucene\1"
PAGE_INDEX = r"C:\shamela4\database\store\page"
TITLE_INDEX= r"C:\shamela4\database\store\title"
TAFSEER_DB = r"C:\shamela4\database\service\tafseer.db"
QURAN_JSON = r"C:\Mes Projets\tadabbur\data\quran\quran.json"
OUT_DIR    = r"C:\Mes Projets\tadabbur\data\tafsir"
DB_BASE    = r"C:\shamela4\database\book"

BOOKS_WITH_SERVICE = {7798: "tabari", 1503: "ibn-kathir"}
BOOKS_WITHOUT_SERVICE = {9776: "ibn-achour", 23635: "fakhri-razi"}

SURAH_NAMES_AR = [
    "الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال",
    "التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء",
    "الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء",
    "النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر",
    "يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان",
    "الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم",
    "القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف",
    "الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة",
    "المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ",
    "النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق",
    "الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين",
    "العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر",
    "الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد",
    "الإخلاص","الفلق","الناس",
]
NAME_TO_NUM = {n: i+1 for i, n in enumerate(SURAH_NAMES_AR)}
# Canonical aliases
NAME_TO_NUM["سبإ"] = 34; NAME_TO_NUM["سبأ"] = 34
# Alternative names used in classical tafsirs
NAME_TO_NUM["براءة"] = 9          # التوبة
NAME_TO_NUM["بني إسرائيل"] = 17   # الإسراء
NAME_TO_NUM["بنى إسرائيل"] = 17
NAME_TO_NUM["سبحان"] = 17
NAME_TO_NUM["الملائكة"] = 35      # فاطر
NAME_TO_NUM["المؤمن"] = 40        # غافر
NAME_TO_NUM["حم المؤمن"] = 40
NAME_TO_NUM["حم عسق"] = 42        # الشورى
NAME_TO_NUM["عسق"] = 42
NAME_TO_NUM["الدهر"] = 76         # الإنسان
NAME_TO_NUM["هل أتى"] = 76
NAME_TO_NUM["اقرأ"] = 96          # العلق
NAME_TO_NUM["ألم نشرح"] = 94      # الشرح
NAME_TO_NUM["الضحا"] = 93         # الضحى
NAME_TO_NUM["تبت"] = 111          # المسد
NAME_TO_NUM["لهب"] = 111

# Strip Arabic tashkeel (diacritics/harakat) — titles in Shamela often have full tashkeel
_TASHKEEL = re.compile(r'[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]')

def _norm(s: str) -> str:
    """Normalize Arabic: strip tashkeel, unify hamza/alef variants, strip leading ال."""
    s = _TASHKEEL.sub("", s)
    s = s.replace("ٱ","ا").replace("إ","ا").replace("أ","ا").replace("آ","ا").replace("ة","ه")
    return s.strip()

def name_to_surah(name):
    name_n = _norm(name)
    best = None
    best_len = 0
    for k, v in NAME_TO_NUM.items():
        k2 = _norm(k)
        if k2 == name_n:
            return v  # exact match wins immediately
        # substring: prefer longest key match to avoid "هود" matching inside "العهود"
        if k2 and k2 in name_n and len(k2) > best_len:
            best, best_len = v, len(k2)
    return best

# ── Start JVM ────────────────────────────────────────────────────────────────
jars = glob.glob(os.path.join(LUCENE_DIR, "*.jar"))
jpype.startJVM(JVM_DLL, f"-Djava.class.path={os.pathsep.join(jars)}", convertStrings=True)

from org.apache.lucene.store import FSDirectory
from org.apache.lucene.index import DirectoryReader, Term
from org.apache.lucene.search import IndexSearcher, PrefixQuery, TermQuery
from java.nio.file import Paths

def open_idx(path):
    d = FSDirectory.open(Paths.get(path)); r = DirectoryReader.open(d)
    return d, r, IndexSearcher(r), r.storedFields()

pg_dir, pg_r, pg_s, pg_st = open_idx(PAGE_INDEX)
ti_dir, ti_r, ti_s, ti_st = open_idx(TITLE_INDEX)

def get_body(book_id, page_id):
    hits = pg_s.search(TermQuery(Term("id", f"{book_id}-{page_id}")), 1)
    if not hits.totalHits.value: return None
    for f in pg_st.document(hits.scoreDocs[0].doc).getFields():
        if str(f.name()) == "body": return str(f.stringValue())
    return None

def get_all_pages_sorted(book_id):
    hits = pg_s.search(PrefixQuery(Term("id", f"{book_id}-")), 100000)
    pages = []
    for hit in hits.scoreDocs:
        doc = pg_st.document(hit.doc)
        pid = body = None
        for f in doc.getFields():
            n, v = str(f.name()), f.stringValue()
            if n == "id": pid = int(str(v).split("-")[1])
            if n == "body": body = str(v) if v else None
        if pid is not None and body: pages.append((pid, body))
    return sorted(pages)

def get_all_titles(book_id):
    hits = ti_s.search(PrefixQuery(Term("id", f"{book_id}-")), 100000)
    titles = {}
    for hit in hits.scoreDocs:
        doc = ti_st.document(hit.doc)
        tid = body = None
        for f in doc.getFields():
            n, v = str(f.name()), f.stringValue()
            if n == "id": tid = int(str(v).split("-")[1])
            if n == "body": body = str(v) if v else None
        if tid is not None: titles[tid] = body
    return titles

def book_db_path(book_id):
    subfolder = str(book_id % 1000).zfill(3)
    return os.path.join(DB_BASE, subfolder, f"{book_id}.db")

def build_surah_page_map(book_id, titles_dict):
    """Build {surah_num: start_page_id} from title Lucene + SQLite page refs."""
    db_path = book_db_path(book_id)
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    surah_starts = {}  # surah_num → start page_id

    # Patterns for surah title detection (ordered: most specific first)
    patterns = [
        r'[١-٩٠\d]+[.\-–]\s*سورة\s+(.+)',         # "N- سورة NAME" or "N. سورة NAME"
        r'^\[?سورة\s+(.+?)(?:\s*[\(\[].*)?$',     # "سورة NAME" or "[سورة NAME ..."
        r'^(.+?)\s*[\(\[]\s*سورة',                # "NAME (سورة..."
        r'سورة\s+(.+?)(?:\s*[\(\[،,].*)?$',       # fallback: "سورة NAME" anywhere in string
    ]

    for title_id, body in sorted(titles_dict.items()):
        if not body: continue
        body_clean = body.strip()
        for pat in patterns:
            m = re.match(pat, body_clean)
            if m:
                surah_num = name_to_surah(m.group(1))
                if surah_num and surah_num not in surah_starts:
                    # Get page reference from SQLite
                    cur.execute("SELECT page FROM title WHERE id=?", (title_id,))
                    row = cur.fetchone()
                    if row and row[0]:
                        surah_starts[surah_num] = row[0]
                break

    conn.close()
    return surah_starts

# ── Build key_id → surah mapping ───────────────────────────────────────────────
quran = json.load(open(QURAN_JSON, encoding="utf-8"))
key_to_surah = {}
kid = 1
for s in range(1, 115):
    for _ in quran[str(s)]:
        key_to_surah[kid] = s; kid += 1

# ── Extract WITH service ────────────────────────────────────────────────────────
conn = sqlite3.connect(TAFSEER_DB); cur = conn.cursor()

for book_id, source_name in BOOKS_WITH_SERVICE.items():
    print(f"\n=== {source_name} (book {book_id}) ===")
    out_dir = os.path.join(OUT_DIR, source_name); os.makedirs(out_dir, exist_ok=True)

    surah_pages = defaultdict(list)
    cur.execute("SELECT key_id, page_id FROM service WHERE book_id=? ORDER BY key_id, page_id", (book_id,))
    seen = defaultdict(set)
    for key_id, page_id in cur.fetchall():
        surah = key_to_surah.get(key_id)
        if surah and page_id not in seen[surah]:
            surah_pages[surah].append(page_id); seen[surah].add(page_id)

    found = missing = 0
    for surah in range(1, 115):
        parts = []
        for page_id in surah_pages.get(surah, []):
            body = get_body(book_id, page_id)
            if body: parts.append(body.strip()); found += 1
            else: missing += 1
        with open(os.path.join(out_dir, f"{surah:03d}.txt"), "w", encoding="utf-8") as f:
            f.write("\n\n".join(parts))

    print(f"  pages found={found} missing={missing}")

conn.close()

# ── Extract WITHOUT service ─────────────────────────────────────────────────────
for book_id, source_name in BOOKS_WITHOUT_SERVICE.items():
    print(f"\n=== {source_name} (book {book_id}) ===")
    out_dir = os.path.join(OUT_DIR, source_name); os.makedirs(out_dir, exist_ok=True)

    titles = get_all_titles(book_id)
    surah_starts = build_surah_page_map(book_id, titles)
    print(f"  Surah boundaries found: {len(surah_starts)} / 114")
    print(f"  Sample: { {k: surah_starts[k] for k in sorted(surah_starts)[:5]} }")

    # Sort starts: [(surah_num, start_page_id), ...]
    sorted_starts = sorted(surah_starts.items(), key=lambda x: x[1])
    if not sorted_starts:
        print("  No surah boundaries detected, skipping."); continue

    # Get all pages sorted
    pages = get_all_pages_sorted(book_id)
    print(f"  Total pages in Lucene: {len(pages)}")

    # Assign pages to surahs based on page_id ranges
    boundary_pages = [p for _, p in sorted_starts]
    boundary_surahs = [s for s, _ in sorted_starts]
    first_content_page = boundary_pages[0]

    surah_content = defaultdict(list)
    for page_id, body in pages:
        # Skip intro pages before first detected surah
        if page_id < first_content_page:
            continue
        # Find which surah this page belongs to
        assigned = boundary_surahs[0]
        for i, bp in enumerate(boundary_pages):
            if page_id >= bp:
                assigned = boundary_surahs[i]
            else:
                break
        surah_content[assigned].append(body.strip())

    for surah, parts in surah_content.items():
        with open(os.path.join(out_dir, f"{surah:03d}.txt"), "w", encoding="utf-8") as f:
            f.write("\n\n".join(parts))

    print(f"  Surahs written: {sorted(surah_content.keys())}")

# ── Cleanup ────────────────────────────────────────────────────────────────────
pg_r.close(); pg_dir.close()
ti_r.close(); ti_dir.close()
jpype.shutdownJVM()
print("\nDone.")
