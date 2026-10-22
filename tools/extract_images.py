import docx
import os

doc = docx.Document('docs/Copy of UrbanFix_AI_Final_Report.docx')
os.makedirs('docs/extracted_figures', exist_ok=True)

image_count = 0
for rel_id, rel in doc.part.related_parts.items():
    if 'image' in rel.content_type:
        image_count += 1
        ext = rel.content_type.split('/')[-1]
        filename = f'docs/extracted_figures/image_{image_count}.{ext}'
        with open(filename, 'wb') as f:
            f.write(rel.blob)
        print(f'Saved {filename} ({len(rel.blob)} bytes, type: {rel.content_type})')

print(f'Total images extracted: {image_count}')
