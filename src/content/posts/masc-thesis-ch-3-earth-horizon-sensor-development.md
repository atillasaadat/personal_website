---
title: "MASc. Thesis, Ch. 3 - Earth Horizon Sensor Development"
description: "MASc. Thesis, Chapter 3: Attitude determination with self-inspection cameras repurposed as Earth horizon sensors."
date: 2022-11-12
cover: "/media/covers/masc-thesis-ch-3-earth-horizon-sensor-development.mp4"
tags: ["ADCS", "MASc Thesis", "Computer Vision"]
highlight: "1st place: SmallSat 2022 Frank J. Redd Student Competition"
highlightHref: "https://smallsat.org/students/previous-winners"
---

Thesis: [Design and Test Optimizations for Spacecraft Attitude Determination and Control Subsystems](https://tspace.library.utoronto.ca/handle/1807/125667)

This chapter introduced a novel investigation into repurposing the [Space Flight Laboratory (SFL)](https://utias-sfl.net) mVIC, an antenna deployment inspection camera, as a viable Earth horizon sensor. A baseline of existing EHS performances was established, and sensor system requirements were defined based on SFL spacecraft missions. To properly test and verify the viability of the EHS, STK was chosen as the simulation environment due to its ability to generate sensor simulation images with similar properties as the mVIC. An image preprocessing and edge detection algorithm was created to transfer image pixel data to Earth horizon vectors defined in the spacecraft’s body frame. These vectors, along with specially selected vectors representing deep space within the image, were fed into the optimization algorithm for nadir vector estimation. A novel nadir biasing term was also introduced to artificially bias the optimization solution towards the true nadir vector solution. The estimated nadir vector was compared to the simulation environment’s true nadir vector for validation of the estimation methodology. The investigation demonstrated that the resulting estimation accuracy for over 200 images satisfied the SFL requirements for the mVIC to become viable as an Earth horizon sensor.

This chapter served as the foundation for a [research paper](https://digitalcommons.usu.edu/smallsat/2022/all2022/3/) that was presented at the [Small Satellite Conference 2022 - Frank J. Redd Student Competition](https://smallsat.org/students/previous-winners), where it proudly secured 1st place!

![](/media/masc-thesis-ch-3-earth-horizon-sensor-development/img00.jpg)

<video controls preload="metadata" playsinline><source src="/media/masc-thesis-ch-3-earth-horizon-sensor-development/vid00.mp4" type="video/mp4" /></video>

![](/media/masc-thesis-ch-3-earth-horizon-sensor-development/img01.jpg)

![](/media/masc-thesis-ch-3-earth-horizon-sensor-development/img01.jpg)

![](/media/masc-thesis-ch-3-earth-horizon-sensor-development/img03.jpg)

![](/media/masc-thesis-ch-3-earth-horizon-sensor-development/img03.jpg)

![](/media/masc-thesis-ch-3-earth-horizon-sensor-development/img05.jpg)

![](/media/masc-thesis-ch-3-earth-horizon-sensor-development/img05.jpg)

![](/media/masc-thesis-ch-3-earth-horizon-sensor-development/img07.jpg)

![](/media/masc-thesis-ch-3-earth-horizon-sensor-development/img07.jpg)

![](/media/masc-thesis-ch-3-earth-horizon-sensor-development/img09.jpg)

All the amazing students part of the Small Satellite Conference Frank J. Redd Competition 2022
