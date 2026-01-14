import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { FittingRoom } from './pages/FittingRoom';
import { ClothingFactory } from './pages/ClothingFactory';
import { Preloader } from './components/Preloader';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { I18nProvider, useTranslation } from './contexts/I18nContext';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';
import './App.css';
import './index.css';

gsap.registerPlugin(ScrollTrigger);

function AppContent() {
  const [isLoaded, setIsLoaded] = useState(false);
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 隱藏應用內容，但保持 body 可見（這樣 Preloader 才能顯示）
    if (contentRef.current) {
      gsap.set(contentRef.current, { opacity: 0 });
    }
    
    if (isLoaded) {
      // Initialize Lenis smooth scroll
      const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      });

      function raf(time: number) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);

      // Fade in 應用內容（延遲一點，讓 Preloader 先消失）
      if (contentRef.current) {
        gsap.to(contentRef.current, { opacity: 1, duration: 0.6, delay: 0.2 });
      }
      
      // Fade in body（如果之前設置了 opacity: 0）
      gsap.to('body', { opacity: 1, duration: 0.6, delay: 0.2 });

      return () => {
        lenis.destroy();
      };
    }
  }, [isLoaded]);

  return (
    <>
      {!isLoaded && <Preloader onComplete={() => setIsLoaded(true)} />}
      
      <div ref={contentRef} style={{ opacity: isLoaded ? 1 : 0 }}>
        <div className="noise-overlay"></div>
        
        <Router>
          <nav className="nav-modern">
            <div className="nav-logo">{t('common.virtualFitting')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <LanguageSwitcher />
              <div className="nav-menu-mobile">{t('common.menu')}</div>
            </div>
          </nav>

          <div className="mode-switcher-nav">
            <NavLink 
              to="/" 
              className={({ isActive }) => `mode-btn ${isActive ? 'active' : ''}`}
              end
            >
              {t('nav.fittingRoom')}
            </NavLink>
            <NavLink 
              to="/admin" 
              className={({ isActive }) => `mode-btn admin ${isActive ? 'active' : ''}`}
            >
              {t('nav.clothingFactory')}
            </NavLink>
          </div>

          <Routes>
            <Route path="/" element={<FittingRoom />} />
            <Route path="/admin" element={<ClothingFactory />} />
          </Routes>
        </Router>
      </div>
    </>
  );
}

function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}

export default App;
