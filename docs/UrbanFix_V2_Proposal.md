# UrbanFix.AI 2.0 — V2 Proposal

**From a civic reporting app to an Urban Infrastructure Intelligence Platform**

| | |
|---|---|
| Project | UrbanFix.AI — Version 2 (builds on the demonstrated, working V1) |
| Prepared for | Capstone review panel, Dept. of Electronics & Computer Science, SJCEM |
| Core subjects used | **Big Data Analytics (BDA)** · **MLOps** · AI/ML |
| Date | July 2026 |

> **The whole proposal in one line:**
> *V1 lets citizens report what is broken. V2 lets the city understand its problems, predict what is coming, and decide what to fix first.*

---

## PART A — UNDERSTAND IT (story and pictures first)

### A1. A use-case story: one pothole, two versions

**Ravi's pothole — in V1 (what the panel has already seen):**

Ravi photographs a pothole near his home. The app takes 15–20 seconds to analyse it,
classifies it as a road issue, and it appears on the municipal dashboard as complaint
#4,312 — one row in a long list. Forty other people report the same pothole that month;
the dashboard shows 40 separate complaints. The ward officer scrolls the list and picks
jobs by experience and instinct. The pothole is eventually fixed. The 41 reports go into
the database — **and are never looked at again.**

**The same pothole — in V2:**

Ravi taps submit and the app responds **instantly** — analysis happens in the background
and the verdict arrives as a notification a few seconds later. Before he even finishes,
the app tells him: *"This pothole was already reported by 39 neighbours — add your voice
to it?"* One pothole is now **one job with 40 supporters**, not 40 rows.

On the dashboard, the officer no longer sees a raw list. She sees a **ranked repair
list**: this pothole is #3 in the ward — because it is severe, on a bus route, affects
40 people, and sits on a street that has failed **after every heavy-rain week for three
years**. The system's advice: *don't patch it — resurface the corridor.*

Meanwhile, the commissioner's screen shows a **monsoon forecast**: based on three years
of report history fused with rainfall records, complaints in Wards 7 and 12 will roughly
triple in the last week of June. Crews and material move there **before** the rain.

And when the AI had earlier mislabelled a photo, the officer corrected it in one click.
That correction became a **lesson**. Next month's AI sat an exam, scored higher than the
current one, and was promoted. **The system is smarter this month than last — and can
prove it.**

That is the difference: **V1 collects problems. V2 helps govern them.**

---

### A2. The big picture (architecture)

Nothing from V1 is thrown away. V2 adds a data-and-intelligence layer on top:

```
              CITIZENS                                OFFICIALS
   ┌───────────────────────────┐          ┌───────────────────────────────┐
   │   Mobile App        (V1)  │          │   Admin Panel           (V1)  │
   │ + Civic Assistant   (V2)  │          │ + 7 Decision Dashboards (V2)  │
   │   Hindi/Marathi/English   │          │ + AI Health Page        (V2)  │
   └────────────┬──────────────┘          └───────────────┬───────────────┘
                │ reports, questions                      │ decisions, corrections
                ▼                                         ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │                     PLATFORM CORE  (V1 — unchanged)                  │
   │        accounts · reports · status timeline · votes · community      │
   └──────────────┬────────────────────────────────────────┬──────────────┘
                  │ every action becomes an "event"        │ every photo
                  ▼                                        ▼
   ┌────────────────────────────┐          ┌───────────────────────────────┐
   │   CITY DATA LAKE     (V2)  │          │   AI ENGINE            (V2)   │
   │  years of reports, votes,  │          │  one consolidated model +     │
   │  status changes, AI        │          │  "second opinion" check on    │
   │  verdicts + rainfall data  │          │  uncertain photos only        │
   └──────────────┬─────────────┘          └───────────────┬───────────────┘
                  │                                        │
                  ▼                                        ▼
   ┌────────────────────────────┐          ┌───────────────────────────────┐
   │   ANALYTICS BRAIN    (V2)  │          │   MLOPS QUALITY LOOP    (V2)  │
   │  hotspots · forecasts ·    │          │  corrections → lessons →      │
   │  repair rankings ·         │          │  monthly retrain → exam →     │
   │  dept. scorecards          │          │  promote only if better       │
   └────────────────────────────┘          └───────────────────────────────┘
```

