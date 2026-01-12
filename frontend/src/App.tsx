import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { FittingRoom } from './pages/FittingRoom';
import { ClothingFactory } from './pages/ClothingFactory';
import './App.css';

function App() {
  return (
    <Router>
      <nav style={{ 
        padding: '10px 20px', 
        backgroundColor: '#242424', 
        display: 'flex', 
        gap: '20px',
        borderBottom: '1px solid #444'
      }}>
        <Link to="/" style={{ color: 'white', textDecoration: 'none', fontWeight: 'bold' }}>Fitting Room</Link>
        <Link to="/admin" style={{ color: 'white', textDecoration: 'none', fontWeight: 'bold' }}>Clothing Factory (Admin)</Link>
      </nav>

      <Routes>
        <Route path="/" element={<FittingRoom />} />
        <Route path="/admin" element={<ClothingFactory />} />
      </Routes>
    </Router>
  );
}

export default App;
