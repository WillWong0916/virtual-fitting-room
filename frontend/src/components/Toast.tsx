import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, onClose, duration = 3000 }: ToastProps) {
  const toastRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const toast = toastRef.current;
    if (!toast) return;

    // 初始狀態：在下方隱藏
    gsap.set(toast, { y: 100, opacity: 0 });

    // 動畫時間軸
    const tl = gsap.timeline({
      onComplete: () => {
        // 動畫結束後關閉
        setTimeout(() => {
          onClose();
        }, 100);
      }
    });

    // 滑入並淡入
    tl.to(toast, {
      y: 0,
      opacity: 1,
      duration: 0.4,
      ease: 'power3.out'
    })
    // 等待指定時間
    .to({}, { duration: duration / 1000 })
    // 滑出並淡出
    .to(toast, {
      y: -50,
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in'
    });

    return () => {
      tl.kill();
    };
  }, [message, duration, onClose]);

  return (
    <div className="toast-container">
      <div className="toast" ref={toastRef}>
        <div className="toast-icon">⚠️</div>
        <div className="toast-message">{message}</div>
      </div>
    </div>
  );
}
