import { gsap } from 'gsap';

/**
 * 創建高級文字動畫效果
 * 包含模糊、縮放、位移等多種視覺效果
 */
export function createTextAnimation(
  element: HTMLElement,
  options?: {
    delay?: number;
    duration?: number;
    ease?: string;
    blur?: boolean;
    scale?: boolean;
  }
) {
  const {
    delay = 0.2,
    duration = 1.2,
    ease = 'power4.out',
    blur = true,
    scale = true,
  } = options || {};

  // 設置初始狀態
  gsap.set(element, {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
  });

  // 創建動畫時間軸
  const tl = gsap.timeline({ delay });

  // 初始狀態（動畫開始前）
  gsap.set(element, {
    y: 60,
    opacity: 0,
    scale: scale ? 0.9 : 1,
    filter: blur ? 'blur(10px)' : 'blur(0px)',
  });

  // 主動畫
  tl.to(element, {
    y: 0,
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    duration,
    ease,
  });

  // 添加微妙的彈性效果
  tl.to(
    element,
    {
      scale: 1.02,
      duration: 0.15,
      ease: 'power2.out',
    },
    '-=0.1'
  ).to(
    element,
    {
      scale: 1,
      duration: 0.2,
      ease: 'power2.in',
    }
  );

  return tl;
}

/**
 * 創建文字拆分動畫（逐字顯示）
 */
export function createSplitTextAnimation(
  element: HTMLElement,
  options?: {
    delay?: number;
    stagger?: number;
    duration?: number;
  }
) {
  const {
    delay = 0.2,
    stagger = 0.05,
    duration = 0.8,
  } = options || {};

  const text = element.textContent || '';
  const words = text.split(' ');

  // 清空並重新構建 HTML
  element.innerHTML = '';
  words.forEach((word, index) => {
    const wordWrap = document.createElement('span');
    wordWrap.style.display = 'inline-block';
    wordWrap.style.overflow = 'hidden';
    wordWrap.style.verticalAlign = 'top';
    wordWrap.style.paddingRight = '0.25em';

    const wordInner = document.createElement('span');
    wordInner.style.display = 'inline-block';
    wordInner.style.transform = 'translateY(110%)';
    wordInner.textContent = word + (index < words.length - 1 ? ' ' : '');

    wordWrap.appendChild(wordInner);
    element.appendChild(wordWrap);
  });

  // 動畫每個單詞
  const wordInners = element.querySelectorAll('span > span');
  gsap.to(wordInners, {
    y: '0%',
    duration,
    stagger,
    ease: 'power3.out',
    delay,
  });
}
