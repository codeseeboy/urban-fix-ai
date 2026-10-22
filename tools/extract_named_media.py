import docx
import os

doc = docx.Document('docs/Copy of UrbanFix_AI_Final_Report.docx')
os.makedirs('docs/docx_media', exist_ok=True)

for rel_id, rel in doc.part.related_parts.items():
    if 'image' in rel.content_type:
        filename = os.path.basename(rel.partname)
        filepath = os.path.join('docs/docx_media', filename)
        with open(filepath, 'wb') as f:
            f.write(rel.blob)
        print(f'{rel.partname} -> {filepath}')
