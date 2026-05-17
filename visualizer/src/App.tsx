import { Route, Routes } from "react-router";
import { exampleContractGraphData, MermaidVisualizerPage } from "./pages/mermaid-visualizer";

export default function App() {
  return (
    <>
      <Routes>
        <Route
          path="/mermaid-visualizer"
          element={<MermaidVisualizerPage contractGraphData={exampleContractGraphData} />}
        />
      </Routes>
    </>
  );
}
