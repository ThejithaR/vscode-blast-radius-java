import { useEffect, useState } from 'react';
import { useVsCodeMessage } from './useVsCodeMessage';
import type { ContractGraphData } from '../pages/mermaid-visualizer';

/**
 * Hook to get Contract B data from VS Code extension
 * In development mode (no VS Code), falls back to example data after 500ms timeout
 * @returns ContractGraphData or null if not yet loaded
 */
export function useContractB(): ContractGraphData | null {
  const contractFromVsCode = useVsCodeMessage<ContractGraphData>('CONTRACT_B');
  const [contractData, setContractData] = useState<ContractGraphData | null>(null);

  useEffect(() => {
    // If we receive data from VS Code, use it immediately
    if (contractFromVsCode) {
      setContractData(contractFromVsCode);
      return;
    }

    // Check if we're in VS Code environment
    const isInVsCode = typeof (window as any).acquireVsCodeApi !== 'undefined';

    if (!isInVsCode) {
      // Development mode: wait 500ms then fetch example data
      const timer = setTimeout(async () => {
        try {
          const response = await fetch('/examples/contract-b.example.json');
          if (response.ok) {
            const exampleData = await response.json();
            setContractData(exampleData);
          }
        } catch (error) {
          console.error('Failed to load example Contract B data:', error);
        }
      }, 500);

      return () => clearTimeout(timer);
    }

    // Return undefined for VS Code environment (no cleanup needed)
    return undefined;
  }, [contractFromVsCode]);

  return contractData;
}

// Made with Bob
