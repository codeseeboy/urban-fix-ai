"""
Generate a shareable team PDF:
UrbanFix.AI — BDA Data Fusion (Final Team Report)

Output: docs/UrbanFix_BDA_Data_Fusion_Team_Report.pdf
"""
from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT = Path(__file__).resolve().parent / "UrbanFix_BDA_Data_Fusion_Team_Report.pdf"
NAVY = colors.HexColor("#1B365D")
TEAL = colors.HexColor("#2A6F7F")
GOLD = colors.HexColor("#C4A35A")
LIGHT = colors.HexColor("#F4F6F8")
ROW = colors.HexColor("#EEF3F7")
GREEN = colors.HexColor("#1F7A4D")
AMBER = colors.HexColor("#8A5A00")
RED = colors.HexColor("#8B2E2E")


def styles():
    base = getSampleStyleSheet()
    s = {}
    s["cover_kicker"] = ParagraphStyle(
        "cover_kicker",
        parent=base["Normal"],
        fontName="Times-Bold",
        fontSize=11,
        textColor=TEAL,
        alignment=TA_CENTER,
        spaceAfter=8,
        letterSpacing=0.6,
    )
    s["cover_title"] = ParagraphStyle(
        "cover_title",
        parent=base["Title"],
        fontName="Times-Bold",
        fontSize=22,
        leading=26,
        textColor=NAVY,
        alignment=TA_CENTER,
        spaceAfter=8,
    )
    s["cover_sub"] = ParagraphStyle(
        "cover_sub",
        parent=base["Normal"],
        fontName="Times-Italic",
        fontSize=13,
        leading=18,
        textColor=colors.HexColor("#334155"),
        alignment=TA_CENTER,
        spaceAfter=6,
    )
    s["h1"] = ParagraphStyle(
        "h1",
        parent=base["Heading1"],
        fontName="Times-Bold",
        fontSize=14,
        leading=18,
        textColor=NAVY,
        spaceBefore=14,
        spaceAfter=8,
        borderPadding=3,
    )
    s["h2"] = ParagraphStyle(
        "h2",
        parent=base["Heading2"],
        fontName="Times-Bold",
        fontSize=12,
        leading=16,
        textColor=TEAL,
        spaceBefore=10,
        spaceAfter=6,
    )
    s["body"] = ParagraphStyle(
        "body",
        parent=base["Normal"],
        fontName="Times-Roman",
        fontSize=11,
        leading=15.5,
        alignment=TA_JUSTIFY,
        spaceAfter=7,
    )
    s["center"] = ParagraphStyle(
        "center", parent=s["body"], alignment=TA_CENTER, fontName="Times-Italic"
    )
    s["note"] = ParagraphStyle(
        "note",
        parent=s["body"],
        fontName="Times-Italic",
        textColor=colors.HexColor("#334155"),
        leftIndent=8,
        rightIndent=8,
        spaceBefore=4,
        spaceAfter=10,
    )
    s["bullet"] = ParagraphStyle(
        "bullet",
        parent=s["body"],
        leftIndent=14,
        bulletIndent=0,
        alignment=TA_LEFT,
        spaceAfter=3,
    )
    s["caption"] = ParagraphStyle(
        "caption",
        parent=s["body"],
        fontName="Times-Italic",
        fontSize=9.5,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#475569"),
        spaceBefore=2,
        spaceAfter=10,
    )
    s["footer"] = ParagraphStyle(
        "footer",
        parent=base["Normal"],
        fontName="Times-Roman",
        fontSize=8.5,
        textColor=colors.HexColor("#64748B"),
        alignment=TA_CENTER,
    )
    s["th"] = ParagraphStyle(
        "th",
        parent=base["Normal"],
        fontName="Times-Bold",
        fontSize=9.5,
        leading=12.5,
        textColor=colors.white,
        alignment=TA_LEFT,
    )
    s["td"] = ParagraphStyle(
        "td",
        parent=base["Normal"],
        fontName="Times-Roman",
        fontSize=9.5,
        leading=12.5,
        textColor=colors.HexColor("#1E293B"),
        alignment=TA_LEFT,
    )
    s["code"] = ParagraphStyle(
        "code",
        parent=base["Code"],
        fontName="Courier",
        fontSize=8.5,
        leading=11.5,
        textColor=NAVY,
        backColor=LIGHT,
        leftIndent=6,
        rightIndent=6,
        spaceBefore=6,
        spaceAfter=8,
    )
    s["toc"] = ParagraphStyle(
        "toc",
        parent=s["body"],
        fontName="Times-Roman",
        fontSize=11,
        leading=16,
        alignment=TA_LEFT,
        leftIndent=8,
        spaceAfter=2,
    )
    return s


