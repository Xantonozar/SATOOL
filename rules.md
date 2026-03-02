# Sieve Analysis & Well-Grade Optimization App — Developer Prompt

## Project Overview

Build a **fully interactive React web application** for sieve analysis following **ASTM C136** standard. The app allows engineers to input aggregate weights per sieve size, visualize the Particle Size Distribution (PSD) curve on a **semi-log graph**, automatically classify the grading curve, and perform **well-grade optimization** with a fixed total weight constraint.

---

## Tech Stack

- **Framework:** React (functional components + hooks)
- **Styling:** Tailwind CSS (utility classes only)
- **Charting:** Recharts (for semi-log PSD graph)
- **Math:** In-component calculations (no external math library needed)
- **State:** `useState`, `useReducer`, `useMemo`

---

## ASTM C136 Standard Rules

### Standard Sieve Sizes (Default Set — mm)
```
75.0, 50.0, 37.5, 25.0, 19.0, 12.5, 9.5, 4.75,
2.36, 1.18, 0.600, 0.300, 0.150, 0.075
```

### Aggregate Type Detection (Auto by Sieve Range)
| Type | Criteria |
|------|----------|
| Coarse Aggregate (Gravel) | Primarily retained on 4.75 mm sieve |
| Fine Aggregate (Sand) | Primarily passing 4.75 mm sieve |
| Mixed / Combined | Significant mass on both sides of 4.75 mm |

### Classification Logic
```
Cᵤ = D60 / D10
Cᶜ = (D30)² / (D10 × D60)

Well-Graded (GW): Cᵤ ≥ 4  AND  1 ≤ Cᶜ ≤ 3   [Gravel]
Well-Graded (SW): Cᵤ ≥ 6  AND  1 ≤ Cᶜ ≤ 3   [Sand]
Gap-Graded:       Cᵤ ≥ threshold  AND  Cᶜ ∉ [1, 3]
Poorly-Graded:    Cᵤ < threshold  OR   Cᶜ ∉ [1, 3]
```

---

## App Layout & UI Structure

```
┌─────────────────────────────────────────────────────────┐
│  HEADER: "Sieve Analysis Tool — ASTM C136"              │
├──────────────────┬──────────────────────────────────────┤
│  LEFT PANEL      │  RIGHT PANEL                         │
│  (Input Table)   │  (Semi-Log Graph)                    │
│                  │                                      │
│  [+ Add Sieve]   │  [PSD Curve plotted here]            │
│  [- Remove]      │                                      │
│                  │  Legend:                             │
│  Sieve | Weight  │  — Original Curve                    │
│  🔒 lock toggle  │  — ASTM Upper Limit                  │
│                  │  — ASTM Lower Limit                  │
│                  │  — Possible WG Curves (25/50/75%)    │
│                  │  — Optimized Curve                   │
├──────────────────┴──────────────────────────────────────┤
│  RESULTS PANEL                                          │
│  Aggregate Type | Cᵤ | Cᶜ | D10 | D30 | D60            │
│  Classification: [Well-Graded / Poorly / Gap]  badge   │
├─────────────────────────────────────────────────────────┤
│  [🔧 Well-Grade Optimization] Button                    │
│  (appears always; active only if NOT already WG)        │
├─────────────────────────────────────────────────────────┤
│  OPTIMIZATION RESULTS (shown after button click)        │
│  Slider: [Lower 0% ←————————→ 100% Upper]               │
│  Table + adjusted weights (updates live with slider)    │
└─────────────────────────────────────────────────────────┘
```

---

## Section 1 — Sieve Input Table

### Columns:
| # | Column | Description |
|---|--------|-------------|
| 1 | 🔒 Lock | Toggle — when locked, this sieve weight is fixed during optimization |
| 2 | Sieve Size (mm) | Dropdown from ASTM C136 standard sizes |
| 3 | Weight Retained (g) | Numeric input by user |
| 4 | % Retained | Auto-calculated = (weight / total) × 100 |
| 5 | Cumulative % Retained | Auto-calculated = sum of all % retained above |
| 6 | % Finer (Passing) | Auto-calculated = 100 − Cumulative % Retained |
| 7 | ✕ Remove | Delete row button |