**How to read this:** the top half is what the panel has already seen working.
The bottom half is V2 — a memory (data lake), a brain (analytics), and a
quality-control loop (MLOps) attached to the existing product.

---

### A3. The four pillars, in one glance

| # | Pillar | In one sentence | Status |
|---|--------|-----------------|--------|
| 1 | **Big Data Analytics** | Years of city reports become forecasts, rankings and scorecards that answer 7 real questions for officials. | ⭐ Core (BDA subject) |
| 2 | **MLOps** | The AI gets a report card, learns from officials' corrections monthly, and is upgraded only when it proves improvement. | ⭐ Core |
| 3 | **Civic Assistant** | Citizens ask in Hindi/Marathi/English and get answers taken only from the city's own records. | Supporting |
| 4 | **Engine upgrade** | Verdicts in seconds instead of 10–20s, with far fewer false detections. | Foundation |

---

## PART B — THE DETAILS (pillar by pillar)

### B1. Pillar 1 — Big Data Analytics: the city's decision brain

**The plain idea:** every action on the platform (a report, a vote, a status change,
an AI verdict) is stored as an **event** in a **city data lake** — a permanent store
built for analysing *years* of history, not just running today's app. Two kinds of
processing run on it, and these two modes are exactly the heart of the BDA syllabus:

```
  citizen submits ─┐
  official updates ─┤                       ┌──► BULK ANALYSIS ────► 7 dashboards
  someone votes ────┼──► EVENT ──► CITY     │    (full history)      (decisions)
  AI gives verdict ─┘    STREAM    DATA ────┤
                                   LAKE     └──► LIVE ANALYSIS ────► live city pulse
                                                 (as events arrive)  (operations)
```

**The seven questions the dashboards answer** — the honest test of any analytics
platform is *which questions can it answer that nobody could answer before:*

| # | City question | What officials get | Decision it enables |
|---|---------------|--------------------|---------------------|
| 1 | Where are our hotspots? | Heat map of streets that break again and again | Send crews where impact is highest, not where the loudest complaint is |
| 2 | What will the monsoon do to us? | Ward-wise surge forecast, weeks ahead (reports fused with rainfall history) | Pre-position crews and material **before** July |
| 3 | What should we fix first? | Ranked repair list (severity + people affected + recurrence + road importance) | Data-backed priority order instead of guesswork |
| 4 | Is this complaint a duplicate? | Automatic city-wide grouping of same-problem reports | True workload: 40 reports of one pothole = 1 job |
| 5 | Which departments deliver? | Resolution-time scorecards, ageing complaints, monthly trends | Accountability; escalate complaints going stale |
| 6 | Is our AI still accurate? | AI verdicts analysed by category, ward, month | Evidence to trust — or retrain — the AI (links to Pillar 2) |
| 7 | Are citizens engaged? | Participation trends, active communities, gamification effect | Run awareness drives where problems are high but reporting is low |

**Plus a live city pulse:** a real-time strip showing reports arriving as they happen.
During heavy rain it becomes an operations screen — officials watch waterlogging
complaints spike ward by ward, live.

**Fusing outside data:** reports become far more powerful combined with data the city
already has — rainfall records, ward population, road classification. That fusion turns
*"many pothole complaints"* into *"this corridor fails after every 100 mm rain week —
resurface it, don't patch it."*

> **Honest scale, honestly shown.** Our pilot data is real but small. To prove the
> platform works at metropolitan scale, we will generate a realistic **simulated
> 3-year history (~2 million reports)** across real city wards with monsoon
> seasonality, and replay it through the full pipeline. This is standard industry
> practice for validating data platforms and will be clearly labelled as simulation.
> Real pilot data remains the seed and the ground truth.

---

### B2. Pillar 2 — MLOps: an AI with quality control

**The plain idea:** today our AI is frozen on the day of launch, and its accuracy is an
estimate. A system a government office relies on for years cannot work that way.
The simplest way to explain our solution:

> **We run the AI the way a university runs students** — fixed question paper,
> recorded marks, improvement expected every term, promotion only when earned.

