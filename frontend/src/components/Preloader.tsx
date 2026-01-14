import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useTranslation } from '../contexts/I18nContext';

export function Preloader({ onComplete }: { onComplete: () => void }) {
  const loaderRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    // 確保初始狀態 - Preloader 應該一開始就可見
    gsap.set(loaderRef.current, { opacity: 1 });
    gsap.set(textRef.current, { opacity: 0, y: 20 });
    gsap.set(barRef.current, { width: '0%' });

    const loadTl = gsap.timeline({
      onComplete: () => {
        onComplete();
      }
    });

    // 文字淡入
    loadTl
      .to(textRef.current, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' })
      // 進度條動畫（更慢，更明顯）
      .to(barRef.current, { width: '100%', duration: 2, ease: 'power2.inOut' }, '-=0.3')
      // 文字淡出
      .to(textRef.current, { y: -30, opacity: 0, duration: 0.4, ease: 'power2.in' }, '-=0.2')
      // Preloader 向上滑出
      .to(loaderRef.current, { yPercent: -100, duration: 0.8, ease: 'power4.inOut' }, '-=0.1');
  }, [onComplete]);

  return (
    <div className="loader" ref={loaderRef}>
      <div className="loader-text" ref={textRef}>{t('common.virtualFitting')}</div>
      <div className="loader-bar" ref={barRef}></div>
    </div>
  );
}
