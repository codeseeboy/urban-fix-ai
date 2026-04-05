"""
Test all images in assetss/ folder against the running AI service.
Usage: python test_all_images.py
"""
import urllib.request, json, os, io, time

IMG_DIR = os.path.join(os.path.dirname(__file__), "assetss")
API_URL = "http://localhost:8000/analyze"
API_KEY = "urbanfix-ai-secret-2026"

SUPPORTED = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
images = sorted([f for f in os.listdir(IMG_DIR) if os.path.splitext(f)[1].lower() in SUPPORTED])

print(f"Found {len(images)} images in assetss/")
print("=" * 70)

all_results = []

for idx, fname in enumerate(images, 1):
    fpath = os.path.join(IMG_DIR, fname)
    with open(fpath, "rb") as f:
        img_data = f.read()

    size_kb = len(img_data) // 1024

    ext = os.path.splitext(fname)[1].lower()
    ct_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".bmp": "image/bmp"}
    content_type = ct_map.get(ext, "image/jpeg")

    boundary = "----Boundary7MA4YWxk"
    body = io.BytesIO()
    body.write(f"--{boundary}\r\n".encode())
    body.write(f'Content-Disposition: form-data; name="file"; filename="{fname}"\r\n'.encode())
    body.write(f"Content-Type: {content_type}\r\n\r\n".encode())
    body.write(img_data)
    body.write(f"\r\n--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        API_URL,
        data=body.getvalue(),
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Authorization": f"Bearer {API_KEY}",
        },
        method="POST",
    )

    print(f"\n[{idx}/{len(images)}] {fname} ({size_kb} KB)")
    start = time.time()
    try:
        resp = urllib.request.urlopen(req, timeout=120)
        result = json.loads(resp.read())
        elapsed = round(time.time() - start, 1)
        all_results.append({"file": fname, "result": result, "time_s": elapsed})

        print(f"  Time     : {elapsed}s")
        print(f"  Valid    : {result['is_valid']}")
        if not result["is_valid"]:
            print(f"  Rejected : {result.get('validation_reason', '')}")
            if result.get("note"):
                print(f"  Note     : {result['note']}")
        else:
            print(f"  Category : {result['category'].upper()}  (conf: {result['category_confidence']:.1%})")
            print(f"  Severity : {result['ai_severity']} ({result['severity']}/5)")
            print(f"  Priority : {result['priority_score']}/100")
            print(f"  Dept     : {result['department_tag']}")
            print(f"  Main     : {result['main_issue']}")
            print(f"  Issues   : {result['issue_count']}")
            for i, iss in enumerate(result.get("detected_issues", []), 1):
                bbox = f"  box={iss['bbox']}" if iss.get("bbox") else "  (no box)"
                print(f"    {i}. {iss['label']}  (conf: {iss['confidence']:.1%}){bbox}")
            print(f"  Tags     : {result['ai_tags']}")
            print(f"  Model    : {result['model_used']}")
            if result.get("note"):
                print(f"  Note     : {result['note']}")
    except Exception as e:
        elapsed = round(time.time() - start, 1)
        print(f"  ERROR ({elapsed}s): {e}")
        all_results.append({"file": fname, "error": str(e), "time_s": elapsed})

print("\n" + "=" * 70)
print("  URBANFIX AI — BATCH TEST SUMMARY")
print("=" * 70)
print(f"  {'Image':<35} {'Status':<10} {'Category':<12} {'Severity':<8} {'Pri':<5} {'Issues':<7} {'Time'}")
print("  " + "-" * 67)
for r in all_results:
    if "error" in r:
        print(f"  {r['file']:<35} {'ERROR':<10} {'-':<12} {'-':<8} {'-':<5} {'-':<7} {r['time_s']}s")
    else:
        res = r["result"]
        valid = "VALID" if res["is_valid"] else "REJECTED"
        cat = res["category"].upper() if res["is_valid"] else "-"
        sev = res.get("ai_severity", "-")
        pri = str(res.get("priority_score", 0))
        iss = str(res.get("issue_count", 0))
        print(f"  {r['file']:<35} {valid:<10} {cat:<12} {sev:<8} {pri:<5} {iss:<7} {r['time_s']}s")
print("=" * 70)

# Save full JSON results
out_path = os.path.join(os.path.dirname(__file__), "test_results.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(all_results, f, indent=2)
print(f"\nFull results saved to: {out_path}")
