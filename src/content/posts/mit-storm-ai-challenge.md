---
title: "MIT ARCLab STORM-AI Competition"
description: "Placed 4th in the MIT ARCLab STORM-AI competition: real-time thermospheric density forecasting for LEO spacecraft with a BiGRU-attention network."
date: 2025-05-30
cover: "/media/covers/mit-storm-ai-challenge.mp4"
tags: ["Machine Learning", "Space Weather", "PyTorch"]
highlight: "4th place: MIT ARCLab STORM-AI Challenge"
highlightHref: "https://aeroastro.mit.edu/arclab/aichallenge/"
---

![](/media/mit-storm-ai-challenge/img00.jpg)

## **Real‑Time Thermospheric Density Forecasting with a BiGRU‑Attention Network**

*STORM‑AI Phase 2 Project Recap*

### **Why I Tackled Thermospheric Density Forecasting:**

Low‑Earth Orbit (LEO) is no longer roomy real estate: more than **5,500 operational spacecraft already circle Earth**, and the mega‑constellations on the launch manifest will multiply that figure in the next few years . When the Sun hurls a geomagnetic storm our way, the thermosphere can **swell by an order of magnitude**, amplifying drag and scrambling conjunction assessments. Today’s options are unsatisfying:

- **First‑principles general‑circulation models** (e.g., TIE‑GCM, GITM) track fine‑scale physics but demand hours on a super‑computer for a single 3‑day forecast .
- **Empirical climatologies** (NRLMSISE‑00, JB2008) respond in milliseconds yet miss post‑storm cooling and routinely stray by **> 40 %** during disturbances .

I wanted a **real‑time model that keeps the speed of climatologies but inherits the storm awareness of physics codes**. The MIT ARCLab **STORM‑AI Challenge** supplied the perfect testbed: predict orbit‑averaged density at 10‑min cadence for the next 72 h, and be judged by an exponentially time‑weighted OD‑RMSE skill score. That precise metric, plus a hard runtime envelope, drove every design choice in my solution.

### **A 60‑Day History In, a 72‑Hour Forecast Out:**

**Data buffet (181 features × 1,440 time‑steps)**

Each training sample is a 60‑day slice of hourly drivers:

- **168 dynamic OMNI2 channels**: solar‑wind plasma, IMF components, geomagnetic indices, plus explicit lags at {1, 2, 3, 4, 6, 12} h and a 3 h rolling mean to expose multi‑scale variability .
- **Orbit context**: six Keplerian elements and derived latitude/longitude/altitude.
- **Temporal encodings**: sin/cos of longitude, day‑of‑year, and sidereal time.
- **Sequence‑wise normalizer** ρ₀ removes altitude trends so the network learns relative fluctuations transferable across satellites .

A two‑stage scaler (quantile → standard) maps every feature to Ɲ(0, 1), taming proton‑flux outliers and ensuring numeric stability.

<figure class="table-center">
<table>
<thead>
<tr><th>Stage</th><th>Layer</th><th>Output</th></tr>
</thead>
<tbody>
<tr><td>Encoder</td><td>3 × BiGRU (h = 384/dir)</td><td>1440 × 768 hidden states</td></tr>
<tr><td>Attention</td><td>Additive attention</td><td>768-D context vector, z</td></tr>
<tr><td>Head</td><td>LayerNorm → GELU → Linear</td><td>432-step log-density residual</td></tr>
</tbody>
</table>
</figure>

The additive attention **automatically spotlighted the handful of storm‑time hours that dominate drag errors**, giving the model storm “situational awareness” without deep stacks .

**Metric‑aligned training:**
Loss is a **time‑weighted MSE whose exponential kernel is** ***identical*****to the OD‑RMSE leaderboard weights**, so 95 % of the gradient signal lives in the first ≈19 h of the horizon . AdamW, gradient clipping to 1.0, AMP, and early stopping land a converged model in ~4 h on a single RTX 3090 Ti; inference clocks in at a few milliseconds.

This end‑to‑end pipeline **hits real‑time throughput, outperforms the transformer baseline, and ranks 4th on the Final leaderboard, all while running light enough for flight‑dynamics servers or even on‑board processors**.

## **Results:**

[**MIT STORM-AI**](https://aeroastro.mit.edu/arclab/aichallenge/) **Ranking:** **4th / 18** **validated participants**

| **Phase 1.1 Public (Medium)** | **Phase 1.1 Public (Hard)** | **Public Score** | **Private Score** | **Model Score** | **Normalized Model Score** | **Report Score (Q)** |
| --- | --- | --- | --- | --- | --- | --- |
| 0.6784 | 0.5398 | 0.5675 | 0.1156 | 0.4998 | **0.7094** | **0.807** |

![](/media/mit-storm-ai-challenge/img01.jpg)

![Certificate of Recognition received from MIT ARCLab](/media/mit-storm-ai-challenge/img02.jpg)

The model outperformed the official transformer baseline while keeping the parameter count and run‑time budget tiny.

### Key Innovations

- **Metric‑aligned loss**: maximizes leaderboard skill instead of generic RMSE.
- **Per‑sequence density normalization**: each file is scaled by its own background density to generalize across altitudes.
- **Explicit multi‑scale lags (1 to 12 h) + moving averages**: exposes short‑term dynamics without increasing network depth.
- **Additive attention**: automatically up‑weights the handful of storm‑time hours that dominate density variability.

### Why It Matters

- **Operational speed**: forecasts arrive fast enough for on‑ground collision‑risk screening or even *on‑board* drag compensation.
- **Storm‑time fidelity**: exponential weighting + attention means accuracy where operators care most (first 24 h).
- **Reproducibility**: the entire pipeline (data loaders, scalers, PyTorch model) is open‑sourced and deterministic.

### What’s Next

I’m would explore three extensions:

1. **Hybrid residuals**: add the learned correction on top of NRLMSIS 2.1 to blend physics priors with data‑driven agility.
2. **Uncertainty quantification**: last‑layer Laplace + Monte‑Carlo dropout for calibrated confidence intervals.
3. **Continual learning hooks**: lightweight fine‑tunes so the model stays sharp through Solar Cycle 25.

### Dive Deeper

- [**Paper (4 pages)**](https://www.researchgate.net/publication/393786213_Real-Time_Thermospheric_Density_Forecasting_with_a_Metric-Aligned_BiGRU-Attention_Network): full method, ablation studies, and references
- **Code**: [MIT‑licensed Github repo with data loaders, training scripts, and pretrained weights](https://github.com/atillasaadat/stormai-mit-competition)
