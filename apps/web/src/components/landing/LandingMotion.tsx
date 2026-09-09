"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function LandingMotion() {
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(min-width: 801px) and (prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo("[data-home-image]", { opacity: .65, scale: .97 }, {
        opacity: 1, scale: 1, duration: .65, ease: "power2.out"
      });
      gsap.fromTo("[data-home-word]", { opacity: .45 }, {
        opacity: 1, stagger: .06, ease: "none",
        scrollTrigger: { trigger: "[data-home-copy]", start: "top 88%", end: "bottom 65%", scrub: .3 }
      });
    });
    return () => media.revert();
  });
  return null;
}
