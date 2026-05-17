import { useEffect } from "react";
import { Route, Routes } from "react-router";
import { MermaidVisualizerPage, exampleContractGraphData } from "./pages/mermaid-visualizer";
import { useContractB } from "./hooks/useContractB";

declare global {
  interface Window {
    acquireVsCodeApi?: () => { postMessage: (message: unknown) => void };
  }
}

export default function App() {
  const contractB = useContractB();

  useEffect(() => {
    window.acquireVsCodeApi?.().postMessage({ type: "WEBVIEW_READY" });
  }, []);

  // Use Contract B from VS Code if available, otherwise fall back to example data
  const contractData = contractB || exampleContractGraphData;

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={<MermaidVisualizerPage contractGraphData={contractData} />}
        />
        <Route
          path="/mermaid-visualizer"
          element={<MermaidVisualizerPage contractGraphData={contractData} />}
        />
        <Route
          path="*"
          element={<MermaidVisualizerPage contractGraphData={contractData} />}
        />
      </Routes>
    </>
  );
}
