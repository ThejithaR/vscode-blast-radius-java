import type { NodeDetails } from "./MermaidVisualizer";

interface NodeDetailsCardProps {
  x: number;
  y: number;
  details: NodeDetails;
}

export function NodeDetailsCard({ x, y, details }: NodeDetailsCardProps) {
  return (
    <div
      className="node-details-card"
      style={{
        left: x,
        top: y,
      }}
    >
      <div className="node-details-card__header">
        <span className="node-details-card__risk">{details.risk}</span>
      </div>
      <div className="node-details-card__title">{details.fileName}</div>
      <div className="node-details-card__meta">{details.packageName}</div>
      <div className="node-details-card__reason">{details.reason}</div>
    </div>
  );
}
