---
title: "MASc. Thesis, Ch. 2 - On-orbit Spacecraft Inertia Tensor Estimation"
description: "MASc. Thesis, Chapter 2: Estimating spacecraft inertia tensors on-orbit from attitude telemetry."
date: 2022-11-12
cover: "/media/covers/masc-thesis-ch-2-on-orbit-spacecraft-inertia-tensor-estimation.mp4"
tags: ["ADCS", "MASc Thesis", "Estimation"]
highlight: "Selected by the Canadian Space Agency as a Canadian Delegate to IAC 2022"
highlightHref: "https://www.asc-csa.gc.ca/eng/"
---

Thesis: [Design and Test Optimizations for Spacecraft Attitude Determination and Control Subsystems](https://tspace.library.utoronto.ca/handle/1807/125667)

In this chapter, a data-driven approach for estimating the on-orbit inertia tensor of a spacecraft is presented. The methodology aims to compensate for inertia tensor errors introduced by CAD-based inertia calculations. To test and validate the estimation procedure, a [Space Flight Laboratory (SFL)](https://utias-sfl.net) proprietary ADCS simulation environment was introduced. The spacecraft dynamics were stated and reconstructed distinctly for constrained least-squares optimization. An attitude maneuver was established to independently excite specific inertia terms. A method for filtering noisy sensor data was designed and utilized for multiple simulation cases. The results of the developed inertia estimation method yielded an insufficient improvement in accuracy when compared to the ground truth inertia tensor of the spacecraft. Various metrics for alternative measures of inertia tensor estimate performance were also introduced. With the 50-minute attitude maneuver, the algorithm can produce an inertia tensor that improves the attitude control error in all the induced error cases. However, the method failed to confidently produce estimates that also reduced the feed-forward torque error of the spacecraft. This demonstrates the initial potential of performing on-orbit spacecraft inertia tensor estimation with the intent of reducing attitude control error when compared to utilizing CAD-based inertia tensors, or when the satellite model is considered a black box.

<video controls preload="metadata" playsinline><source src="/media/masc-thesis-ch-2-on-orbit-spacecraft-inertia-tensor-estimation/vid00.mp4" type="video/mp4" /></video>

A [research paper](https://www.researchgate.net/publication/365595291_On-orbit_Spacecraft_Inertia_Tensor_Estimation) based on this chapter was created and submitted to the [IAC Student Competition](https://iafastro.directory/iac/paper/id/73225/summary/), selected by the [**Canadian Space Agency**](https://www.asc-csa.gc.ca/) **as 1/2 papers across Canada to join the conference as a Canadian Delegate**!

![Picture with Lisa Campbell, President of the Canadian Space Agency](/media/masc-thesis-ch-2-on-orbit-spacecraft-inertia-tensor-estimation/img00.jpg)

![](/media/masc-thesis-ch-2-on-orbit-spacecraft-inertia-tensor-estimation/img00.jpg)

![](/media/masc-thesis-ch-2-on-orbit-spacecraft-inertia-tensor-estimation/img02.jpg)

![](/media/masc-thesis-ch-2-on-orbit-spacecraft-inertia-tensor-estimation/img02.jpg)

![](/media/masc-thesis-ch-2-on-orbit-spacecraft-inertia-tensor-estimation/img04.jpg)

![](/media/masc-thesis-ch-2-on-orbit-spacecraft-inertia-tensor-estimation/img04.jpg)

![](/media/masc-thesis-ch-2-on-orbit-spacecraft-inertia-tensor-estimation/img06.jpg)

![](/media/masc-thesis-ch-2-on-orbit-spacecraft-inertia-tensor-estimation/img06.jpg)
