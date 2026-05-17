import { Route, Routes } from "react-router";
import { MermaidVisualizerPage, exampleContractGraphData } from "./pages/mermaid-visualizer";
import { useContractB } from "./hooks/useContractB";

export default function App() {
  const contractB = useContractB();

  // Use Contract B from VS Code if available, otherwise fall back to example data
  const contractData = contractB || exampleContractGraphData;

  return (
    <>
      <Routes>
        <Route
          path="/mermaid-visualizer"
          element={<MermaidVisualizerPage contractGraphData={contractData} />}
        />
      </Routes>
    </>
  );
}
