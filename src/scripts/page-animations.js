/* eslint-disable no-undef */
// Clean GSAP page load animations
import gsap from 'gsap';

document.addEventListener('DOMContentLoaded', () => {
  if (!gsap) {
    document.body.style.opacity = '1';
    return;
  }

  // 1. Fade in page
  gsap.to(document.body, {
    opacity: 1,
    duration: 0.5,
    ease: "power2.out"
  });

  // 2. Animate header elements
  gsap.fromTo("header h1, header h2",
    {
      opacity: 0,
      y: -20
    },
    {
      opacity: 1,
      y: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: "power2.out",
      delay: 0.2
    }
  );

  // 3. Animate main content
  gsap.fromTo("main > *",
    {
      opacity: 0,
      y: 30
    },
    {
      opacity: 1,
      y: 0,
      duration: 0.7,
      stagger: 0.1,
      ease: "power2.out",
      delay: 0.4
    }
  );

  // 4. Animate footer
  gsap.fromTo("#third-column > *",
    {
      opacity: 0,
      y: 20
    },
    {
      opacity: 1,
      y: 0,
      duration: 0.5,
      ease: "power2.out",
      delay: 0.8
    }
  );
});
