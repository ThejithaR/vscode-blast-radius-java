import { useEffect, useState } from 'react';

interface VsCodeMessage<T = any> {
  type: string;
  payload: T;
}

/**
 * Hook to listen for messages from VS Code extension
 * @param messageType - The type of message to listen for (e.g., 'CONTRACT_B')
 * @returns The payload of the received message, or null if no message received
 */
export function useVsCodeMessage<T = any>(messageType: string): T | null {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<VsCodeMessage<T>>) => {
      if (event.data.type === messageType) {
        setData(event.data.payload);
      }
    };

    window.addEventListener('message', handleMessage);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [messageType]);

  return data;
}

// Made with Bob