### Behaviors:
- **Default sieves loaded on start:** 19.0, 9.5, 4.75, 2.36, 1.18, 0.600, 0.300, 0.150, 0.075 mm with weight = 0
- **Add Sieve button:** Opens dropdown of all remaining ASTM C136 sizes not yet added; appends row in correct size order (descending)
- **Remove Sieve:** Deletes row and recalculates all
- **Pan row:** Always present at bottom, cannot be removed, shows remaining mass
- **Total weight** displayed at bottom of weight column — this value is FIXED during optimization
- **Lock toggle (🔒/🔓):** When locked, sieve is highlighted with a colored row; weight cannot be changed by optimizer
- All calculations update in **real time** as user types

### Validation:
- Warn if total weight = 0
- Warn if any sieve weight is negative
- Warn if a sieve size appears more than once

---

## Section 2 — Semi-Log PSD Graph

### Axes:
- **X-axis:** Particle Size in mm — **LOGARITHMIC scale**
  - Range: 0.01 mm to 100 mm
  - Tick marks at: 0.01, 0.075, 0.15, 0.3, 0.6, 1.18, 2.36, 4.75, 9.5, 19, 37.5, 75
  - Label: "Particle Size (mm) — Log Scale"
- **Y-axis:** % Finer (Passing) — **LINEAR scale**
  - Range: 0% to 100%
  - Interval: 10%
  - Label: "% Finer (Passing)"

### Reference Curve Display — ASTM Limits Only

The graph always displays ASTM C136 upper and lower grading limit lines. No toggle is needed for reference curve type — ASTM is the sole reference standard.

### Curves Displayed:
| Curve | Color | Style | Condition |
|-------|-------|-------|-----------|
| Original (User Data) | Blue `#2563EB` | Solid line + dots | Always |
| ASTM Upper Limit | Orange `#EA580C` | Dotted thick | Always |
| ASTM Lower Limit | Orange `#EA580C` | Dotted thick | Always |
| Possible WG Curve — Lower-Mid (25%) | `#F59E0B` | Thin solid | Always |
| Possible WG Curve — Center (50%) | `#10B981` | Thin solid | Always |
| Possible WG Curve — Upper-Mid (75%) | `#6366F1` | Thin solid | Always |
| Optimized Curve (slider target) | Purple `#7C3AED` | Solid bold | After optimization |

---

### All Possible Well-Graded Curves within ASTM Limits (ASTM mode)

When user enters aggregate weights, the graph automatically computes and displays **multiple valid well-graded reference curves** that sit inside the ASTM band:

#### How to Generate Them:
Generate curves by interpolating at different **blend factors (t)** between ASTM lower and upper limits:

```
t = 0.00 → Lower limit curve         (shown as Lower Limit line)
t = 0.25 → Lower-Mid blend curve     (25% from lower toward upper)
t = 0.50 → Center curve              (midpoint between limits) ← ideal
t = 0.75 → Upper-Mid blend curve     (75% from lower toward upper)
t = 1.00 → Upper limit curve         (shown as Upper Limit line)

P_blend(d, t) = P_lower(d) + t × (P_upper(d) - P_lower(d))
```

- Generate t = 0.25, 0.50, 0.75 as three intermediate "possible well-graded curves"
- Each is guaranteed to be inside ASTM limits by construction
- Verify each satisfies Cᵤ ≥ 4 (gravel) or ≥ 6 (sand) AND 1 ≤ Cᶜ ≤ 3; label it as well-graded only if true
- Show them as thin lines with distinct colors in the legend
- Label in legend as: "WG Possible — 25%", "WG Possible — 50% (Center)", "WG Possible — 75%"
- Each curve is **toggleable** in the legend (click to hide/show)

#### Shaded Zone:
- Fill the area between ASTM upper and lower limits with light orange (opacity 15%)
- This visually shows the "well-graded envelope" the user's curve should fall within

---

### Graph Features:
- **Hover tooltip:** Shows sieve size + % finer for each curve at that point
- **D10, D30, D60 markers:** Vertical dashed lines at those particle sizes with labels
- **Shaded ASTM band** between upper and lower limits (light orange, 15% opacity) — always shown
- **Legend** with toggle to show/hide each individual curve by clicking
- **Zoom:** Scroll to zoom on X-axis

---

## Section 3 — Results Summary Panel

Display as a card/badge panel immediately below the graph:

```
┌──────────────────────────────────────────────────┐
│  Aggregate Type:  [Fine Sand / Coarse Gravel / Mixed]
│  Total Weight:    ___ g
│  D10:  ___ mm    D30:  ___ mm    D60:  ___ mm
│  Cᵤ (Uniformity):    ___
│  Cᶜ (Curvature):     ___
│  Classification:  [🟢 Well-Graded SW] or
│                   [🔴 Poorly-Graded SP] or
│                   [🟡 Gap-Graded]
│  USCS Symbol:     SW / SP / GW / GP / GM / GC etc.
└──────────────────────────────────────────────────┘
```

### Classification Badge Colors:
- 🟢 Green = Well-Graded (GW / SW)
- 🔴 Red = Poorly-Graded (GP / SP)
- 🟡 Yellow = Gap-Graded
- ⚪ Grey = Insufficient data

---

## Section 4 — Well-Grade Optimization

### Trigger:
A button `[🔧 Optimize for Well-Grading]` is always visible below the results panel.

- If already well-graded: Show as `[✅ Already Well-Graded — View Alternatives]` in green
- If not well-graded: Show as `[🔧 Optimize for Well-Grading]` in blue

### On Click — Run ASTM-Based Optimization with Variation Slider:

**% Difference Variation Slider:**

A slider control appears at the top of the optimization panel:
```
Optimization Target Position within ASTM Band:
[Lower ←————————|————————→ Upper]
   0%     25%   50%   75%   100%
         Current: 50% (Center)
```

- Slider range: **0% to 100%** in 5% steps
- Default: **50%** (center of ASTM band — most neutral well-graded target)
- Label updates dynamically: "Targeting center of ASTM band", "Targeting 75% toward upper limit", etc.
- Each slider position generates a new optimized curve **in real-time**
- Formula: `P_target(d, t) = P_lower(d) + t × (P_upper(d) - P_lower(d))`
  where `t` = slider value / 100

**Preset Buttons** (quick select below slider):
```
[Lower (0%)]  [25%]  [Center (50%)]  [75%]  [Upper (100%)]
```

**What changes when slider moves:**
- Optimization table updates instantly showing new adjusted weights
- New optimized curve appears on graph in real-time (replaces previous)
- Cᵤ and Cᶜ for the new result are recalculated and shown
- If target position does not produce a well-graded result, show warning badge: "⚠️ This position may not achieve well-grading — try adjusting the slider toward center"

**Optimization Math:**
```
P_target(d) = P_lower(d) + (t/100) × (P_upper(d) - P_lower(d))
Minimize: Σ |P_actual(dᵢ) - P_target(dᵢ)|²
Subject to: Σ weight_i = Total_weight (FIXED)
            weight_i ≥ 0 for all i
            weight_i = original_i for all locked sieves
```

### Optimization Algorithm (Simple Redistribution):
Since total weight is fixed, use iterative proportional adjustment:
1. Calculate target % finer for each sieve from formula
2. Convert target % finer → target cumulative % retained → target % retained per sieve
3. Convert target % retained → target weight = (target% / 100) × total_weight
4. For locked sieves: keep original weight, redistribute remaining budget across unlocked sieves proportionally
5. Clamp all weights to ≥ 0
6. Re-normalize so total = original total weight exactly
7. Verify resulting Cᵤ and Cᶜ classify as well-graded; if not, note it

### Optimization Results Display:

Show the optimization panel as a **single view** (no tabs — ASTM is the only method), containing:

#### Tab Content:
1. **Resulting Classification Badge** (is it now well-graded?)
2. **New Cᵤ and Cᶜ values**
3. **Adjustment Table:**

| Sieve (mm) | Original Weight (g) | Adjusted Weight (g) | Change (g) | Original % Finer | New % Finer |
|------------|--------------------|--------------------|------------|-----------------|-------------|
| 19.0 | 200 | 200 🔒 | 0 (locked) | 100.0 | 100.0 |
| 9.5 | 150 | 180 | **+30** ↑ | 92.5 | 94.0 |
| 4.75 | 300 | 250 | **-50** ↓ | 77.5 | 81.5 |
| ... | ... | ... | ... | ... | ... |
| **Total** | **1000 g** | **1000 g** | **0** | — | — |

- Positive changes shown in **green with ↑**
- Negative changes shown in **red with ↓**
- Zero changes shown in grey
- Locked rows show 🔒 icon and greyed background

