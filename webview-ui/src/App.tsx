import { useEffect, useMemo, useState } from 'react';
import mermaid from 'mermaid';

type ContractB = {
  overallRiskScore: number;
  summary: string;
  nodes: Array<{ id: string; label: string }>;
  edges: Array<{ from: string; to: string; risk: string }>;
};

const fallbackPayload: ContractB = {
  overallRiskScore: 0,
  summary: 'Waiting for blast radius data from extension host.',
  nodes: [{ id: 'A', label: 'ChangedFile.java' }, { id: 'B', label: 'Service.java' }],
  edges: [{ from: 'A', to: 'B', risk: 'low' }]
};

function App() {
  const [payload, setPayload] = useState<ContractB>(fallbackPayload);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'default' });

    const listener = (event: MessageEvent<ContractB>) => {
      if (!event.data || typeof event.data !== 'object') {
        return;
      }
      setPayload(event.data);
    };

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  const chartDefinition = useMemo(() => {
    const lines = ['flowchart TD'];
    for (const node of payload.nodes) {
      lines.push(`${node.id}["${node.label}"]`);
    }
    for (const edge of payload.edges) {
      lines.push(`${edge.from} -->|${edge.risk}| ${edge.to}`);
    }
    return lines.join('\n');
  }, [payload]);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <h1 className="text-2xl font-semibold">Blast Radius Mapper</h1>
      <p className="mt-2 text-sm text-slate-300">Risk Score: {payload.overallRiskScore}</p>
      <p className="mb-6 mt-1 text-sm text-slate-300">{payload.summary}</p>
      <pre className="mermaid rounded border border-slate-700 bg-slate-900 p-4 text-xs">{chartDefinition}</pre>
    </main>
  );
}

export default App;