```
   official corrects a          correction saved            monthly retraining
   wrong AI verdict     ──►     as a "lesson"       ──►     on all lessons
   (one click, existing                                          │
    dashboard)                                                   ▼
                                                        EXAM: same fixed test set
        ┌─────────────────────────────────────────┐    (real civic photos + traps)
        │                                         │              │
        ▼                                         │       scores higher?
   citizens get a               new version       │      ┌───────┴───────┐
   better AI every     ◄──      promoted,     ◄───┘─ yes │               │ no
   month                        old archived                             ▼
                                                              old version stays;
                                                              lessons carry forward
```

What this loop guarantees, in five plain promises:

1. **A measured AI.** A fixed test set (including deliberately irrelevant photos)
   gives every version a report card. "About 80% accurate" becomes an exact number.
2. **An AI that learns from its users.** Officials' corrections stop being wasted —
   they become next month's training data. The system improves *because* it is used.
3. **Safe upgrades.** A new version can never silently replace the old one. It must
   beat the current version on the same exam first. No regressions reach citizens.
4. **Health monitoring.** A model-health page tracks accuracy, speed and mistake
   patterns month by month — the AI's vitals chart.
5. **Accountability.** Every version is recorded and reversible. "Why did the AI say
   this in March?" always has an exact answer — this audit trail is what makes AI
   acceptable inside a government workflow.

---

### B3. Pillar 3 — Civic Assistant: answers in the citizen's own language

Citizens simply ask — in **Hindi, Marathi or English**:

```
  Citizen: "मेरी complaint का क्या status है?"
              │
              ▼
  Assistant looks up the REAL record first ──► complaint #4312, status timeline,
  (it is not allowed to answer from             assigned department, last update
   imagination — only from city records)
              │
              ▼
  Reply in the citizen's language:
  "आपकी सड़क की complaint (#4312) पर काम शुरू हो चुका है — PWD ने
   12 July को 'In Progress' मार्क किया. Expected: इस हफ्ते."
```

- **For citizens:** no forms, no English barrier, no "office ka chakkar" — status and
  guidance in one question. If the record doesn't exist, the assistant says so.
- **For officials:** acknowledgement replies drafted automatically, and a **monthly
  ward report auto-written from the analytics** — the summary an officer spends hours
  compiling, generated in seconds and reviewed by a human before sending.
- **For data quality:** at submission time the assistant warns *"this looks like an
  already-reported issue nearby — support it instead"* — killing duplicates at the source.

---

### B4. Pillar 4 — Engine upgrade (brief, since the panel knows V1's pipeline)

```
  V1:  photo ─► check 1 ─► check 2 ─► check 3 ─► check 4 ─► check 5 ─► check 6 ─► verdict
       (several separate AI checks in a chain — 10 to 20 seconds, borderline photos
        sometimes produce false detections)

  V2:  photo ─► ONE model trained on our own          confident? ──yes──► verdict  (< 3 s)
                accumulated data                          │
                                                          no  (only ~2–3 photos out of 10)
                                                          ▼
                                              "second opinion" review ──► verdict
```

Analysis also moves to the **background**: the citizen's app responds instantly and the
verdict follows as a notification — so even the rare slow case never makes a citizen wait.

| Measure | V1 today | V2 target |
|---|---|---|
| Verdict time | 10–20 s (longer after idle) | **under 3 s**, app feels instant |
| Classification accuracy | ≈ 80% (estimated) | **90%+ (measured)** |
| False detections on irrelevant photos | unmeasured | **measured & below 10%** |
| Reports needing manual confirmation | majority | minority (60–70% auto-confirmed) |

---

## PART C — WHO CAN USE IT, IS IT VIABLE, WHAT IT'S BUILT WITH

### C1. Who can use it

| Who | How they use V2 |
|---|---|
| **Citizens** (esp. tier-2/3 cities) | Report in seconds, ask in their own language, see their report change a real priority |
| **Ward engineers / field staff** | Duplicate-free, ranked daily work list instead of a raw complaint feed |
| **Municipal commissioners** | Department scorecards, monsoon readiness forecasts, one-click monthly reports |
| **City planners** | Multi-year evidence of where infrastructure repeatedly fails — budget input, not just repairs |
| **Smart City missions / other ULBs** | The platform is not tied to one city — any urban local body can adopt it as-is |
| **NGOs & researchers** | Anonymised, aggregated civic data for urban studies and advocacy |

