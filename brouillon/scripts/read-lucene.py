import jpype, jpype.imports, glob, os, json, sqlite3

JVM_DLL = r"C:\shamela4\app\win\64\jre\1\bin\server\jvm.dll"
LUCENE_DIR = r"C:\shamela4\app\lucene\1"
TITLE_INDEX = r"C:\shamela4\database\store\title"
OUT = r"C:\Mes Projets\tadabbur\scripts\lucene-sample.json"

jars = glob.glob(os.path.join(LUCENE_DIR, "*.jar"))
jpype.startJVM(JVM_DLL, f"-Djava.class.path={os.pathsep.join(jars)}", convertStrings=True)

from org.apache.lucene.store import FSDirectory
from org.apache.lucene.index import DirectoryReader, Term
from org.apache.lucene.search import IndexSearcher, PrefixQuery, TermQuery, WildcardQuery
from java.nio.file import Paths

d = FSDirectory.open(Paths.get(TITLE_INDEX))
r = DirectoryReader.open(d)
s = IndexSearcher(r)
stored = r.storedFields()

# Get ALL titles for ibn achour and fakhri razi
def get_all_titles(book_id):
    q = PrefixQuery(Term("id", f"{book_id}-"))
    hits = s.search(q, 50000)
    titles = []
    for hit in hits.scoreDocs:
        doc = stored.document(hit.doc)
        entry = {}
        for f in doc.getFields():
            v = f.stringValue()
            entry[str(f.name())] = str(v) if v else None
        titles.append(entry)
    return titles

result = {}
for book_id, name in [(9776, "ibn_achour"), (23635, "fakhri_razi")]:
    all_titles = get_all_titles(book_id)
    # Filter titles containing سورة
    surah_titles = [t for t in all_titles if t.get("body") and "سورة" in t["body"]]
    result[f"{name}_total_titles"] = len(all_titles)
    result[f"{name}_surah_titles_count"] = len(surah_titles)
    result[f"{name}_surah_titles_sample"] = surah_titles[:15]

r.close(); d.close()
jpype.shutdownJVM()

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
print("Done ->", OUT)
