"""
Debug surah boundary detection: show which surahs are found/missing and why.
"""
import jpype, jpype.imports, glob, os, re, json

JVM_DLL    = r"C:\shamela4\app\win\64\jre\1\bin\server\jvm.dll"
LUCENE_DIR = r"C:\shamela4\app\lucene\1"
TITLE_INDEX= r"C:\shamela4\database\store\title"
OUT        = r"C:\Mes Projets\tadabbur\scripts\debug-titles.json"

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
NAME_TO_NUM["سبإ"] = 34; NAME_TO_NUM["سبأ"] = 34
NAME_TO_NUM["براءة"] = 9; NAME_TO_NUM["بني إسرائيل"] = 17; NAME_TO_NUM["بنى إسرائيل"] = 17
NAME_TO_NUM["سبحان"] = 17; NAME_TO_NUM["الملائكة"] = 35; NAME_TO_NUM["المؤمن"] = 40
NAME_TO_NUM["حم المؤمن"] = 40; NAME_TO_NUM["حم عسق"] = 42; NAME_TO_NUM["عسق"] = 42
NAME_TO_NUM["الدهر"] = 76; NAME_TO_NUM["هل أتى"] = 76; NAME_TO_NUM["اقرأ"] = 96
NAME_TO_NUM["ألم نشرح"] = 94; NAME_TO_NUM["الضحا"] = 93; NAME_TO_NUM["تبت"] = 111; NAME_TO_NUM["لهب"] = 111

_TASHKEEL = re.compile(r'[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]')
def _norm(s):
    s = _TASHKEEL.sub("", s)
    return s.replace("ٱ","ا").replace("إ","ا").replace("أ","ا").replace("آ","ا").replace("ة","ه").strip()

def name_to_surah(name):
    name_n = _norm(name)
    best = None; best_len = 0
    for k, v in NAME_TO_NUM.items():
        k2 = _norm(k)
        if k2 == name_n: return v
        if k2 and k2 in name_n and len(k2) > best_len:
            best, best_len = v, len(k2)
    return best

patterns = [
    r'[١-٩٠\d]+[.\-–]\s*سورة\s+(.+)',
    r'^\[?سورة\s+(.+?)(?:\s*[\(\[].*)?$',
    r'^(.+?)\s*[\(\[]\s*سورة',
    r'سورة\s+(.+?)(?:\s*[\(\[،,].*)?$',
]

jars = glob.glob(os.path.join(LUCENE_DIR, "*.jar"))
jpype.startJVM(JVM_DLL, f"-Djava.class.path={os.pathsep.join(jars)}", convertStrings=True)

from org.apache.lucene.store import FSDirectory
from org.apache.lucene.index import DirectoryReader, Term
from org.apache.lucene.search import IndexSearcher, PrefixQuery
from java.nio.file import Paths

d = FSDirectory.open(Paths.get(TITLE_INDEX))
r = DirectoryReader.open(d)
s = IndexSearcher(r)
stored = r.storedFields()

def get_all_titles(book_id):
    hits = s.search(PrefixQuery(Term("id", f"{book_id}-")), 100000)
    titles = {}
    for hit in hits.scoreDocs:
        doc = stored.document(hit.doc)
        tid = body = None
        for f in doc.getFields():
            n, v = str(f.name()), f.stringValue()
            if n == "id": tid = int(str(v).split("-")[1])
            if n == "body": body = str(v) if v else None
        if tid is not None: titles[tid] = body
    return titles

result = {}

for book_id, name in [(9776, "ibn_achour"), (23635, "fakhri_razi")]:
    titles = get_all_titles(book_id)

    found_surahs = {}   # surah_num -> (title_id, body)
    unmatched_surah_titles = []  # titles with "سورة" that didn't match

    for title_id, body in sorted(titles.items()):
        if not body or "سورة" not in body: continue
        body_clean = body.strip()
        matched = False
        for pat in patterns:
            m = re.match(pat, body_clean)
            if m:
                surah_num = name_to_surah(m.group(1))
                if surah_num and surah_num not in found_surahs:
                    found_surahs[surah_num] = {"title_id": title_id, "body": body_clean, "captured": m.group(1)}
                matched = True
                break
        if not matched:
            unmatched_surah_titles.append({"title_id": title_id, "body": body_clean})

    missing = sorted(set(range(1, 115)) - set(found_surahs.keys()))

    result[name] = {
        "found_count": len(found_surahs),
        "missing_surahs": missing,
        "missing_names": [SURAH_NAMES_AR[s-1] for s in missing],
        "unmatched_titles_with_surah": unmatched_surah_titles[:50],
        "sample_found": {str(k): v for k, v in sorted(found_surahs.items())[:10]},
    }

r.close(); d.close()
jpype.shutdownJVM()

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
print("Done ->", OUT)
