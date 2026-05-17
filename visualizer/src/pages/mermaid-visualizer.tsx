import { useEffect, useMemo, useState } from "react";
import MermaidVisualizer, {
  type NodeDetails,
} from "../components/mermaid-visualizer-components/MermaidVisualizer";

type RiskLevel = "TARGET" | "CRITICAL" | "WARNING" | "HIGH_RISK" | "LOW_RISK" | "SAFE";

interface GraphNode {
  id: string;
  filePath: string;
  packageName: string;
  label: string;
  risk: RiskLevel;
  reason: string;
}

interface GraphEdge {
  from: string;
  to: string;
  type:
    | "breaking-dependency"
    | "warning-dependency"
    | "safe-dependency"
    | "direct-dependency"
    | "cascading-dependency"
    | "passive-dependency";
}

export interface ContractGraphData {
  targetFile: string;
  targetPackage: string;
  overallRiskScore: RiskLevel;
  summary: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const exampleContractGraphData: ContractGraphData = {
  targetFile: "src/main/java/com/enterprise/security/core/UserPrincipal.java",
  targetPackage: "com.enterprise.security.core",
  overallRiskScore: "CRITICAL",
  summary:
    "The addition of a mandatory 'tenantId' to the UserPrincipal constructor breaks compilation across Auth and JWT services. Furthermore, it creates high-risk logical gaps in downstream Billing and Middleware components that expect tenant-agnostic context.",
  nodes: [
    {
      id: "node_principal",
      filePath: "src/main/java/com/enterprise/security/core/UserPrincipal.java",
      packageName: "com.enterprise.security.core",
      label: "UserPrincipal.java",
      risk: "TARGET",
      reason: "Origin of the constructor signature change.",
    },
    {
      id: "node_jwt_provider",
      filePath: "src/main/java/com/enterprise/security/jwt/JwtTokenProvider.java",
      packageName: "com.enterprise.security.jwt",
      label: "JwtTokenProvider.java",
      risk: "CRITICAL",
      reason:
        "COMPILE BREAK: Instantiates UserPrincipal without the new 'tenantId'. Will fail to compile. Additionally, token generation logic must be updated to embed this ID.",
    },
    {
      id: "node_user_details",
      filePath: "src/main/java/com/enterprise/security/auth/CustomUserDetailsService.java",
      packageName: "com.enterprise.security.auth",
      label: "CustomUserDetailsService.java",
      risk: "CRITICAL",
      reason: "COMPILE BREAK: Database fetch method maps user entity to UserPrincipal but omits the tenantId.",
    },
    {
      id: "node_tenant_interceptor",
      filePath: "src/main/java/com/enterprise/web/middleware/TenantInterceptor.java",
      packageName: "com.enterprise.web.middleware",
      label: "TenantInterceptor.java",
      risk: "HIGH_RISK",
      reason:
        "LOGIC DRIFT: Relies on the JWT provider. If the JWT structure changes, this interceptor might fail to correctly route tenant requests, causing data leaks.",
    },
    {
      id: "node_payment_service",
      filePath: "src/main/java/com/enterprise/billing/services/PaymentService.java",
      packageName: "com.enterprise.billing.services",
      label: "PaymentService.java",
      risk: "HIGH_RISK",
      reason:
        "LOGIC DRIFT: Downstream of the TenantInterceptor. Billing calculations are currently tenant-agnostic. They must be validated against the new isolated tenant architecture.",
    },
    {
      id: "node_profile_controller",
      filePath: "src/main/java/com/enterprise/web/controllers/UserProfileController.java",
      packageName: "com.enterprise.web.controllers",
      label: "UserProfileController.java",
      risk: "LOW_RISK",
      reason:
        "PASSIVE USAGE: Passes the UserPrincipal object to the frontend JSON serializer. Will likely serialize the new tenantId automatically without breaking.",
    },
    {
      id: "node_audit_logger",
      filePath: "src/main/java/com/enterprise/telemetry/AuditLogger.java",
      packageName: "com.enterprise.telemetry",
      label: "AuditLogger.java",
      risk: "SAFE",
      reason: "Only invokes .getUsername() on the principal. Unaffected by constructor changes.",
    },
  ],
  edges: [
    { from: "node_principal", to: "node_jwt_provider", type: "direct-dependency" },
    { from: "node_principal", to: "node_user_details", type: "direct-dependency" },
    { from: "node_jwt_provider", to: "node_tenant_interceptor", type: "cascading-dependency" },
    { from: "node_tenant_interceptor", to: "node_payment_service", type: "cascading-dependency" },
    { from: "node_user_details", to: "node_profile_controller", type: "cascading-dependency" },
    { from: "node_principal", to: "node_audit_logger", type: "passive-dependency" },
  ],
};

function createGraphDataFromContract(contract: ContractGraphData) {
  const nodeIdMap = new Map<string, string>();

  contract.nodes.forEach((node, index) => {
    nodeIdMap.set(node.id, toMermaidId(node.id, index));
  });

  return {
    nodes: contract.nodes.map((node, index) => ({
      id: nodeIdMap.get(node.id) ?? toMermaidId(node.id, index),
      originalId: node.id,
      filePath: node.filePath,
      packageName: node.packageName,
      label: node.label,
      risk: normalizeRisk(node.risk),
      reason: node.reason,
    })),
    edges: contract.edges
      .map((edge) => ({
        from: nodeIdMap.get(edge.from),
        to: nodeIdMap.get(edge.to),
        type: edge.type,
      }))
      .filter((edge): edge is { from: string; to: string; type: GraphEdge["type"] } => Boolean(edge.from && edge.to)),
  };
}

const riskTheme: Record<
  RiskLevel,
  { label: string; cardBorder: string; pillBg: string; pillBorder: string; dot: string; text: string }
> = {
  TARGET: {
    label: "Target",
    cardBorder: "#2563eb",
    pillBg: "#172554",
    pillBorder: "#3b82f6",
    dot: "#60a5fa",
    text: "#bfdbfe",
  },
  CRITICAL: {
    label: "Critical",
    cardBorder: "#ef4444",
    pillBg: "#7f1d1d",
    pillBorder: "#ef4444",
    dot: "#f87171",
    text: "#fecaca",
  },
  HIGH_RISK: {
    label: "High Risk",
    cardBorder: "#f97316",
    pillBg: "#7c2d12",
    pillBorder: "#fb923c",
    dot: "#fdba74",
    text: "#fed7aa",
  },
  WARNING: {
    label: "Warning",
    cardBorder: "#f97316",
    pillBg: "#7c2d12",
    pillBorder: "#fb923c",
    dot: "#fdba74",
    text: "#fed7aa",
  },
  LOW_RISK: {
    label: "Low Risk",
    cardBorder: "#f59e0b",
    pillBg: "#713f12",
    pillBorder: "#f59e0b",
    dot: "#fbbf24",
    text: "#fde68a",
  },
  SAFE: {
    label: "Safe",
    cardBorder: "#22c55e",
    pillBg: "#14532d",
    pillBorder: "#22c55e",
    dot: "#4ade80",
    text: "#bbf7d0",
  },
};

const normalizeRisk = (risk: string): RiskLevel => {
  if (risk === "TARGET" || risk === "CRITICAL" || risk === "WARNING" || risk === "HIGH_RISK" || risk === "LOW_RISK" || risk === "SAFE") {
    return risk;
  }

  return "LOW_RISK";
};

const toMermaidId = (id: string, index: number) => {
  const normalized = id.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^[^a-zA-Z_]+/, "");
  return normalized ? `node_${index}_${normalized}` : `node_${index}`;
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const createNodeSvg = (node: GraphNode) => {
  const theme = riskTheme[normalizeRisk(node.risk)];
  const pillWidth = Math.max(88, theme.label.length * 8 + 44);

  return encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="312" height="128" viewBox="0 0 312 128">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#000000" flood-opacity="0.28"/>
    </filter>
  </defs>
  <rect x="1" y="1" width="310" height="126" rx="18" fill="#18181b" stroke="${theme.cardBorder}" stroke-opacity="0.7" stroke-width="1.5" filter="url(#shadow)"/>
  <rect x="18" y="18" width="${pillWidth}" height="28" rx="14" fill="${theme.pillBg}" stroke="${theme.pillBorder}" stroke-opacity="0.48"/>
  <circle cx="34" cy="32" r="4" fill="${theme.dot}"/>
  <text x="46" y="37" fill="${theme.text}" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="0.4">${escapeXml(theme.label)}</text>
  <text x="18" y="82" fill="#f4f4f5" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="650">${escapeXml(node.label)}</text>
  <text x="18" y="106" fill="#a1a1aa" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="500">${escapeXml(node.packageName)}</text>
</svg>
`);
};

const createNodeLine = (node: GraphNode) => {
  const nodeSvg = createNodeSvg(node);
  const altText = escapeXml(`${riskTheme[normalizeRisk(node.risk)].label} ${node.label}`);

  return `    ${node.id}["<div style='width:312px;height:128px;line-height:0;overflow:visible;'><img src='data:image/svg+xml,${nodeSvg}' style='display:block;width:312px;height:128px;' width='312' height='128' alt='${altText}' /></div>"]
    style ${node.id} fill:transparent,stroke:transparent,color:transparent`;
};

const createEdgeLine = (edge: GraphEdge) => `    ${edge.from} --> ${edge.to}`;

function createMermaidCode(graphData: ReturnType<typeof createGraphDataFromContract>) {
  return [
    "flowchart LR",
    ...graphData.nodes.map(createNodeLine),
    ...graphData.edges.map(createEdgeLine),
    "",
  ].join("\n");
}

interface MermaidVisualizerPageProps {
  contractGraphData: ContractGraphData;
}

export function MermaidVisualizerPage({ contractGraphData }: MermaidVisualizerPageProps) {
  const graphData = useMemo(() => createGraphDataFromContract(contractGraphData), [contractGraphData]);
  const [mermaidCode, setMermaidCode] = useState("flowchart LR\n");
  const nodeDetails = useMemo<Record<string, NodeDetails>>(
    () =>
      Object.fromEntries(
        graphData.nodes.map((node) => [
          node.id,
          {
            fileName: node.label,
            packageName: node.packageName,
            risk: riskTheme[normalizeRisk(node.risk)].label,
            reason: node.reason,
          },
        ]),
      ),
    [graphData.nodes],
  );

  useEffect(() => {
    setMermaidCode(createMermaidCode(graphData));
  }, [graphData]);

  return <MermaidVisualizer mermaidCode={mermaidCode} nodeDetails={nodeDetails} />;
}
