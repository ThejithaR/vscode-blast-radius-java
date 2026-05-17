import { type PointerEvent, type WheelEvent, useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { NodeDetailsCard } from './NodeDetailsCard';

export interface NodeDetails {
  fileName: string;
  packageName: string;
  risk: string;
  reason: string;
}

interface MermaidVisualizerProps {
  mermaidCode: string;
  nodeDetails?: Record<string, NodeDetails>;
}

export default function MermaidVisualizer({ mermaidCode, nodeDetails = {} }: MermaidVisualizerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const mermaidRef = useRef<HTMLDivElement>(null);
  const diagramId = useRef(`blast-radius-graph-${Math.random().toString(36).slice(2)}`);
  const panState = useRef({
    isPanning: false,
    pointerId: 0,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
  });
  const [renderError, setRenderError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.2);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [graphSize, setGraphSize] = useState({ width: 0, height: 0 });
  const [hoverCard, setHoverCard] = useState<{ x: number; y: number; details: NodeDetails } | null>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      themeVariables: {
        background: '#121214',
        mainBkg: '#18181b',
        primaryColor: '#18181b',
        primaryBorderColor: '#3f3f46',
        primaryTextColor: '#f4f4f5',
        lineColor: '#71717a',
        textColor: '#f4f4f5',
        nodeTextColor: '#f4f4f5',
      },
      securityLevel: 'loose',
      fontFamily: 'var(--vscode-font-family, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
      flowchart: {
        htmlLabels: true,
        curve: 'basis',
        useMaxWidth: false,
      },
    });
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function renderDiagram() {
      if (!mermaidRef.current || !mermaidCode.trim()) {
        return;
      }

      setRenderError(null);
      mermaidRef.current.innerHTML = '';

      try {
        const { svg, bindFunctions } = await mermaid.render(diagramId.current, mermaidCode);

        if (!isCurrent || !mermaidRef.current) {
          return;
        }

        mermaidRef.current.innerHTML = svg;
        bindFunctions?.(mermaidRef.current);

        const renderedSvg = mermaidRef.current.querySelector('svg');
        if (renderedSvg) {
          const viewBox = renderedSvg.viewBox.baseVal;
          const width = viewBox?.width || renderedSvg.getBoundingClientRect().width;
          const height = viewBox?.height || renderedSvg.getBoundingClientRect().height;

          renderedSvg.style.width = `${width}px`;
          renderedSvg.style.height = `${height}px`;
          renderedSvg.style.maxWidth = 'none';

          setGraphSize({
            width,
            height,
          });
        }
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        setRenderError(error instanceof Error ? error.message : String(error));
      }
    }

    void renderDiagram();

    return () => {
      isCurrent = false;
    };
  }, [mermaidCode]);

  function getMermaidNodeElement(target: EventTarget | null) {
    return target instanceof Element ? target.closest('.node') : null;
  }

  function getNodeDetails(target: EventTarget | null) {
    const nodeElement = getMermaidNodeElement(target);

    if (!nodeElement?.id) {
      return null;
    }

    const nodeId = Object.keys(nodeDetails).find((id) => nodeElement.id.includes(id));

    return nodeId ? nodeDetails[nodeId] : null;
  }

  function zoomBy(delta: number) {
    setScale((currentScale) => Math.min(2.5, Math.max(0.4, Number((currentScale + delta).toFixed(2)))));
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (!viewportRef.current) {
      return;
    }

    event.preventDefault();

    const rect = viewportRef.current.getBoundingClientRect();
    const pointerX = event.clientX - rect.left - 240;
    const pointerY = event.clientY - rect.top - 160;
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;

    setScale((currentScale) => {
      const nextScale = Math.min(2.5, Math.max(0.4, Number((currentScale * zoomFactor).toFixed(2))));

      if (nextScale === currentScale) {
        return currentScale;
      }

      setPanOffset((currentOffset) => ({
        x: pointerX - ((pointerX - currentOffset.x) / currentScale) * nextScale,
        y: pointerY - ((pointerY - currentOffset.y) / currentScale) * nextScale,
      }));

      return nextScale;
    });
  }

  function resetView() {
    setScale(1.2);
    setPanOffset({ x: 0, y: 0 });
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!viewportRef.current || event.button !== 0 || getMermaidNodeElement(event.target)) {
      return;
    }

    panState.current = {
      isPanning: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: panOffset.x,
      startOffsetY: panOffset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    handleNodeMove(event);

    if (!viewportRef.current || !panState.current.isPanning) {
      return;
    }

    setPanOffset({
      x: panState.current.startOffsetX + event.clientX - panState.current.startX,
      y: panState.current.startOffsetY + event.clientY - panState.current.startY,
    });
  }

  function stopPanning(event: PointerEvent<HTMLDivElement>) {
    if (panState.current.isPanning && event.currentTarget.hasPointerCapture(panState.current.pointerId)) {
      event.currentTarget.releasePointerCapture(panState.current.pointerId);
    }

    panState.current.isPanning = false;
  }

  function handleNodeHover(event: PointerEvent<HTMLDivElement>) {
    const details = getNodeDetails(event.target);

    if (!details || !viewportRef.current) {
      return;
    }

    const viewportRect = viewportRef.current.getBoundingClientRect();
    setHoverCard({
      x: event.clientX - viewportRect.left + 14,
      y: event.clientY - viewportRect.top + 14,
      details,
    });
  }

  function handleNodeMove(event: PointerEvent<HTMLDivElement>) {
    const details = getNodeDetails(event.target);

    if (!hoverCard || !details || !viewportRef.current) {
      return;
    }

    const viewportRect = viewportRef.current.getBoundingClientRect();
    setHoverCard({
      x: event.clientX - viewportRect.left + 14,
      y: event.clientY - viewportRect.top + 14,
      details,
    });
  }

  function handleNodeLeave(event: PointerEvent<HTMLDivElement>) {
    const currentNode = getMermaidNodeElement(event.target);
    const nextNode = getMermaidNodeElement(event.relatedTarget);

    if (currentNode && currentNode !== nextNode) {
      setHoverCard(null);
    }
  }

  function handleSurfacePointerLeave(event: PointerEvent<HTMLDivElement>) {
    stopPanning(event);
    setHoverCard(null);
  }

  return (
    <div className="mermaid-visualizer w-full h-full p-4">
      <div className="mermaid-toolbar">
        <button type="button" onClick={() => zoomBy(-0.1)} aria-label="Zoom out">
          -
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => zoomBy(0.1)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={resetView}>
          Reset
        </button>
      </div>
      <div
        ref={viewportRef}
        className="mermaid-surface rounded-lg"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopPanning}
        onPointerCancel={stopPanning}
        onPointerLeave={handleSurfacePointerLeave}
        onPointerOver={handleNodeHover}
        onPointerOut={handleNodeLeave}
        onWheel={handleWheel}
      >
        <div
          className="mermaid-canvas"
          style={{
            width: graphSize.width ? Math.max(graphSize.width * scale + 800, graphSize.width) : undefined,
            height: graphSize.height ? Math.max(graphSize.height * scale + 800, graphSize.height) : undefined,
          }}
        >
          <div
            ref={mermaidRef}
            className="mermaid-graph"
            style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})` }}
          />
        </div>
        {hoverCard ? <NodeDetailsCard x={hoverCard.x} y={hoverCard.y} details={hoverCard.details} /> : null}
      </div>
      {renderError ? (
        <pre className="mt-3 whitespace-pre-wrap rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-error)]">
          {renderError}
        </pre>
      ) : null}
    </div>
  );
}

// Made with Bob