def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, h - 12 * mm, w, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Times-Bold", 8.5)
    canvas.drawString(18 * mm, h - 7.5 * mm, "UrbanFix.AI  —  BDA Mini Project  —  Data Fusion")
    canvas.setFont("Times-Roman", 8.5)
    canvas.drawRightString(w - 18 * mm, h - 7.5 * mm, "Team briefing document")
    canvas.setFillColor(GOLD)
    canvas.rect(0, h - 13.2 * mm, w, 1.2 * mm, fill=1, stroke=0)
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, w, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Times-Roman", 8.5)
    canvas.drawString(18 * mm, 5 * mm, "Internal team copy  |  For PPT and viva preparation  |  Not a slide deck")
    canvas.drawRightString(w - 18 * mm, 5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def cover_header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, h - 28 * mm, w, 28 * mm, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(0, h - 30 * mm, w, 2 * mm, fill=1, stroke=0)
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, w, 22 * mm, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(0, 22 * mm, w, 2 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Times-Bold", 10)
    canvas.drawCentredString(w / 2, 10 * mm, "Share this PDF with the team  ·  Read first, then make slides")
    canvas.restoreState()


def table(headers, rows, col_widths):
    data = [[Paragraph(h, STYLES["th"]) for h in headers]]
    for row in rows:
        data.append([Paragraph(c, STYLES["td"]) for c in row])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            cmds.append(("BACKGROUND", (0, i), (-1, i), ROW))
        else:
            cmds.append(("BACKGROUND", (0, i), (-1, i), colors.white))
    t.setStyle(TableStyle(cmds))
    return t


def bullets(items):
    flow = []
    for item in items:
        flow.append(Paragraph(f"•  {item}", STYLES["bullet"]))
    return flow


def p(text):
    return Paragraph(text, STYLES["body"])


def h1(text):
    return Paragraph(text, STYLES["h1"])


def h2(text):
    return Paragraph(text, STYLES["h2"])


STYLES = styles()


def build():
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=1.9 * cm,
        rightMargin=1.9 * cm,
        topMargin=2.0 * cm,
        bottomMargin=2.0 * cm,
        title="UrbanFix.AI — BDA Data Fusion Team Report",
        author="UrbanFix AI Team",
        subject="Big Data Analytics mini project — data fusion briefing",
    )
    W = 17.2 * cm
    story = []

    # ── Cover ──
    story.append(Spacer(1, 28 * mm))
    story.append(Paragraph("BIG DATA ANALYTICS  ·  MINI PROJECT", STYLES["cover_kicker"]))
    story.append(Paragraph("UrbanFix.AI 2.0", STYLES["cover_title"]))
    story.append(
        Paragraph(
            "Data Fusion of Civic Reports, Rainfall and Ward Data<br/>using Kafka, HDFS and Apache Spark",
            STYLES["cover_sub"],
        )
    )
    story.append(Spacer(1, 8 * mm))
    meta = table(
        ["Item", "Detail"],
        [
            ["Document type", "Final team briefing report (for PPT + viva). Not a slide deck."],
            ["Subject", "Big Data Analytics (BDA)"],
            ["Host application", "UrbanFix AI — civic issue reporting platform"],
            ["Core idea", "Combine civic reports + rainfall + ward data to find hidden city patterns"],
            ["BDA stack", "Apache Kafka · Hadoop/HDFS (data lake) · Apache Spark"],
            ["Supporting ML", "YOLO pothole detection on cleaned data (secondary, not the BDA core)"],
            ["Audience", "Project team members"],
            ["Status", "Agreed concept: feasible if scoped as a mini project, not full V2 platform"],
        ],
        [4.2 * cm, 13.0 * cm],
    )
    story.append(meta)
    story.append(Spacer(1, 10 * mm))
    story.append(
        Paragraph(
            "One sentence for the whole team: <b>this BDA mini project is about data fusion — "
            "not about rebuilding the UrbanFix app, and not about training YOLO first.</b>",
            STYLES["note"],
        )
    )
    story.append(PageBreak())

    # ── How to use ──
    story.append(h1("0. How the team should use this document"))
    story.extend(
        bullets(
            [
                "Read this PDF fully before making slides. Each numbered section can become 1–2 PPT slides.",
                "Do not copy long paragraphs onto slides. Use the short takeaway under each section, plus one table or diagram.",
                "Keep speaker notes for viva. The 1-minute answer in Section 15 should be learnt by everyone.",
                "This document is the shared source of truth. If a slide contradicts this PDF, the PDF wins until the team updates it.",
                "Implementation stays small: a working fusion pipeline + charts + viva story. Full city operations software is out of scope.",
            ]
        )
    )
    story.append(h2("Suggested 12-slide PPT (from this report)"))
    story.append(
        table(
            ["Slide", "Title", "Read section"],
            [
                ["1", "Title — UrbanFix BDA: Data Fusion", "Cover + §1"],
                ["2", "Why fusion is needed for the city", "§2"],
                ["3", "Data sources we combine", "§3"],
                ["4", "Where fusion sits in the BDA pipeline", "§4"],
                ["5", "Fusion process — collect to act", "§5"],
                ["6", "Example: rainfall + pothole reports", "§6"],
                ["7", "Role of Spark, Kafka and the data lake", "§7–§8"],
                ["8", "5 V’s and data quality", "§8–§11"],
                ["9", "Monsoon intelligence (batch vs live)", "§9–§10"],
                ["10", "What we will actually build (scope)", "§17"],
                ["11", "Expected value + what fusion is not", "§12–§13"],
                ["12", "Conclusion, viva line, references", "§14–§16, §18"],
            ],
            [1.6 * cm, 9.4 * cm, 6.2 * cm],
        )
    )
    story.append(Paragraph("Table 1. Slide order for the team PPT.", STYLES["caption"]))

    # ── Verdict ──
    story.append(h1("Team verdict — is this plan feasible and viable?"))
    story.append(
        p(
            "Yes. Data fusion is a strong BDA mini-project theme for UrbanFix. It is academically valid, "
            "easy to explain in a viva, and clearly different from a pure AI/YOLO project. The original "
            "six-page concept is correct. The risk is only scope: if the team tries to build the full "
            "UrbanFix 2.0 city platform (2 million events, seven live municipal dashboards, production "
            "monsoon forecasting), it will not finish. If the team builds a clear demo pipeline that "
            "joins reports, rainfall and ward data in Spark and shows one city insight, it is feasible."
        )
    )
    story.append(
        table(
            ["Question", "Answer"],
            [
                ["Is the idea good?", "Yes. Fusion is a core BDA concept and fits UrbanFix."],
                ["Is it viable for BDA marks?", "Yes. Kafka + lake + Spark + fused analytics match the syllabus."],
                ["Is it viva-safe?", "Yes. The rainfall–pothole example is simple and strong."],
                ["Is the full V2 platform feasible now?", "No. Treat V2 as vision, not this semester’s build."],
                ["Is a scoped demo feasible?", "Yes. Simulated civic events + public rainfall + Spark join + charts."],
                ["Should YOLO be the main work?", "No. YOLO is supporting only, after data is cleaned/fused."],
            ],
            [5.4 * cm, 11.8 * cm],
        )
    )
    story.append(Paragraph("Table 2. Team decision summary.", STYLES["caption"]))
    story.append(
        p(
            "<b>Agreed project title:</b> Data Fusion of Civic Reports and Rainfall using Kafka, HDFS "
            "and Spark for UrbanFix AI."
        )
    )

    # ── 1 ──
    story.append(h1("1. What is data fusion?"))
    story.append(
        p(
            "Data fusion means combining information from more than one data source to create a more "
            "useful analytical view than any single source can provide. The sources do not have to be "
            "the same type. In UrbanFix they are civic complaints, rainfall records and ward/location data."
        )
    )
    story.append(
        p(
            "Storing three files in one folder is not fusion. Fusion happens only when records are aligned "
            "in time and place, cleaned, and joined so that a relationship becomes visible. The classic "
            "UrbanFix sentence is: instead of only knowing that a corridor has many pothole complaints, "
            "fused data can show that the corridor repeatedly develops potholes after heavy rainfall."
        )
    )
    story.append(
        Paragraph(
            "<b>Takeaway for slides:</b> Fusion = combine heterogeneous city data on time + location to reveal hidden patterns.",
            STYLES["note"],
        )
    )

    # ── 2 ──
    story.append(h1("2. Why data fusion is needed in UrbanFix"))
    story.append(
        p(
            "A civic complaint is only one slice of the truth. A photo and a GPS pin tell the city that "
            "something is broken now. They do not explain whether the same place fails every monsoon, "
            "whether rain is associated with the surge, or whether forty reports are actually one pothole. "
            "Municipal officers still have to guess. Fusion gives those complaints environmental and "
            "geographic context."
        )
    )
    story.extend(
        bullets(
            [
                "<b>Civic reports</b> — issue category, location, timestamp, severity.",
                "<b>Rainfall data</b> — daily or weekly rain amount; seasonal monsoon pattern.",
                "<b>Ward / location data</b> — which area, corridor or neighbourhood the event belongs to.",
                "<b>Historical records</b> — the same place observed across months and years.",
            ]
        )
    )
    story.append(
        p(
            "Without fusion, UrbanFix is a reporting app. With fusion, it starts to become a planning "
            "tool: the city can see not only what is broken, but under what conditions it keeps breaking."
        )
    )

    # ── 3 ──
    story.append(h1("3. UrbanFix data sources used for fusion"))
    story.append(
        table(
            ["Source", "Key information", "Why combine it?"],
            [
                ["Civic reports", "Issue, category, location, time, severity", "Understand infrastructure failures"],
                ["Rainfall data", "Rainfall amount / intensity and date", "Add environmental context"],
                ["Ward / location", "Ward, road or corridor", "Localise and compare areas"],
                ["Historical data", "Previous events over time", "Identify recurring relationships"],
            ],
            [3.6 * cm, 6.6 * cm, 7.0 * cm],
        )
    )
    story.append(Paragraph("Table 3. Datasets fused in the UrbanFix BDA layer.", STYLES["caption"]))
    story.append(
        p(
            "For the mini project, civic reports may be simulated UrbanFix-style events (clearly labelled "
            "as simulation) plus any real seed data from the app. Rainfall can come from a public source "
            "(for example Open-Meteo or IMD/open rainfall archives). The ward table can be a simple CSV. "
            "Teachers care more about a correct join and honest labelling than about a perfect live city feed."
        )
    )

    # ── 4 ──
    story.append(h1("4. Where data fusion fits in the BDA pipeline"))
    story.append(
        p(
            "UrbanFix follows one pipeline with two speeds. Events arrive continuously. History is kept "
            "in the city data lake. Spark processes both historical (batch) and live (stream) workloads. "
            "Fusion is the step that turns separate lake tables into one analytical dataset."
        )
    )
    story.append(
        Preformatted(
            """
     Civic reports  +  Rainfall  +  Ward / location
                          |
                          v
              Event stream (Apache Kafka)
                          |
                          v
         City data lake on HDFS  (bronze → silver → gold)
                          |
                          v
              Apache Spark processing
                          |
                          v
           Time and location alignment
                          |
                          v
              Fused analytical dataset
                          |
                          v
        Pattern analysis / optional forecasting
                          |
                          v
              Urban intelligence (charts / decisions)
""".rstrip(),
            STYLES["code"],
        )
    )
    story.append(Paragraph("Figure 1. End-to-end BDA pipeline with data fusion at the centre.", STYLES["caption"]))
    story.append(
        p(
            "Bronze stores raw landed data. Silver stores cleaned, aligned records. Gold stores the fused "
            "tables used for charts: ward-day rain vs complaints, hotspot wards, and before/after comparison. "
            "YOLO, if shown at all, comes after this pipeline. Spark does not train YOLO."
        )
    )

    # ── 5 ──
    story.append(h1("5. Data fusion process — step by step"))
    story.append(
        table(
            ["Step", "What we do", "Why it matters"],
            [
                ["1. Collect", "Capture civic events and supporting rainfall/ward files", "No fusion without sources"],
                ["2. Align", "Map every record to a date and a ward", "Join is impossible if keys do not match"],
                ["3. Clean", "Remove duplicates, corrupt rows, inconsistent units", "Bad data creates fake patterns"],
                ["4. Aggregate", "Summarise by ward, corridor, category and time window", "City decisions are not per-photo"],
                ["5. Combine", "Join reports to rainfall on ward + date", "This is the actual fusion step"],
                ["6. Analyse", "Look for rain-linked surges and repeating failure wards", "Insight, not only a joined table"],
                ["7. Act", "Turn the result into a planning statement", "BDA must support a municipal decision"],
            ],
            [2.6 * cm, 7.8 * cm, 6.8 * cm],
        )
    )
    story.append(Paragraph("Table 4. Fusion workflow for implementation and viva.", STYLES["caption"]))

    # ── 6 ──
    story.append(h1("6. UrbanFix example: rainfall + civic reports"))
    story.append(
        table(
            ["Without data fusion", "With data fusion"],
            [
                [
                    "“This corridor has many pothole complaints.”",
                    "“This corridor repeatedly develops pothole complaints after heavy rainfall.”",
                ],
                [
                    "Officer sees volume only. Patching may be random.",
                    "Officer sees a condition. Resurfacing before monsoon becomes a reasoned option.",
                ],
            ],
            [8.6 * cm, 8.6 * cm],
        )
    )
    story.append(Paragraph("Table 5. The one example every team member should be able to say aloud.", STYLES["caption"]))
    story.append(
        p(
            "The second statement is more actionable because it combines the civic problem with "
            "environmental and geographic context. That is the whole point of this mini project."
        )
    )

    # ── 7 ──
    story.append(h1("7. Role of Apache Spark, Kafka and HDFS"))
    story.append(h2("Apache Spark — processing engine"))
    story.extend(
        bullets(
            [
                "Large-scale joins of civic and rainfall records.",
                "Aggregations by ward, road and time period.",
                "Historical processing of multi-month or multi-year files.",
                "Optional streaming view of incoming events for a live pulse.",
                "Preparation of a time-aligned table that forecasting can use later.",
            ]
        )
    )
    story.append(h2("Apache Kafka — event stream"))
    story.append(
        p(
            "Kafka carries UrbanFix-style events as they happen: issue created, AI verdict, status changed. "
            "A consumer writes those events into the bronze layer of the lake. For the mini project a "
            "simulator is enough. The academic point is that civic data is a stream, not only a static folder."
        )
    )
    story.append(h2("HDFS / data lake — memory of the city"))
    story.append(
        p(
            "The lake keeps raw and processed data in open formats (JSONL, Parquet, CSV). HDFS (or an "
            "HDFS-style local lake if the Hadoop cluster is heavy on a laptop) is the storage layer. "
            "Spark reads from the lake; it does not replace the lake."
        )
    )
    story.append(
        table(
            ["Do in Spark", "Do outside Spark"],
            [
                [
                    "Metadata scans, joins, aggregations, duplicate rules, fusion by ward+date, gold tables",
                    "YOLO training/evaluation, drawing boxes on photos, the mobile/admin app UI",
                ],
                [
                    "Before/after cleaning counts; rain vs complaint charts from gold CSV",
                    "Collecting public rainfall files; making the PPT; viva explanation",
                ],
            ],
            [8.6 * cm, 8.6 * cm],
        )
    )
    story.append(Paragraph("Table 6. Spark vs non-Spark — important viva slide.", STYLES["caption"]))

    # ── 8 ──
    story.append(h1("8. Data fusion and the 5 V’s of Big Data"))
    story.append(
        table(
            ["V", "How it appears in UrbanFix fusion"],
            [
                ["Volume", "Many civic events plus rainfall history analysed together, not row-by-row in Excel."],
                ["Velocity", "New reports keep arriving; Kafka can land them while Spark analyses history."],
                ["Variety", "Photos/events, rainfall numbers, and ward maps are different data types."],
                ["Veracity", "Duplicates, missing wards and bad timestamps must be cleaned before the join."],
                ["Value", "The fused view supports prediction, prioritisation and monsoon planning."],
            ],
            [3.2 * cm, 14.0 * cm],
        )
    )
    story.append(Paragraph("Table 7. Mapping fusion to the BDA 5 V’s.", STYLES["caption"]))

    # ── 9 ──
    story.append(h1("9. Data fusion → monsoon intelligence"))
    story.append(
        p(
            "The fused dataset is the foundation for UrbanFix’s monsoon planning use case. Fusion itself "
            "is not the forecast. Fusion creates the richer input; a simple time-series or even a clear "
            "historical pattern chart can sit on top."
        )
    )
    story.append(
        Preformatted(
            """
  Historical civic reports  +  rainfall history  +  ward data
                              |
                              v
                   Time-aligned fused table
                              |
                              v
              Pattern: complaints rise after heavy rain
                              |
                              v
           Optional: simple ward-level surge indication
                              |
                              v
        Decision: pre-position crews / materials before monsoon
""".rstrip(),
            STYLES["code"],
        )
    )
    story.append(Paragraph("Figure 2. From fused history to a planning action.", STYLES["caption"]))
    story.append(
        p(
            "For the mini project, a ward chart that shows complaint spikes in high-rain weeks is enough. "
            "Do not promise a production-grade monsoon model."
        )
    )

    # ── 10 ──
    story.append(h1("10. Batch vs stream"))
    story.append(
        table(
            ["Historical / batch fusion", "Live / stream perspective"],
            [
                ["Combine months of civic + rainfall history", "Use arriving events for current monitoring"],
                ["Discover repeating rain–damage relationships", "Detect a current complaint spike"],
                ["Prepare data for planning / optional forecast", "Support a live city pulse in a demo"],
                ["Longer-term municipal decisions", "Storm / emergency operations view"],
            ],
            [8.6 * cm, 8.6 * cm],
        )
    )
    story.append(Paragraph("Table 8. Two speeds of the same pipeline.", STYLES["caption"]))

    # ── 11 ──
    story.append(h1("11. Data quality requirements"))
    story.extend(
        bullets(
            [
                "<b>Time alignment:</b> rainfall and reports must use compatible dates (usually daily).",
                "<b>Location alignment:</b> every report must map to a ward (or a declared unknown ward).",
                "<b>Duplicate handling:</b> many photos of one pothole must not be treated as many failures.",
                "<b>Missing values:</b> incomplete records are flagged before the join, not silently filled with fiction.",
                "<b>Schema consistency:</b> units (mm of rain), field names and category labels stay documented.",
                "<b>Simulation transparency:</b> if a larger history is generated for scale, it must be labelled simulated. Real or sample seed data remains the ground-truth story.",
            ]
        )
    )

    # ── 12 ──
    story.append(h1("12. What data fusion is not"))
    story.extend(
        bullets(
            [
                "<b>Not just storage.</b> Keeping rainfall and reports in HDFS does not create a fused view.",
                "<b>Not simple concatenation.</b> Appending files is not a relationship. Join keys (time, location) are required.",
                "<b>Not forecasting.</b> Fusion prepares richer inputs. Forecasting is a later analytical step.",
                "<b>Not machine learning.</b> Fusion is data integration and analytics. YOLO / ARIMA may use the fused table afterwards.",
                "<b>Not limited to rainfall.</b> Rainfall is the clearest UrbanFix example. The broader idea is combining heterogeneous urban data.",
            ]
        )
    )

    # ── 13 ──
    story.append(h1("13. Expected BDA value"))
    story.extend(
        bullets(
            [
                "<b>Recurring failure detection</b> — the same wards or corridors keep appearing after rain.",
                "<b>Context-aware insight</b> — complaint volume is read together with environmental conditions.",
                "<b>Better prioritisation</b> — evidence from more than raw complaint counts.",
                "<b>Preventive planning</b> — a chance to move crews before the worst week, not only after it.",
            ]
        )
    )
    story.append(
        p(
            "This is how UrbanFix moves from “store complaints” to “understand the city.” That sentence "
            "belongs on the conclusion slide."
        )
    )

    # ── 14 ──
    story.append(h1("14. One-minute viva answer (learn this)"))
    story.append(
        Paragraph(
            "“In UrbanFix, data fusion means combining heterogeneous sources such as civic reports, "
            "rainfall history and ward information to generate insights that one dataset cannot provide "
            "alone. Complaint data may show that a corridor has many potholes, but when we combine it "
            "with rainfall and geography, we can see whether that corridor repeatedly fails after heavy "
            "rain. Data is collected through the BDA pipeline, retained in the city data lake and processed "
            "with Spark. Kafka carries live events. The fused table then supports hotspot analysis and "
            "a simple monsoon insight. So fusion helps UrbanFix move from recording civic problems to "
            "understanding their patterns and planning preventive action. YOLO is only a later consumer "
            "of cleaned data; it is not the BDA core.”",
            STYLES["note"],
        )
    )

    # ── 15 ──
    story.append(h1("15. Viva questions and short answers"))
    qa = [
        [
            "Why is data fusion useful?",
            "It adds context by combining sources and exposes relationships invisible in one dataset.",
        ],
        [
            "What datasets are fused?",
            "Civic reports, rainfall, and ward/location data, with historical records over time.",
        ],
        [
            "Which technology processes the fused data?",
            "Apache Spark is the distributed processing engine. Kafka streams events; HDFS/lake stores them.",
        ],
        [
            "Is data fusion machine learning?",
            "No. It is data integration and analytics. Forecasting or YOLO can use the fused dataset later.",
        ],
        [
            "Why combine rainfall with reports?",
            "To test whether environmental conditions are associated with complaint surges or recurring failures.",
        ],
        [
            "How is scale shown if real city history is small?",
            "A labelled simulated history can be replayed through the same pipeline. Real/sample data stays the seed.",
        ],
        [
            "What happens if we skip duplicate handling?",
            "Forty reports of one pothole look like forty failures and can fake a rain correlation.",
        ],
        [
            "Why not train YOLO inside Spark?",
            "Spark is for large-scale data preparation. GPU deep learning frameworks train the detector outside Spark.",
        ],
    ]
    story.append(table(["Question", "Answer"], qa, [5.8 * cm, 11.4 * cm]))
    story.append(Paragraph("Table 9. Shared viva bank — every member should know these.", STYLES["caption"]))

    # ── 16 ──
    story.append(h1("16. Slide-ready bullets (copy, then shorten)"))
    story.append(h2("Slide: Data Fusion — connecting hidden patterns"))
    story.extend(
        bullets(
            [
                "Combines civic reports + rainfall + ward/location data.",
                "Creates one analytical view from heterogeneous datasets.",
                "Reveals relationships that individual datasets cannot show.",
                "Supports recurring-failure analysis and monsoon insight.",
                "Turns raw data into evidence for preventive municipal decisions.",
            ]
        )
    )

    # ── 17 Implementation ──
    story.append(h1("17. What this team will actually build (mini-project scope)"))
    story.append(
        p(
            "This section is the implementation contract. If a teammate proposes extra work, check it "
            "against this list before starting."
        )
    )
    story.append(h2("In scope — must finish"))
    story.extend(
        bullets(
            [
                "Kafka topics for UrbanFix-style events (created / AI verdict / status), even if produced by a simulator.",
                "Lake layers: bronze (raw), silver (cleaned/aligned), gold (fused analytics tables).",
                "Spark job that joins civic events to rainfall on <b>ward + date</b>.",
                "Spark cleaning: missing ward, bad dates, duplicate issue grouping where possible.",
                "Charts: rain vs complaints, hotspot wards, original vs cleaned/fused counts.",
                "Short written explanation of how Spark enabled the join at dataset scale.",
                "Optional small YOLO mention or demo on cleaned images — not the main marks.",
            ]
        )
    )
    story.append(h2("Out of scope — do not build this semester"))
    story.extend(
        bullets(
            [
                "Full UrbanFix 2.0 product rewrite.",
                "Seven live municipal decision dashboards.",
                "True 2 million-event production history (a smaller simulation is enough unless extra time remains).",
                "Live storm-operations command centre.",
                "Perfect road-corridor GIS mapping.",
                "Production monsoon forecast deployed to officers.",
            ]
        )
    )
    story.append(h2("Suggested data sizes for a laptop demo"))
    story.append(
        table(
            ["Dataset", "Practical size", "Notes"],
            [
                ["Civic events", "A few thousand to tens of thousands", "Simulated is acceptable if labelled"],
                ["Rainfall", "Daily ward or city rain for 1 season or 1 year", "Public source"],
                ["Ward master", "10–20 wards in a simple CSV", "Keep join keys stable"],
                ["Optional images", "RDD2022 subset if showing YOLO", "Do not block BDA demo on 5 GB download"],
            ],
            [3.6 * cm, 6.6 * cm, 7.0 * cm],
        )
    )
    story.append(Paragraph("Table 10. Practical sizes so the demo runs on a student laptop.", STYLES["caption"]))
    story.append(h2("Work split (suggested)"))
    story.append(
        table(
            ["Track", "Owner focus", "Deliverable"],
            [
                ["Streaming", "Kafka producer / consumer", "Events landing in bronze"],
                ["Lake + Spark", "PySpark EDA, clean, fusion join", "Silver + gold tables and charts"],
                ["Story / PPT", "This PDF → 12 slides", "Presentation + viva answers"],
                ["Optional AI", "YOLO only if time remains", "One results slide, not the core"],
            ],
            [3.4 * cm, 6.6 * cm, 7.2 * cm],
        )
    )
    story.append(Paragraph("Table 11. Simple team split.", STYLES["caption"]))

    # ── 18 ──
    story.append(h1("18. Conclusion"))
    story.append(
        p(
            "Data fusion is the right BDA mini-project for UrbanFix. It is viable as an academic story "
            "and feasible as a scoped pipeline. The team should not confuse the V2 vision with the mini "
            "project. The vision is a city intelligence platform. The mini project is to prove, with Kafka, "
            "a data lake and Spark, that civic reports become more valuable when they are fused with "
            "rainfall and ward context."
        )
    )
    story.append(
        p(
            "If the demo can show one fused table and one sentence of the form “this ward’s pothole "
            "complaints rise after heavy rain,” the project has succeeded. Everything else is extra."
        )
    )

    story.append(h1("19. References (for slides and report)"))
    story.extend(
        bullets(
            [
                "Arya, D., Maeda, H., Ghosh, S. K., Toshniwal, D., &amp; Sekimoto, Y. (2024). RDD2022: A multi-national image dataset for automatic road damage detection. <i>Geoscience Data Journal</i>. (IEEE Big Data Cup / CRDDC 2022 dataset.)",
                "Apache Software Foundation. Apache Kafka documentation. https://kafka.apache.org/",
                "Apache Software Foundation. Apache Spark documentation. https://spark.apache.org/",
                "Apache Software Foundation. Hadoop / HDFS architecture. https://hadoop.apache.org/",
                "UrbanFix.AI V2 proposal — Big Data Analytics pillar (internal project document).",
                "This briefing consolidates the internal Data Fusion detailed note and the agreed mini-project scope.",
            ]
        )
    )

    story.append(h2("Closing line for the last slide"))
    story.append(
        Paragraph(
            "UrbanFix already collects civic problems. BDA fusion is how the city starts to understand them.",
            STYLES["center"],
        )
    )

    doc.build(story, onFirstPage=cover_header_footer, onLaterPages=header_footer)
    print(f"Wrote {OUT}")
    return OUT


if __name__ == "__main__":
    build()
