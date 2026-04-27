import os, re

# Try to find Arabic text in Lucene .cfs files
cfs_files = []
for root, dirs, files in os.walk(r"C:\shamela4\database\store\page"):
    for f in files:
        if f.endswith(".cfs"):
            cfs_files.append(os.path.join(root, f))

print("CFS files:", cfs_files)

# Read first one and look for Arabic UTF-8 sequences
if cfs_files:
    with open(cfs_files[0], "rb") as f:
        data = f.read(50000)  # first 50KB

    # Decode as utf-8 ignoring errors, extract readable Arabic chunks
    text = data.decode("utf-8", errors="ignore")
    # Find Arabic text runs (20+ Arabic chars)
    arabic_chunks = re.findall(r'[؀-ۿݐ-ݿ ،؛؟]{20,}', text)
    print(f"\nFound {len(arabic_chunks)} Arabic chunks in first 50KB:")
    for chunk in arabic_chunks[:10]:
        print(" ", chunk[:150])
