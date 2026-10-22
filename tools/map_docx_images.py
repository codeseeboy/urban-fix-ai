import docx

doc = docx.Document('docs/Copy of UrbanFix_AI_Final_Report.docx')
for p in doc.paragraphs:
    # check if paragraph has drawing / blip
    images = []
    for run in p.runs:
        blips = run._r.xpath('.//a:blip/@r:embed')
        for b in blips:
            rel = doc.part.related_parts.get(b)
            if rel:
                images.append(rel.partname)
    if images or 'Figure' in p.text:
        print(f'{p.text.strip()} -> {images}')