Bigger picture: this is a working template for **UN SDG 11 (Sustainable Cities and
Communities)** — and a shift from *reactive* governance (wait for complaints) to
*preventive* governance (predict and pre-position).

### C2. Is it viable? (feasibility, honestly)

| Concern | Our answer |
|---|---|
| **Cost** | ₹0 in services. Everything runs on free tiers and open-source software; the big-data stack runs on our own machines and demos fully **offline**. |
| **Risk to V1** | None. V1 stays live and untouched; V2 layers are added alongside it. The panel's working demo is never at risk. |
| **Data volume is small** | Openly addressed: simulated 3-year city history (~2M reports) proves scale; real pilot data stays the ground truth. |
| **Timeline** | 10 weeks, 4 phases, and **every phase ends in a live demo** — never "trust us, it's coming." |
| **Team capability** | V1 is already built, deployed and demonstrated by the same team — V2 reuses that entire foundation. |
| **What could go wrong** | If retraining gains are slower than hoped, the exam-gate simply keeps the current AI — the system degrades to "no worse than today," never below it. |

### C3. What it's built with (named once, kept light — the design matters more than the brand names)

| Layer | Built with | One-line why |
|---|---|---|
| Event stream & data lake | Kafka + Spark-family processing, open data formats | The same industry-standard concepts taught in the BDA curriculum |
| Dashboards | Extends our existing admin panel + an open-source BI tool | Officials keep the interface they already know |
| AI engine | One consolidated vision model + a vision-language "second opinion" | Fewer moving parts = faster and more reliable |
| MLOps loop | Open-source experiment tracking & data versioning | Every model version and dataset is recorded and reproducible |
| Assistant | A grounded language model over our own database (retrieval-based, so it cannot invent facts) | Trustworthy answers, three languages |

*(All open-source or free-tier. Exact configurations are an implementation detail —
available in the technical annexe on request.)*

---

## PART D — PLAN AND JUDGEMENT

### D1. Execution plan — a demo at every review

| Phase | Weeks | Work | **Shown to the panel** |
|---|---|---|---|
| 1 · Measure & upgrade engine | 1–3 | Fixed test set, V1's true numbers recorded, consolidated V2 engine + second-opinion live | Same photos through V1 and V2 **side by side** — speed and verdicts compared, first printed report card |
| 2 · MLOps loop | 4–5 | One-click correction, retrain-exam-promote cycle, model health page | A correction made **live**, and a new AI beating the old one on the same exam before promotion |
| 3 · Big Data platform | 5–8 | Event pipeline, data lake, simulated history, 7 dashboards, live pulse | Hotspots, monsoon forecast and a **live storm pulse** running on 2M+ events |
| 4 · Civic Assistant | 8–10 | Multilingual grounded assistant, auto-replies, auto ward reports | A **Hindi** status query answered from the live database; a ward report generated in one click |

### D2. How to judge us at the end

- All **seven city questions** answered by live dashboards over 2M+ events
- One **complete monthly AI improvement cycle** executed and documented
- Verdicts **< 3 s** · accuracy **90%+ measured** · false detections **< 10%**
- Assistant correct **in three languages**, strictly from real records
- A **monsoon surge forecast** for named wards, from fused report + rainfall history
- One **auto-generated ward report** an official could actually send

### D3. V1 → V2 at a glance

| Dimension | V1 (demonstrated) | V2 (proposed) |
|---|---|---|
| Core question | "What is broken in this photo?" | "What will break, where, and what do we fix first?" |
| Role of data | Stored as records | Turned into forecasts, rankings, scorecards |
| AI after launch | Frozen; mistakes repeat | Improves monthly, with proof |
| Accuracy claim | Estimated | Measured on a fixed test set, tracked over time |
| Official's view | List of complaints | Priorities, predictions, performance |
| Languages | English interface | + Hindi & Marathi assistant |
| Scale demonstrated | Hundreds of reports | Millions of events (simulated city history) |
| Identity | Reporting app with AI | **Urban Infrastructure Intelligence Platform** |

---

> **Closing:** V1 answered a photo. V2 answers a city. The same platform this panel
> watched classify a single pothole will rank every road in a ward, warn about the
> monsoon before it arrives, and prove — with a report card — that its AI is better
> this month than last. That is the difference between a project that **detects**
> problems and a platform that helps **govern** them.
