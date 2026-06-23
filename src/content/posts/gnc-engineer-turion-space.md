---
title: "GNC Engineer @ Turion Space"
description: "GNC Engineer for the Droid.001 and Droid.002 satellite missions: autonomous mission ops and attitude control optimization for in-situ Non-Earth Imaging (NEI)."
date: 2024-09-21
cover: "/media/covers/gnc-engineer-turion-space.mp4"
tags: ["GNC", "Mission Ops", "Satellites"]
highlight: "21,000+ on-orbit images captured with the autonomous mission planning tool I built"
highlightHref: "https://www.linkedin.com/posts/on-6122023-we-launched-droid001-today-ugcPost-7433224837478797313-gUjX/"
---

At Turion Space, we’re pushing the boundaries of space technology, particularly with our work on space situational awareness and orbital debris mitigation. As a Guidance, Navigation, and Control (GNC) Engineer, I've developed the GNC systems and ensured the operational success of our first satellite **Droid.001**, and the in-development **Droid.002** (launching Q1 2025). This post provides a brief look at my contributions to spacecraft missions, focusing on significant moments, launch experiences, and my role in pushing the boundaries of space exploration.

![Cleanroom Image with Droid.001](/media/gnc-engineer-turion-space/img00.jpg)

In the cleanroom during AIT of Droid.001

#### **The Journey of Droid.001: From Launch to Full Commissioning**

Droid.001 marks a significant milestone for Turion Space as our first operational satellite, showcasing critical capabilities that pave the way for future missions. From launch to on-orbit commissioning, I was directly involved in ensuring the satellite's success from a GNC perspective. I conducted functional testing and assessed performance metrics on the GNC hardware to ensure optimal operation and resolve technical challenges throughout the mission.

<div class="li-embeds">
  <figure class="li-embed">
    <iframe src="https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7433224837478797313" title="Turion Space Droid.001 launch and mission summary post on LinkedIn" height="620" frameborder="0" allowfullscreen loading="lazy"></iframe>
  </figure>
</div>

**Turion Space LinkedIn post: Droid.001's full mission, from launch to deorbit**

For Droid.001, I developed an **autonomous optimization and mission planning tool that manages end-to-end processes for RSO target pointing, star-tracker constraints, and ground station access**. It also optimizes the ideal image capture time based on lighting conditions, imager constraints, pixel occupancy, and more. Some of the simulation pictures and videos below showcase our post-launch endeavors.

During the initial on-orbit phase of Droid.001, we encountered early challenges related to vendor ADCS issues. After a thorough first-principles engineering analysis, we were able to diagnose and correct the problems, **allowing the satellite to meet its <3 arcmin (0.05 deg) pointing accuracy requirements**. Below, I’ve included visualizations showing our recovery process and the GNC commissioning work, giving a glimpse into the technical complexity involved.

The **automated astrodynamics and attitude control tools** I developed during this phase allowed us to verify and track the performance of all GNC hardware. We performed tests on various systems, including the IMU, Gyro, and Reaction Wheels, ensuring Droid.001's ADCS system functioned flawlessly. Additionally, our team was able to use the onboard cameras to capture **stunning images of the moon**, demonstrating Droid.001's precise imaging capabilities. Though not depicted here, **Droid.001 later captured consecutive images of RSOs across multiple frames and repeated target accesses, demonstrating the on-orbit success of the GNC system design, testing, and the developed NEI optimizer.**

![In-situ images of the Moon captured by Droid.001's onboard camera, demonstrating the spacecraft's precise pointing and imaging capabilities](/media/gnc-engineer-turion-space/img01.jpg)

![In-situ images of the Moon captured by Droid.001's onboard camera, demonstrating the spacecraft's precise pointing and imaging capabilities](/media/gnc-engineer-turion-space/img03.jpg)

<div class="li-embeds">
  <figure class="li-embed">
    <iframe src="https://www.linkedin.com/embed/feed/update/urn:li:share:7199273852936331266" title="Turion Space post on LinkedIn" height="620" frameborder="0" allowfullscreen loading="lazy"></iframe>
  </figure>
  <figure class="li-embed">
    <iframe src="https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7205286188507688961" title="Turion Space post on LinkedIn" height="620" frameborder="0" allowfullscreen loading="lazy"></iframe>
  </figure>
</div>

#### **In-Situ NEI Images of the Moon taken from Droid.001**

<div class="li-embeds">
  <figure class="li-embed">
    <iframe src="https://platform.twitter.com/embed/Tweet.html?id=1791035488222183550&theme=dark&dnt=true" title="Turion Space post on X" height="620" frameborder="0" allowfullscreen loading="lazy" scrolling="no"></iframe>
  </figure>
</div>

![](/media/gnc-engineer-turion-space/img05.jpg)

**Simulation of an automated RSO imaging mission, optimized for attitude constraints and ideal image capture time**

