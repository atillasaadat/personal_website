---
title: "GNC Engineer @ Turion Space"
description: "GNC Engineer for the Droid.001 and Droid.002 satellite missions: autonomous mission ops and attitude control optimization for in-situ Non-Earth Imaging (NEI)."
date: 2024-09-21
cover: "/media/covers/gnc-engineer-turion-space.mp4"
tags: ["GNC", "Mission Ops", "Satellites"]
highlight: "26,467 on-orbit images captured with the autonomous RSO imaging tool I authored"
highlightHref: "https://www.linkedin.com/posts/on-6122023-we-launched-droid001-today-ugcPost-7433224837478797313-gUjX/"
---

<figure class="figure-float">
  <img src="/media/gnc-engineer-turion-space/img00-1000.jpg" alt="Cleanroom Image with Droid.001" width="1000" height="1333" fetchpriority="high" />
  <figcaption>In the cleanroom during Assembly, Integration, and Test (AIT) of Droid.001</figcaption>
</figure>

At Turion Space (2022 to 2025), we pushed the boundaries of space technology, particularly with our work on space situational awareness and orbital debris mitigation. As a Guidance, Navigation, and Control (GNC) Engineer, I developed the GNC systems and ensured the operational success of our first satellite **Droid.001**, launched in June 2023 on SpaceX's [Transporter-8](https://www.spacex.com/launches/transporter8) rideshare, and its larger successor **Droid.002**, launched on March 15, 2025 on SpaceX's [Transporter-13](https://www.spacex.com/launches/transporter13) rideshare from Vandenberg Space Force Base. This post provides a brief look at my contributions to both missions, focusing on significant moments, launch experiences, and my role in pushing the boundaries of space exploration.

## **The Journey of Droid.001: From Launch to Full Commissioning**

Droid.001 marks a significant milestone for Turion Space as our first operational satellite, showcasing critical capabilities that pave the way for future missions. From launch to on-orbit commissioning, I was directly involved in ensuring the satellite's success from a GNC perspective. I conducted functional testing and assessed performance metrics on the GNC hardware to ensure optimal operation and resolve technical challenges throughout the mission.

<div class="li-embeds">
  <figure class="li-embed">
    <iframe src="https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7433224837478797313" title="Turion Space Droid.001 launch and mission summary post on LinkedIn" height="620" frameborder="0" allowfullscreen loading="lazy"></iframe>
  </figure>
</div>

**Turion Space LinkedIn post: Droid.001's full mission, from launch to deorbit**

For Droid.001, I developed the **Non-Earth Imaging (NEI) Optimizer**, an autonomous mission-planning and attitude-optimization tool that manages the end-to-end process of imaging a Resident Space Object (RSO): target pointing, star-tracker and ADCS constraints, and ground station access. It also picks the ideal image capture time from the spacecraft's and target's motion, lighting conditions, imager constraints, pixel occupancy, and more, so that even fast-moving objects are captured in high quality. The NEI Optimizer flew on both Droid.001 and Droid.002 and is the subject of my AMOS 2025 paper and poster (see below). Some of the simulation pictures and videos below showcase our post-launch endeavors.

During the initial on-orbit phase of Droid.001, we encountered early challenges related to vendor ADCS issues. After a thorough first-principles engineering analysis, we were able to diagnose and correct the problems, **allowing the satellite to meet its <3 arcmin (0.05 deg) pointing accuracy requirements**. Below, I’ve included visualizations showing our recovery process and the GNC commissioning work, giving a glimpse into the technical complexity involved.

The **automated astrodynamics and attitude control tools** I developed during this phase allowed us to verify and track the performance of all GNC hardware. We performed tests on various systems, including the IMU, Gyro, and Reaction Wheels, ensuring Droid.001's ADCS system functioned flawlessly. Additionally, our team was able to use the onboard cameras to capture **stunning images of the moon**, demonstrating Droid.001's precise imaging capabilities. Though not depicted here, **Droid.001 later captured consecutive images of RSOs across multiple frames and repeated target accesses, demonstrating the on-orbit success of the GNC system design, testing, and the NEI Optimizer.**

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

### **In-Situ NEI Images of the Moon taken from Droid.001**

<div class="li-embeds">
  <figure class="li-embed">
    <iframe src="https://platform.twitter.com/embed/Tweet.html?id=1791035488222183550&theme=dark&dnt=true" title="Turion Space post on X" height="620" frameborder="0" allowfullscreen loading="lazy" scrolling="no"></iframe>
  </figure>
</div>

![](/media/gnc-engineer-turion-space/img05.jpg)

**Simulation of an automated RSO imaging mission, optimized for attitude constraints and ideal image capture time**

![In-situ RSO image of Starfish Space's OTTER PUP (NORAD ID: 56933) taken from Droid.001 using the NEI Optimizer (Linkedin Post), with multiple concurrent flybys](/media/gnc-engineer-turion-space/img06.jpg)

**In-situ RSO image of** [**Starfish Space's OTTER PUP (NORAD ID: 56933)**](https://www.satcat.com/sats/56933) **taken from Droid.001 using the NEI Optimizer (**[**Linkedin Post**](https://www.linkedin.com/posts/tylerjpierce_i-only-know-how-to-use-microsoft-paint-but-activity-7289152630491168768-_U1s/)**), with multiple concurrent flybys**


**In-situ RSO image of** [**SIMSAT2 (NORAD ID: 26366)**](https://www.satcat.com/sats/26366) **taken from Droid.001 using the NEI Optimizer**
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

## **The Next Evolution: Droid.002 and Beyond**

Building on the success of Droid.001, we took the next step with **Droid.002**: a 90 kg spacecraft, nearly three times the mass of Droid.001, with more capable hardware, improved imaging performance, iodine-fueled electric propulsion, and new features for tracking and capturing images of RSOs. I carried its GNC system through Assembly, Integration, and Test (AIT), with tasks ranging from SITL/HITL GNC hardware testing, radiation analysis, and ΔV budgeting for station-keeping and deorbit, and then through launch and on-orbit commissioning.

Droid.002 lifted off on March 15, 2025 aboard SpaceX's [Transporter-13](https://www.spacex.com/launches/transporter13) rideshare mission from Vandenberg Space Force Base (SLC-4E), and is fully operational. In its first year on orbit it completed [5,561 orbits and delivered more than 42,000 frames of RSO imagery](https://x.com/TurionSpace/status/2041193496149987393), running the NEI Optimizer that was first proven on Droid.001. The video below shows it in action, from RSO flybys to lunar imaging.

<video autoplay muted loop playsinline preload="auto"><source src="/media/gnc-engineer-turion-space/vid00.mp4" type="video/mp4" /></video>

**Highlighting GNC Engineering Achievements at Turion Space**

## **AMOS 2025 Conference Paper & Poster**

At the [**Advanced Maui Optical and Space Surveillance Technologies (AMOS) Conference 2025**](https://amostech.com/), I presented our work on ***End-to-End Autonomous Mission Planning and Spacecraft Attitude Optimization for Resident Space Object Imaging***.

The paper is the formal write-up of the **NEI Optimizer** described above: it integrates coarse/fine simulations, probability-of-capture formulations, and attitude optimization under ADCS constraints. The framework was validated both in high-fidelity simulations and on-orbit with **Droid.001** and **Droid.002**, demonstrating autonomous acquisition of hundreds of RSO images for orbit determination, inspection, and national security applications.

Read the full [📄 **paper (PDF)**](https://www.researchgate.net/publication/395773467_End-to-End_Autonomous_Mission_Planning_and_Spacecraft_Attitude_Optimization_for_Resident_Space_Object_Imaging) or the [🖼️ **poster (PDF)**](https://www.researchgate.net/publication/395773552_End-to-End_Autonomous_Mission_Planning_and_Spacecraft_Attitude_Optimization_for_Resident_Space_Object_Imaging_Motivation_and_Objectives) on ResearchGate. The poster is also shown below; click it to expand and zoom in.

<figure class="figure-single">
  <img src="/media/gnc-engineer-turion-space/img07.jpg" alt="AMOS 2025 poster: End-to-End Autonomous Mission Planning and Spacecraft Attitude Optimization for Resident Space Object Imaging" loading="lazy" />
  <figcaption>AMOS 2025 poster (click to expand)</figcaption>
</figure>

## **Pushing the Envelope with Turion Space**

With Droid.001 and Droid.002 both flown and the lessons from each feeding into the next-generation Droid fleet, Turion's mission is to drive advancements in space situational awareness, debris orbit determination, and responsive satellite technology. Each new challenge provided an opportunity for innovation, and I’m proud of what we accomplished at Turion Space.

## **Turion Space Videos:**

<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/jA6TNCRmeyM" title="Turion Space video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>

<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/zQPRsL2FKRM" title="Turion Space video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>

<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/9FCYnzXmGR8" title="Turion Space video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>

<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/sN7dJQUerlg" title="Turion Space video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>
