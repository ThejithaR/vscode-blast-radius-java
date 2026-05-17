import { Link, Route, Routes } from 'react-router';
import { MermaidVisualizerPage } from './pages/mermaid-visualizer';

export default function App() {
  return (
    <>
      <nav>
        <Link to="/mermaid-visualizer">Mermaid Visualizer</Link>
      </nav>

      <Routes>
        <Route path="/mermaid-visualizer" element={<MermaidVisualizerPage />} />
      </Routes>
    </>
  );
}
