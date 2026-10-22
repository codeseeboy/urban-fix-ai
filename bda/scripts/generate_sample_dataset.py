"""
Generate a small synthetic road-damage dataset so the full BDA pipeline
runs today even before the multi-GB RDD2022 download finishes.
"""
from __future__ import annotations

import json
import random
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import BRONZE_EVENTS, CLASS_MAP, SAMPLE_DIR, ensure_dirs  # noqa: E402

N_IMAGES = 120
WARDS = [f"Ward-{i}" for i in range(1, 11)]
COUNTRIES = ["India", "Japan", "United_States", "Czech"]
STATUSES = ["submitted", "acknowledged", "in_progress", "resolved"]
SIZES = [(640, 480), (800, 600), (1024, 768), (1280, 720)]


def make_image(path: Path, w: int, h: int, boxes: list[tuple], color: tuple) -> None:
    img = Image.new("RGB", (w, h), (random.randint(40, 70),) * 3)
    draw = ImageDraw.Draw(img)
    for _ in range(30):
        x1, y1 = random.randint(0, w - 1), random.randint(0, h - 1)
        x2, y2 = random.randint(0, w - 1), random.randint(0, h - 1)
        shade = random.randint(50, 90)
        draw.line((x1, y1, x2, y2), fill=(shade, shade, shade), width=1)
    for box in boxes:
        draw.rectangle(box, outline=color, width=3)
    img.save(path, format="JPEG", quality=random.randint(70, 95))


def write_voc_xml(path: Path, image_name: str, w: int, h: int, objects: list[dict]) -> None:
    ann = ET.Element("annotation")
    ET.SubElement(ann, "filename").text = image_name
    size = ET.SubElement(ann, "size")
    ET.SubElement(size, "width").text = str(w)
    ET.SubElement(size, "height").text = str(h)
    ET.SubElement(size, "depth").text = "3"
    for obj in objects:
        o = ET.SubElement(ann, "object")
        ET.SubElement(o, "name").text = obj["name"]
        bb = ET.SubElement(o, "bndbox")
        ET.SubElement(bb, "xmin").text = str(obj["xmin"])
        ET.SubElement(bb, "ymin").text = str(obj["ymin"])
        ET.SubElement(bb, "xmax").text = str(obj["xmax"])
        ET.SubElement(bb, "ymax").text = str(obj["ymax"])
    ET.ElementTree(ann).write(path, encoding="utf-8", xml_declaration=True)


def main() -> None:
    ensure_dirs()
    random.seed(42)
    img_dir = SAMPLE_DIR / "images"
    ann_dir = SAMPLE_DIR / "annotations"
    img_dir.mkdir(parents=True, exist_ok=True)
    ann_dir.mkdir(parents=True, exist_ok=True)

    events: list[dict] = []
    base_time = datetime(2024, 1, 1)
    colors = {
        "D00": (220, 180, 40),
        "D10": (40, 180, 220),
        "D20": (220, 80, 40),
        "D40": (220, 40, 40),
    }
    classes = list(CLASS_MAP.keys())
    good_paths: list[Path] = []

    for i in range(N_IMAGES):
        country = random.choice(COUNTRIES)
        stem = f"{country}_{i:04d}"
        img_name = f"{stem}.jpg"
        img_path = img_dir / img_name
        xml_path = ann_dir / f"{stem}.xml"
        w, h = random.choice(SIZES)
        primary = random.choice(classes)
        missing_ann = i % 12 == 0
        corrupt = i % 20 == 0

        objects: list[dict] = []
        boxes: list[tuple] = []
        if corrupt:
            img_path.write_bytes(b"NOT_A_JPEG")
        else:
            n_boxes = 0 if missing_ann else random.randint(1, 3)
            for _ in range(n_boxes):
                bw, bh = random.randint(40, 160), random.randint(30, 120)
                x1 = random.randint(10, max(11, w - bw - 10))
                y1 = random.randint(10, max(11, h - bh - 10))
                box = (x1, y1, x1 + bw, y1 + bh)
                boxes.append(box)
                c = primary if random.random() < 0.7 else random.choice(classes)
                objects.append(
                    {"name": c, "xmin": box[0], "ymin": box[1], "xmax": box[2], "ymax": box[3]}
                )
            make_image(img_path, w, h, boxes, colors[primary])
            good_paths.append(img_path)
            if not missing_ann and objects:
                write_voc_xml(xml_path, img_name, w, h, objects)
            # exact duplicate every 15th image
            if i % 15 == 0 and good_paths:
                img_path.write_bytes(good_paths[0].read_bytes())

        ward = random.choice(WARDS)
        ts = base_time + timedelta(hours=i * 3, minutes=random.randint(0, 50))
        has_pothole = any(o["name"] == "D40" for o in objects)
        events.append(
            {
                "event_type": "issue.created",
                "issue_id": f"UF-{1000 + i}",
                "timestamp": ts.isoformat(),
                "ward": ward,
                "country": country,
                "category": "roads",
                "image_stem": stem,
                "has_pothole": has_pothole,
                "lat": round(19.07 + random.random() * 0.2, 5),
                "lon": round(72.87 + random.random() * 0.2, 5),
            }
        )
        events.append(
            {
                "event_type": "issue.ai_verdict",
                "issue_id": f"UF-{1000 + i}",
                "timestamp": (ts + timedelta(seconds=8)).isoformat(),
                "ward": ward,
                "predicted_class": CLASS_MAP.get(primary, primary),
                "confidence": round(random.uniform(0.55, 0.98), 3),
                "severity": random.choice(["Low", "Medium", "High", "Critical"]),
            }
        )
        if random.random() < 0.7:
            events.append(
                {
                    "event_type": "issue.status_changed",
                    "issue_id": f"UF-{1000 + i}",
                    "timestamp": (ts + timedelta(days=random.randint(1, 20))).isoformat(),
                    "ward": ward,
                    "status": random.choice(STATUSES),
                }
            )

    events_path = BRONZE_EVENTS / "sample_events.jsonl"
    with open(events_path, "w", encoding="utf-8") as f:
        for e in events:
            f.write(json.dumps(e) + "\n")

    print(f"Created {N_IMAGES} sample images in {img_dir}")
    print(f"Annotations in {ann_dir}")
    print(f"Seed events: {events_path} ({len(events)} events)")


if __name__ == "__main__":
    main()
