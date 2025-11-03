import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { TaskBoard } from './taskeroo/TaskBoard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/taskeroo" element={<TaskBoard />} />
      </Routes>
    </BrowserRouter>
  );
}

function Home() {
  return (
    <div style={{ padding: 24 }}>
      <h1>AI Monorepo — UI</h1>
      <p>React + TypeScript + Vite is alive.</p>
      <nav style={{ marginTop: 20 }}>
        <Link to="/taskeroo" style={{ padding: '10px 20px', background: '#3498db', color: 'white', textDecoration: 'none', borderRadius: '8px', display: 'inline-block' }}>
          Go to Taskeroo
        </Link>
      </nav>
    </div>
  );
}
