/* eslint-disable no-undef */
// Clean GSAP page load animations
import gsap from "gsap";

document.addEventListener("DOMContentLoaded", () => {
  if (!gsap) {
    document.body.style.opacity = "1";
    return;
  }

  // 1. Fade in page
  gsap.to(document.body, {
    opacity: 1,
    duration: 0.5,
    ease: "power2.out",
  });

  // 2. Animate header elements
  gsap.fromTo(
    "header h1, header h2",
    {
      opacity: 0,
      y: -20,
    },
    {
      opacity: 1,
      y: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: "power2.out",
      delay: 0.2,
    },
  );

  // 3. Animate main content
  const mainContent = document.querySelectorAll("main > *");
  if (mainContent.length) {
    gsap.fromTo(
      mainContent,
      {
        opacity: 0,
        y: 30,
      },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        stagger: 0.1,
        ease: "power2.out",
        delay: 0.4,
      },
    );
  }

  // 4. Animate the page's lower metadata, wherever that layout places it.
  const footerContent = document.querySelectorAll(
    "#third-column > *, .week-sidebar-meta > *",
  );
  if (footerContent.length) {
    gsap.fromTo(
      footerContent,
      {
        opacity: 0,
        y: 20,
      },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: "power2.out",
        delay: 0.8,
      },
    );
  }
});
