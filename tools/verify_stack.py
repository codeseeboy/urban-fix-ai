"""
End-to-end verification of the running UrbanFix stack.

Checks every service that should be up, then does the only test that really
matters: pulls REAL civic photos that citizens uploaded to the live app and
pushes them back through the AI service, comparing today's verdict against the
verdict stored in the database when the report was filed.

That catches drift the unit tests cannot — a model swap, a threshold change, or
a broken preprocessing step will show up as a disagreement here.

  python tools/verify_stack.py                # checks + 5 real images
  python tools/verify_stack.py --images 15    # more images
  python tools/verify_stack.py --skip-ai      # service checks only
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BACKEND = os.environ.get("BACKEND_URL", "http://localhost:5000")
AI_SERVICE = os.environ.get("AI_SERVICE_URL", "http://127.0.0.1:8000")
ADMIN = os.environ.get("ADMIN_URL", "http://localhost:3000")
DASHBOARD = os.environ.get("DASHBOARD_URL", "http://localhost:8502")

OK, BAD, WARN = "  OK  ", " FAIL ", " WARN "


def get(url: str, timeout: int = 20) -> tuple[int, bytes]:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:  # connection refused, DNS, timeout
        return 0, str(e).encode()


def check(label: str, url: str, expect: int = 200) -> bool:
    code, body = get(url)
    tag = OK if code == expect else BAD
    detail = "" if code == expect else f"  ({code or 'unreachable'})"
    print(f"[{tag}] {label:<34} {url}{detail}")
    return code == expect


def read_env_key(path: Path, key: str) -> str:
    """Pull one value out of a .env without importing dotenv."""
    if not path.exists():
        return ""
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if line.startswith(f"{key}=") and not line.startswith("#"):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def post_image(url: str, image: bytes, filename: str, api_key: str) -> dict:
    """Multipart POST without pulling in requests."""
    boundary = "----urbanfix-verify-boundary"
    body = b"".join([
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode(),
        b"Content-Type: image/jpeg\r\n\r\n",
        image,
        f"\r\n--{boundary}--\r\n".encode(),
    ])
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    if api_key:
        req.add_header("Authorization", f"Bearer {api_key}")
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--images", type=int, default=5)
    parser.add_argument("--skip-ai", action="store_true")
    args = parser.parse_args()

    repo = Path(__file__).resolve().parents[1]
    failures = 0

    print("=" * 74)
    print("SERVICE CHECKS")
    print("=" * 74)
    failures += not check("Backend API", f"{BACKEND}/")
    failures += not check("Backend -> Supabase (issues)", f"{BACKEND}/api/issues?limit=1")
    failures += not check("Backend stats", f"{BACKEND}/api/gamification/stats")
    failures += not check("Backend GeoJSON", f"{BACKEND}/api/issues/geojson")
    failures += not check("Admin portal", f"{ADMIN}/")
    failures += not check("AI service health", f"{AI_SERVICE}/health")
    check("BDA dashboard (optional)", f"{DASHBOARD}/_stcore/health")

    code, body = get(f"{AI_SERVICE}/health")
    # The service reports "ok" once every model is resident, "loading" before.
    ai_ready = code == 200 and (b'"status":"ok"' in body or b'"status":"ready"' in body)
    if code == 200:
        print(f"         AI models: {json.loads(body).get('status')}")

    print()
    print("=" * 74)
    print("DATA CHECKS")
    print("=" * 74)
    code, body = get(f"{BACKEND}/api/issues?limit=500", timeout=90)
    issues: list = json.loads(body) if code == 200 else []
    with_image = [i for i in issues if i.get("image")]
    with_coords = [i for i in issues if (i.get("location") or {}).get("coordinates")]
    print(f"[{OK if issues else BAD}] issues returned              {len(issues)}")
    print(f"[{OK if with_image else WARN}] with an image                {len(with_image)}")
    print(f"[{OK if with_coords else WARN}] with coordinates             {len(with_coords)}")

    depts = sorted({i.get("departmentTag") for i in issues if i.get("departmentTag")})
    print(f"         distinct departmentTag values: {len(depts)}")
    if len(depts) > 6:
        print(f"         {depts}")
        print("         ^ multiple vocabularies in one column; the BDA silver layer")
        print("           normalises these (bda/config.py DEPT_NORMALIZATION).")

    if args.skip_ai or not ai_ready:
        if not ai_ready and not args.skip_ai:
            print("\nAI models are still loading - skipping the live image test.")
        print(f"\n{'PASSED' if not failures else str(failures) + ' CHECK(S) FAILED'}")
        sys.exit(1 if failures else 0)

    print()
    print("=" * 74)
    print(f"LIVE IMAGE TEST - real citizen photos re-scored by the AI service")
    print("=" * 74)
    api_key = read_env_key(repo / "ai-service" / ".env", "AI_API_KEY")
    sample = with_image[: args.images]
    agree = 0
    confidences: list[float] = []

    for n, issue in enumerate(sample, 1):
        url = issue["image"]
        stored_cat = issue.get("category")
        stored_sev = issue.get("aiSeverity")
        stored_dept = issue.get("departmentTag")
        code, blob = get(url, timeout=90)
        if code != 200 or len(blob) < 1000:
            print(f"  [{WARN}] {n}. could not fetch image ({code})")
            continue
        started = time.time()
        try:
            res = post_image(f"{AI_SERVICE}/analyze", blob, f"issue_{n}.jpg", api_key)
        except Exception as exc:
            print(f"  [{BAD}] {n}. /analyze failed: {exc}")
            failures += 1
            continue
        took = time.time() - started
        now_cat = res.get("category")
        confidences.append(float(res.get("category_confidence") or 0.0))
        match = now_cat == stored_cat
        agree += match
        flag = "same" if match else "DIFFERS"
        # Titles contain em-dashes; the Windows console is cp1252 and would
        # raise UnicodeEncodeError mid-run.
        title = (issue.get("title") or "")[:44]
        title = title.encode(sys.stdout.encoding or "utf-8", "replace").decode(
            sys.stdout.encoding or "utf-8", "replace"
        )
        print(f"  {n}. {title:<44}")
        print(f"     stored : {stored_cat:<10} {str(stored_sev):<9} {stored_dept}")
        print(f"     now    : {str(now_cat):<10} {str(res.get('ai_severity')):<9} "
              f"{res.get('department_tag')}   conf={res.get('category_confidence', 0):.2f} "
              f"({took:.1f}s)  [{flag}]")

    if sample:
        print(f"\n  category agreement: {agree}/{len(sample)} "
              f"({agree / len(sample) * 100:.0f}%)")
        print("  Disagreement is not automatically a bug - the stored verdict may")
        print("  predate a model change. It is a prompt to look, not a failure.")
        if confidences:
            lo, hi = min(confidences), max(confidences)
            print(f"  category_confidence range: {lo:.2f} - {hi:.2f}")
            if hi < 0.40:
                print("  ^ every score is low. The SigLIP router spreads probability")
                print("    across all six categories, so raw confidence reads low even")
                print("    when the argmax is right. Worth a look before anyone quotes")
                print("    'AI confidence' in a report or demo.")

    print()
    print("=" * 74)
    print("PASSED" if not failures else f"{failures} CHECK(S) FAILED")
    print("=" * 74)
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