4. **Instruction Summary below table:**
```
To achieve well-grading:
• Add 30g to 9.5mm fraction
• Remove 50g from 4.75mm fraction
• [etc...]
Total weight remains fixed at 1000g.
```

5. **Both curves plotted** on the graph simultaneously (original + this scenario)

---

## Section 5 — Sieve Management Controls

### Add Sieve:
- Button: `[+ Add Sieve Size]`
- Opens a dropdown list of all standard ASTM C136 sieve sizes NOT currently in the table
- User selects one → row inserted in correct position (sorted descending by size)
- Default weight = 0 g

### Remove Sieve:
- Each row has `[✕]` button on the right
- Pan row cannot be removed
- After removal, all % calculations update instantly

### Lock/Unlock Sieve:
- Toggle icon `🔒` / `🔓` on each row
- Locked rows: highlighted background (e.g., light yellow), weight input is disabled/greyed
- Locked sieves are completely excluded from weight redistribution during optimization
- A summary note below table: "X sieves locked — Y g is fixed. Z g available for redistribution."

---

## Section 6 — ASTM C136 Grading Limits Reference

The app should have built-in ASTM grading limit tables for common aggregate types:

### Fine Aggregate (ASTM C33):
| Sieve | Min % Passing | Max % Passing |
|-------|--------------|--------------|
| 9.5 mm | 100 | 100 |
| 4.75 mm | 95 | 100 |
| 2.36 mm | 80 | 100 |
| 1.18 mm | 50 | 85 |
| 0.600 mm | 25 | 60 |
| 0.300 mm | 5 | 30 |
| 0.150 mm | 0 | 10 |

### Coarse Aggregate Size No. 67 (ASTM C33 — 19mm to 4.75mm):
| Sieve | Min % Passing | Max % Passing |
|-------|--------------|--------------|
| 25.0 mm | 100 | 100 |
| 19.0 mm | 90 | 100 |
| 9.5 mm | 20 | 55 |
| 4.75 mm | 0 | 10 |
| 2.36 mm | 0 | 5 |

> App should auto-select relevant grading limits based on detected aggregate type, with option for user to manually override.

---

## Section 7 — Export & Utility Features

### Export Options (buttons in top right):
- `[📋 Copy Table]` — Copies the data table to clipboard as tab-separated text
- `[📊 Download CSV]` — Downloads sieve data + all results as CSV
- `[🖼 Download Graph]` — Downloads the PSD graph as PNG

### Reset:
- `[🔄 Reset All]` button — Clears all weights to 0, removes optimization results, resets locks

---

## UX & Design Guidelines

### Color Palette:
```
Primary:     #2563EB (Blue)
Success:     #16A34A (Green)
Warning:     #D97706 (Amber)
Danger:      #DC2626 (Red)
Purple:      #7C3AED (Optimization)
Background:  #F8FAFC
Card:        #FFFFFF
Border:      #E2E8F0
```

### Typography:
- Headers: `text-xl font-bold text-gray-800`
- Table headers: `text-sm font-semibold text-gray-600 uppercase`
- Values: `text-sm font-mono text-gray-800` (monospace for numbers)

### Responsiveness:
- Desktop: Side-by-side (table left, graph right)
- Mobile: Stacked (table top, graph bottom)

### Loading States:
- Show spinner on optimization button while calculating
- Animate graph curve drawing on first render

---

## Mathematical Reference for Implementation

### Core Calculations:
```javascript
// % Retained per sieve
percentRetained[i] = (weight[i] / totalWeight) * 100

// Cumulative % Retained
cumRetained[i] = sum(percentRetained[0..i])

// % Finer
percentFiner[i] = 100 - cumRetained[i]

// D10, D30, D60 — interpolate on log scale
// Find two adjacent sieves where % finer crosses target value
// Interpolate: log(D) = log(D1) + (target - P1) / (P2 - P1) * (log(D2) - log(D1))
// D = 10^(interpolated log value)

// Coefficient of Uniformity
Cu = D60 / D10

// Coefficient of Curvature
Cc = (D30 * D30) / (D10 * D60)

// ASTM Blend Target (for optimization)
// P_target(d, t) = P_lower(d) + t × (P_upper(d) - P_lower(d))
// where t = sliderValue / 100  (0 = lower limit, 1 = upper limit)

// Classification
if (isGravel) wellGraded = Cu >= 4 && Cc >= 1 && Cc <= 3
if (isSand)   wellGraded = Cu >= 6 && Cc >= 1 && Cc <= 3
gapGraded = Cu >= threshold && (Cc < 1 || Cc > 3)
poorlyGraded = !wellGraded && !gapGraded
```

