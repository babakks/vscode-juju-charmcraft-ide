import sys
import re
from typing import List


def main(argv: List[str]):
    md_file = argv[1]
    with open(md_file, "rt") as f:
        md = f.read()
    sep = '<a href="#heading--'
    entries = [(x if i == 0 else sep + x) for i, x in enumerate(md.split(sep))]
    pat = re.compile("""^<a href="#heading--(.*?)">""")
    for i, e in enumerate(entries):
        match = pat.match(e)
        entry_file = (match.group(1) if match else "{:02}".format(i)) + ".md"
        with open(entry_file, "wt") as f:
            f.write(e)

if __name__ == "__main__":
    main(sys.argv)
