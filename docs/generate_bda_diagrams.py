"""
Generate publication-grade architecture, data-flow, and pipeline diagrams
for the UrbanFix BDA Black Book using Matplotlib.
Redesigned to eliminate overlapping badges, cramped labels, and awkward aspect ratios.
"""
from pathlib import Path
import matplotlib.pyplot as plt
import matplotlib.patches as patches

OUT_DIR = Path(__file__).resolve().parent / "bda_diagrams"
OUT_DIR.mkdir(parents=True, exist_ok=True)

plt.rcParams['font.sans-serif'] = 'DejaVu Sans'
plt.rcParams['font.family'] = 'sans-serif'

def create_bda_system_flow():
    fig, ax = plt.subplots(figsize=(12, 6.8), dpi=300)
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 7)
    ax.axis('off')
    fig.patch.set_facecolor('#FFFFFF')

    navy = '#1B365D'
    slate = '#334155'

    ax.text(6.0, 6.65, "UrbanFix.AI 2.0 — Big Data Analytics (BDA) End-to-End System Flow",
            ha='center', va='center', fontsize=14, fontweight='bold', color=navy)
    ax.text(6.0, 6.35, "Distributed Ingestion, Medallion Lakehouse Processing, Spatial Graph Fusion & Serving",
            ha='center', va='center', fontsize=9.5, fontstyle='italic', color=slate)

    tiers = [
        ("1. DATA SOURCES & INGESTION", 0.4, 2.5, '#EFF6FF', '#1D4ED8'),
        ("2. BRONZE & SILVER LAKE", 3.2, 2.6, '#FEFCE8', '#CA8A04'),
        ("3. SPARK DISTRIBUTED FUSION", 6.1, 2.7, '#F0FDF4', '#15803D'),
        ("4. GOLD MARTS & SERVING", 9.1, 2.5, '#FAF5FF', '#7E22CE')
    ]
    for title, x, w, fill, stroke in tiers:
        rect = patches.FancyBboxPatch((x, 0.4), w, 5.6, boxstyle="round,pad=0.08,rounding_size=0.15",
                                     facecolor=fill, edgecolor=stroke, linewidth=1.2, alpha=0.35)
        ax.add_patch(rect)
        ax.text(x + w/2, 5.75, title, ha='center', va='center', fontsize=8.2, fontweight='bold', color=stroke)

    def add_card(x, y, w, h, title, subtitle, badge=None, b_color='#1E293B', fill='#FFFFFF'):
        rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.05,rounding_size=0.1",
                                     facecolor=fill, edgecolor='#94A3B8', linewidth=0.9)
        ax.add_patch(rect)
        if badge:
            b_w = len(badge) * 0.12 + 0.25
            b_rect = patches.FancyBboxPatch((x + 0.12, y + h - 0.28), b_w, 0.18, boxstyle="square,pad=0.02",
                                          facecolor=b_color, edgecolor='none')
            ax.add_patch(b_rect)
            ax.text(x + 0.12 + b_w/2, y + h - 0.19, badge, ha='center', va='center', fontsize=6.2, fontweight='bold', color='#FFFFFF')
            ax.text(x + 0.18 + b_w + 0.08, y + h - 0.19, title, ha='left', va='center', fontsize=8.2, fontweight='bold', color=navy)
        else:
            ax.text(x + w/2, y + h - 0.2, title, ha='center', va='center', fontsize=8.2, fontweight='bold', color=navy)

        ax.text(x + w/2, y + (h - 0.35)/2, subtitle, ha='center', va='center', fontsize=7.2, color=slate, linespacing=1.3)

    # Column 1
    add_card(0.55, 4.4, 2.2, 1.05, "Citizen Mobile Client", "React Native / Expo Geo-logs\n(19,282 Reports)", "RAW", '#2563EB')
    add_card(0.55, 3.1, 2.2, 1.05, "Apache Kafka KRaft", "civic-events Topic (KRaft)\n1,299 ev/s Benchmark", "STREAM", '#0284C7')
    add_card(0.55, 1.7, 2.2, 1.15, "Open-Meteo ERA5", "5 Mumbai Met Stations\n366 Days (2024 Reanalysis)", "METEO", '#059669')
    add_card(0.55, 0.6, 2.2, 0.9, "BMC Ward Centroids", "24 Wards Census Master\nGeo & Drainage Capacity", "STATIC", '#475569')

    # Column 2
    add_card(3.35, 4.2, 2.3, 1.25, "Bronze Lake (JSONL)", "• civic_history.jsonl (19.2k)\n• kafka_events_latest.jsonl\n• Append-only raw ledger", "BRONZE", '#B45309', '#FFFBEB')
    add_card(3.35, 0.7, 2.3, 3.1, "Silver Lake (Spark 05)", "• 5-Stage Veracity Rules\n  (-827 noisy records dropped)\n• Haversine Broadcast Join\n  (Nearest ward attribution)\n• Graph Deduplication\n  (136k edges -> 5.1k incidents)\n• Snappy Parquet (2.39 MB)\n  71.6% Storage Reduction", "SILVER", '#475569', '#F8FAFC')

    # Column 3
    add_card(6.25, 3.3, 2.4, 2.15, "Distributed Fusion (06)", "• Fused on (ward_id, event_date)\n  8,784 ward-day records\n• Window Rolling 48h Rain\n• Forward Lag Matrices (t+1..5)\n• Empirical Recovery:\n  4.593x Surge at 48h Peak", "CORE", '#15803D', '#F0FDF4')
    add_card(6.25, 0.7, 2.4, 2.3, "MLlib & Streaming Pulse", "• Spark MLlib Regression\n  (R2: 0.814, RMSE: 2.14)\n• 30-min Window / 10-min Slide\n• 10-min Watermark for Late Data\n• High-priority surge alerts", "ML/STR", '#0D9488', '#F0FDFA')

    # Column 4
    add_card(9.25, 4.1, 2.2, 1.35, "Gold Analytics Marts", "• ward_date_fused_gold.parquet\n• ward_vulnerability.csv\n• 93.9% Net Size Reduction", "GOLD", '#D97706', '#FFFBEB')
    add_card(9.25, 2.4, 2.2, 1.45, "Executive Decision UI", "• Streamlit Portal (port 8502)\n• Ward Choropleth & Scorecard\n• Dual-Axis Rain/Lag Charts", "BI UI", '#7C3AED', '#FAF5FF')
    add_card(9.25, 0.7, 2.2, 1.45, "Municipal Action Engine", "• 48h Preemptive Dispatch\n• Cold-Mix Asphalt PWD Staging\n• SWM Gully Emptier Routing", "ACTION", '#DC2626', '#FEF2F2')

    arrow_opts = dict(arrowstyle='->', lw=1.2, color='#0284C7')
    ax.annotate("", xy=(0.55+1.1, 4.15), xytext=(0.55+1.1, 4.4), arrowprops=arrow_opts)
    ax.annotate("", xy=(3.35, 4.8), xytext=(2.75, 3.6), arrowprops=arrow_opts)
    ax.annotate("", xy=(4.5, 3.8), xytext=(4.5, 4.2), arrowprops=arrow_opts)
    ax.annotate("", xy=(3.35, 2.3), xytext=(2.75, 2.3), arrowprops=arrow_opts)
    ax.annotate("", xy=(3.35, 1.1), xytext=(2.75, 1.1), arrowprops=arrow_opts)
    ax.annotate("", xy=(6.25, 4.4), xytext=(5.65, 2.4), arrowprops=arrow_opts)
    ax.annotate("", xy=(6.25, 1.8), xytext=(5.65, 1.8), arrowprops=arrow_opts)
    ax.annotate("", xy=(9.25, 4.8), xytext=(8.65, 4.4), arrowprops=arrow_opts)
    ax.annotate("", xy=(9.25, 3.1), xytext=(8.65, 4.4), arrowprops=arrow_opts)
    ax.annotate("", xy=(10.35, 2.15), xytext=(10.35, 2.4), arrowprops=arrow_opts)

    plt.tight_layout()
    out_path = OUT_DIR / "bda_system_flow.png"
    plt.savefig(out_path, dpi=300)
    plt.close()
    print(f"Saved: {out_path}")