---

## Error States & Edge Cases

| Situation | Behavior |
|-----------|----------|
| All weights = 0 | Show "Enter aggregate weights to begin" placeholder |
| Only one sieve has weight | Show warning: "Insufficient data for grading analysis" |
| D10 cannot be found | Show "N/A" for Cᵤ, Cᶜ |
| Optimization makes no improvement | Show note: "Curve cannot be fully optimized within weight constraint" |
| All sieves locked | Disable optimization button with tooltip: "Unlock at least one sieve to optimize" |
| Total weight after optimization ≠ original | Force re-normalize and show warning |

---

## Component Architecture

```
<App>
  <Header />
  <MainLayout>
    <LeftPanel>
      <SieveControls />        // Add/Remove sieve buttons
      <SieveTable>
        <SieveRow />           // Per sieve: lock, size, weight, calculations
        <PanRow />             // Fixed pan row at bottom
        <TotalRow />           // Shows total weight
      </SieveTable>
      <LockSummary />          // "X sieves locked, Y g fixed"
    </LeftPanel>
    <RightPanel>
      <PSDGraph />             // Semi-log Recharts graph
      <ResultsSummary />       // Cu, Cc, D values, classification badge
      <OptimizeButton />       // Triggers optimization
      <OptimizationResults>   // Hidden until button clicked
        <VariationSlider />      // % slider (0–100%) with preset buttons
        <AdjustmentTable />     // Weight changes per sieve, updates live with slider
        <Instructions />        // Human-readable add/remove summary
      </OptimizationResults>
    </RightPanel>
  </MainLayout>
</App>
```

---

## Deliverable

A **single `.jsx` file** (React artifact) containing:
- All components defined and exported as default
- All ASTM C136 reference data hardcoded as constants
- All math functions implemented inline
- No external dependencies beyond React, Recharts, and Tailwind
- Fully functional with no backend or API calls required
- Mobile-responsive layout

---

## Notes for Developer

1. **Semi-log graph in Recharts:** Use `scale="log"` on XAxis with `domain={[0.01, 100]}` and custom `ticks` array for sieve sizes.

2. **Interpolation for D-values:** Must use log-linear interpolation, NOT linear, since X-axis is logarithmic.

3. **Weight redistribution:** Use simple proportional scaling for unlocked sieves; proportional approach is sufficient for engineering accuracy.

4. **ASTM limit auto-selection:** Detect aggregate type by checking what % of total weight is coarser vs finer than 4.75mm. Auto-select relevant ASTM C33 grading limits, with manual override option.

5. **Locked sieve weight:** Subtract all locked weights from total before redistribution. Remaining budget = total − sum(locked weights). Redistribute this remaining budget among unlocked sieves proportionally.

6. **Pan row:** Pan = Total weight − sum of all sieve weights. Its % finer is always 0%.

7. **ASTM blend curves (possible well-graded curves):** Always pre-compute at t = 0.25, 0.50, 0.75 as soon as ASTM limits are loaded. Each produces a full `{size, percentFiner}` point array plotted as thin reference lines on the graph. These are passive reference curves — always visible, not affected by slider.

8. **% Difference slider:** Store slider value `t` (0–100) in state. On change, recompute:
    ```
    P_target(d) = P_lower(d) + (t/100) × (P_upper(d) - P_lower(d))
    ```
    then run weight redistribution. Use `useMemo` keyed on `[t, sieves, locks]` so it updates live as the slider moves. Debounce by 50ms max to avoid excessive re-renders.

9. **Slider and possible reference curves are independent:** The 3 passive blend curves (t=0.25, 0.50, 0.75) on the graph are always visible as reference. The slider drives the optimization weight table separately. Both exist simultaneously.

10. **Preset buttons map to slider:** [Lower] → t=0, [25%] → t=25, [Center] → t=50, [75%] → t=75, [Upper] → t=100. Clicking a preset syncs the slider and immediately triggers recalculation.

11. **Warn on non-well-graded optimization output:** After redistribution, compute Cᵤ and Cᶜ from new weights. If still not well-graded, show a yellow warning banner: "⚠️ Target at X% does not yield a well-graded mix. Try adjusting the slider toward the center."