![In-situ RSO image of Starfish Space's OTTER PUP (NORAD ID: 56933) taken from Droid.001 using the NEI Optimization software (Linkedin Post), with multiple concurrent flybys](/media/gnc-engineer-turion-space/img06.jpg)

**In-situ RSO image of** [**Starfish Space's OTTER PUP (NORAD ID: 56933)**](https://www.satcat.com/sats/56933) **taken from Droid.001 using the NEI Optimization software (**[**Linkedin Post**](https://www.linkedin.com/posts/tylerjpierce_i-only-know-how-to-use-microsoft-paint-but-activity-7289152630491168768-_U1s/)**), with multiple concurrent flybys**


**In-situ RSO image of** [**SIMSAT2 (NORAD ID: 26366)**](https://www.satcat.com/sats/26366) **taken from Droid.001 using the NEI Optimization software**
<div class="li-embeds">
  <figure class="li-embed">
    <iframe src="https://www.linkedin.com/embed/feed/update/urn:li:share:7245827506698682369" title="Turion Space post on LinkedIn" height="620" frameborder="0" allowfullscreen loading="lazy"></iframe>
  </figure>
</div>

<div class="li-embeds">
  <figure class="li-embed">
    <iframe src="https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7440068446752743424" title="Turion Space post on LinkedIn" height="620" frameborder="0" allowfullscreen loading="lazy"></iframe>
  </figure>
</div>


**Turion Space LinkedIn post on Payload Pioneers 2024 selection**

<div class="li-embeds">
  <figure class="li-embed">
    <iframe src="https://www.linkedin.com/embed/feed/update/urn:li:share:7252350370247540738" title="Turion Space post on LinkedIn" height="620" frameborder="0" allowfullscreen loading="lazy"></iframe>
  </figure>
</div>

### **The Next Evolution: Droid.002 and Beyond**

Building on the success of Droid.001, we’ve embarked on the next chapter with **Droid.002**. This satellite aims to go further by improving the imaging performance and introducing new features for tracking and capturing images of Resident Space Objects (RSOs). Currently, Droid.002 is undergoing rigorous Assembly, Integration and Testing (AIT), with tasks ranging from SITL/HITL GNC hardware testing, radiation analysis, ΔV calculations for station-keeping, and deorbiting.

A key innovation we’ve developed for both Droid.001 and Droid.002 is the **NEI Optimizer,** an on-orbit RSO pointing algorithm. This software optimizes image capture times, considering everything from the spacecraft’s position to the target’s motion, ensuring we can capture high-quality images even from fast-moving objects. You can see this in action in the videos and imagery below from both RSOs and lunar imaging missions.

<video autoplay muted loop playsinline preload="auto"><source src="/media/gnc-engineer-turion-space/vid00.mp4" type="video/mp4" /></video>

**Highlighting GNC Engineering Achievements at Turion Space**

#### **Pushing the Envelope with Turion Space**

As we continue to work on Droid.002 and look forward to building out the Droid Fleet, our mission is to drive advancements in space situational awareness, debris orbit determination, and responsive satellite technology. Each new challenge provides an opportunity for innovation, and I’m proud of our incredible progress at Turion Space.

## **AMOS 2025 Conference Paper & Poster**

At the [**Advanced Maui Optical and Space Surveillance Technologies (AMOS) Conference 2025**](https://amostech.com/), I presented our work on ***End-to-End Autonomous Mission Planning and Spacecraft Attitude Optimization for Resident Space Object Imaging***.

This research details Turion’s **Non-Earth Imaging (NEI) mission planner**, which integrates coarse/fine simulations, probability of capture formulations, and attitude optimization under ADCS constraints. The framework was validated both in high-fidelity simulations and on-orbit with **Droid.001** and **Droid.002**, demonstrating autonomous acquisition of hundreds of RSO images for orbit determination, inspection, and national security applications

**You can view both my paper and poster here:**
[📄](https://www.researchgate.net/publication/395773467_End-to-End_Autonomous_Mission_Planning_and_Spacecraft_Attitude_Optimization_for_Resident_Space_Object_Imaging) [**View the Paper (PDF)**](https://www.researchgate.net/publication/395773467_End-to-End_Autonomous_Mission_Planning_and_Spacecraft_Attitude_Optimization_for_Resident_Space_Object_Imaging)

[🖼️](https://www.researchgate.net/publication/395773552_End-to-End_Autonomous_Mission_Planning_and_Spacecraft_Attitude_Optimization_for_Resident_Space_Object_Imaging_Motivation_and_Objectives) [**View the Poster (PDF)**](https://www.researchgate.net/publication/395773552_End-to-End_Autonomous_Mission_Planning_and_Spacecraft_Attitude_Optimization_for_Resident_Space_Object_Imaging_Motivation_and_Objectives)

![](/media/gnc-engineer-turion-space/img07.jpg)

## **Turion Space Videos:**

<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/jA6TNCRmeyM" title="Turion Space video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>

<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/zQPRsL2FKRM" title="Turion Space video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>

<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/9FCYnzXmGR8" title="Turion Space video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>

<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/sN7dJQUerlg" title="Turion Space video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>
