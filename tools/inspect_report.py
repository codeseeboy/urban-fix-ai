import pypdf
import sys

r = pypdf.PdfReader('docs/Final_Project.pdf')
print(f'Total pages: {len(r.pages)}')
for i, p in enumerate(r.pages):
    txt = p.extract_text() or ''
    lines = [l.strip() for l in txt.split('\n') if l.strip()]
    header = ' || '.join(lines[:3]) if lines else 'EMPTY'
    print(f'Page {i+1}: {header[:140]}')
