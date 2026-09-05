"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function LandingMotion() {
  useGSAP(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const media = gsap.matchMedia();

    media.add("(min-width: 761px)", () => {
      gsap.from("[data-hero-reveal]", {
        autoAlpha: 0,
        y: 28,
        duration: 0.85,
        stagger: 0.08,
        ease: "power3.out"
      });

      const revealWords = gsap.utils.toArray<HTMLElement>("[data-reveal-word]");
      gsap.fromTo(
        revealWords,
        { opacity: 0.12 },
        {
          opacity: 1,
          stagger: 0.08,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-reveal-copy]",
            start: "top 78%",
            end: "bottom 46%",
            scrub: 0.55
          }
        }
      );

      const cards = gsap.utils.toArray<HTMLElement>("[data-stack-card]");
      cards.forEach((card, index) => {
        gsap.fromTo(
          card,
          { y: 46, scale: 0.96, opacity: 0.35 },
          {
            y: 0,
            scale: 1,
            opacity: 1,
            ease: "none",
            scrollTrigger: {
              trigger: card,
              start: "top 92%",
              end: "top 58%",
              scrub: 0.45
            },
            delay: index * 0.02
          }
        );
      });
    });

    return () => media.revert();
  });

  return null;
}