def create_medallion_architecture_diagram():
    fig, ax = plt.subplots(figsize=(11, 6), dpi=300)
    ax.set_xlim(0, 11)
    ax.set_ylim(0, 6)
    ax.axis('off')
    fig.patch.set_facecolor('#FFFFFF')

    navy = '#1B365D'
    slate = '#334155'

    ax.text(5.5, 5.65, "UrbanFix.AI 2.0 — Medallion Lakehouse Storage Progression",
            ha='center', va='center', fontsize=13.5, fontweight='bold', color=navy)
    ax.text(5.5, 5.35, "Transforming Unstructured Mobile Telemetry into Partitioned Columnar Parquet & Executive Marts",
            ha='center', va='center', fontsize=9.2, fontstyle='italic', color=slate)

    # Bronze
    rect_b = patches.FancyBboxPatch((0.5, 0.6), 3.0, 4.4, boxstyle="round,pad=0.08,rounding_size=0.15",
                                   facecolor='#FEF3C7', edgecolor='#D97706', linewidth=1.2)
    ax.add_patch(rect_b)
    ax.text(2.0, 4.65, "BRONZE LAYER", ha='center', va='center', fontsize=11, fontweight='bold', color='#92400E')
    ax.text(2.0, 4.35, "Raw Landed Telemetry (JSONL)", ha='center', va='center', fontsize=8.5, color=slate)
    b_content = ("• Directory: data/lake/bronze/\n"
                 "• Format: Append-only JSONL\n"
                 "• Raw File Size: 8.42 MB\n"
                 "• Total Records: 19,282 Rows\n\n"
                 "Key Characteristics:\n"
                 "- 100% Immutable Raw Truth\n"
                 "- Unfiltered Mobile Sensor Noise\n"
                 "- GPS Jitter & Device Clock Skews\n"
                 "- Auditable Event Source Record")
    ax.text(0.7, 2.5, b_content, ha='left', va='center', fontsize=8.2, color='#78350F', linespacing=1.35)

    # Silver
    rect_s = patches.FancyBboxPatch((4.0, 0.6), 3.0, 4.4, boxstyle="round,pad=0.08,rounding_size=0.15",
                                   facecolor='#F1F5F9', edgecolor='#64748B', linewidth=1.2)
    ax.add_patch(rect_s)
    ax.text(5.5, 4.65, "SILVER LAYER", ha='center', va='center', fontsize=11, fontweight='bold', color='#334155')
    ax.text(5.5, 4.35, "Cleansed & Enriched (Parquet)", ha='center', va='center', fontsize=8.5, color=slate)
    s_content = ("• Directory: data/lake/silver/\n"
                 "• Format: Snappy Parquet\n"
                 "• Storage: 2.39 MB (71.6% drop)\n"
                 "• Clean Records: 18,455 Rows\n\n"
                 "Transformations Applied:\n"
                 "- 5 Deterministic Veracity Filters\n"
                 "- Broadcast Haversine Centroid Join\n"
                 "- Graph Deduplication (136k edges)\n"
                 "- 5,163 Distinct Incidents Isolated\n"
                 "- Partitioned: year/month")
    ax.text(4.2, 2.5, s_content, ha='left', va='center', fontsize=8.2, color='#1E293B', linespacing=1.35)

    # Gold
    rect_g = patches.FancyBboxPatch((7.5, 0.6), 3.0, 4.4, boxstyle="round,pad=0.08,rounding_size=0.15",
                                   facecolor='#FEF9C3', edgecolor='#CA8A04', linewidth=1.2)
    ax.add_patch(rect_g)
    ax.text(9.0, 4.65, "GOLD LAYER", ha='center', va='center', fontsize=11, fontweight='bold', color='#854D0E')
    ax.text(9.0, 4.35, "Curated Business Marts", ha='center', va='center', fontsize=8.5, color=slate)
    g_content = ("• Directory: data/lake/gold/\n"
                 "• Formats: Parquet & CSV\n"
                 "• Fused Records: 8,784 Ward-Days\n"
                 "• Storage: 0.51 MB (93.9% drop)\n\n"
                 "Analytical Marts:\n"
                 "- Cross-modal join on (ward, date)\n"
                 "- 48h Lag Surge Recovery (4.593x)\n"
                 "- Civic Vulnerability Index (CVI)\n"
                 "- 24-Ward Hotspot Scorecard\n"
                 "- MLlib Regression Predictions")
    ax.text(7.7, 2.5, g_content, ha='left', va='center', fontsize=8.2, color='#713F12', linespacing=1.35)

    # Connectors
    ax.annotate("PySpark 05\nClean & Dedup", xy=(4.0, 2.8), xytext=(3.5, 2.8),
                arrowprops=dict(arrowstyle='->', lw=1.5, color='#2563EB'),
                ha='center', va='bottom', fontsize=8, fontweight='bold', color='#1D4ED8')
    ax.annotate("PySpark 06\nFusion Join", xy=(7.5, 2.8), xytext=(7.0, 2.8),
                arrowprops=dict(arrowstyle='->', lw=1.5, color='#16A34A'),
                ha='center', va='bottom', fontsize=8, fontweight='bold', color='#15803D')

    plt.tight_layout()
    out_path = OUT_DIR / "bda_medallion_pipeline.png"
    plt.savefig(out_path, dpi=300)
    plt.close()
    print(f"Saved: {out_path}")

if __name__ == '__main__':
    create_bda_system_flow()
    create_medallion_architecture_diagram()
    print("Cleaned and overhauled BDA diagrams successfully generated!")
