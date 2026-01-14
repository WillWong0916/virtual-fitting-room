import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export function Preloader({ onComplete }: { onComplete: () => void }) {
  const loaderRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadTl = gsap.timeline({
      onComplete: () => {
        onComplete();
      }
    });

    loadTl
      .to(barRef.current, { width: '100%', duration: 1.5, ease: 'power2.inOut' })
      .to(textRef.current, { y: -50, opacity: 0, duration: 0.5 }, '-=0.3')
      .to(loaderRef.current, { yPercent: -100, duration: 1, ease: 'power4.inOut' });
  }, [onComplete]);

  return (
    <div className="loader" ref={loaderRef}>
      <div className="loader-text" ref={textRef}>VIRTUAL FITTING</div>
      <div className="loader-bar" ref={barRef}></div>
    </div>
  );
}
