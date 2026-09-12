---
title: "An Adaptive Telemetry Probe for Resource-Constrained Spacecraft Using F Prime"
description: "Research on an adaptive, onboard telemetry probe for resource-constrained spacecraft, built on NASA JPL's F Prime and targeting the GPDM 6U CubeSat. Accepted to AIAA SciTech 2027, presenting in session SATS-06."
date: 2026-06-15
cover: "/media/adaptive-fprime-probe/gpdm.jpg"
tags: ["Flight Software", "F Prime", "Telemetry"]
highlight: "Accepted · AIAA SciTech 2027 · Session SATS-06, Jan 13, 2027"
---

![GPDM 6U CubeSat flight hardware with deployed solar arrays. Image: NASA / Georgia Tech Space Systems Design Laboratory.](/media/adaptive-fprime-probe/gpdm.jpg)

> **Status: accepted.** This paper has been accepted to the **AIAA SciTech Forum 2027** (Orlando, FL), with co-authors V. Bhosale, K. Bhardwaj, and A. Gavrilovska. I will present it in person in **session SATS-06, Small Satellite Software, Autonomy, and Operations**, on **January 13, 2027, 1:00 to 3:00 PM Eastern**. This page is a short overview and will be expanded once the work is published.

## **The problem: telemetry on a starvation budget**

Small spacecraft are flying more capable payloads on the same tiny power, downlink, and compute budgets. Telemetry is usually the first thing squeezed: operators want dense, high-rate insight into the bus and payload, but the radio link, the onboard storage, and the flight processor cannot afford to record and downlink everything all of the time. The result is a static, hand-tuned telemetry schedule that is conservative on a good day and blind on a bad one, exactly when something anomalous is happening and high-fidelity data matters most.

This research asks a simple question: **what if the spacecraft decided, in flight, what telemetry was worth keeping?**

## **The approach: an adaptive telemetry probe in F Prime**

The work develops an **adaptive telemetry probe** that runs onboard and continuously adjusts what it samples, how often, and at what fidelity, based on the spacecraft's current state and resource headroom. Instead of a fixed packet schedule, the probe trades telemetry detail against power, storage, and downlink budgets in real time: it backs off during nominal, quiet operations and ramps up resolution around events of interest.

It is built on **NASA JPL's F Prime (F´)**, the open-source flight-software framework used across a growing set of CubeSat and small-spacecraft missions. Building the probe as F Prime components means it slots into a real flight-software architecture with its own command, telemetry, and parameter interfaces, rather than living as an offline analysis tool. That keeps the design portable across the many missions already standardized on F Prime.

## **Target mission: GPDM**

The probe is being evaluated against the **Green Propellant Dual Mode (GPDM)** mission, a NASA Marshall Space Flight Center technology demonstration built at the Georgia Tech Space Systems Design Laboratory. GPDM is a **6U CubeSat** whose primary payload is a dual-mode propulsion system that uses a single green monopropellant (ASCENT / AF-M315E) to feed both a chemical monopropellant thruster and electrospray thrusters, performing orbit-raising and lowering maneuvers in low Earth orbit. A propulsion-demonstration mission like GPDM is a demanding telemetry case: the interesting, data-hungry moments are short maneuver windows surrounded by long quiet cruise, which is exactly the regime an adaptive probe is meant to exploit.

## **Why it matters**

Adaptive, resource-aware telemetry pushes a piece of the ground operator's judgment onboard. For resource-constrained spacecraft, that means better coverage of the moments that matter without paying for it during the moments that don't, and a path toward more autonomous fault detection and event capture on missions that cannot afford a fat, always-on telemetry pipe.

More detail, results, and references will follow with the AIAA SciTech 2027 publication and the SATS-06 presentation.
