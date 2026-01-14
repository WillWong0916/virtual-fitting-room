import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { FittingRoom } from './pages/FittingRoom';
import { ClothingFactory } from './pages/ClothingFactory';
import { Preloader } from './components/Preloader';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';
import './App.css';
import './index.css';

gsap.registerPlugin(ScrollTrigger);

function App() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      // Initialize Lenis smooth scroll
      const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        direction: 'vertical',
        smooth: true,
      });

      function raf(time: number) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);

      // Fade in body
      gsap.to('body', { opacity: 1, duration: 0.5 });

      return () => {
        lenis.destroy();
      };
    }
  }, [isLoaded]);

  return (
    <>
      {!isLoaded && <Preloader onComplete={() => setIsLoaded(true)} />}
      
      <div className="noise-overlay"></div>
      
      <Router>
        <nav className="nav-modern">
          <div className="nav-logo">VIRTUAL FITTING</div>
          <div className="nav-links">
            <NavLink to="/">試衣間</NavLink>
            <NavLink to="/admin">服裝工廠</NavLink>
          </div>
          <div className="nav-menu-mobile">MENU</div>
        </nav>

        <div className="mode-switcher-nav">
          <NavLink 
            to="/" 
            className={({ isActive }) => `mode-btn ${isActive ? 'active' : ''}`}
            end
          >
            試衣間
          </NavLink>
          <NavLink 
            to="/admin" 
            className={({ isActive }) => `mode-btn admin ${isActive ? 'active' : ''}`}
          >
            服裝工廠
          </NavLink>
        </div>

        <Routes>
          <Route path="/" element={<FittingRoom />} />
          <Route path="/admin" element={<ClothingFactory />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;
