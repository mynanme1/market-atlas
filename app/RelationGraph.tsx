"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type GraphCompany = { id: number; name: string; position: string; color: string };
type GraphRelation = { id: number; sourceId: number; targetId: number; type: string };
type PositionedNode = GraphCompany & { x: number; y: number; layer: number };

const NODE_W = 142;
const NODE_H = 112;
const CHAIN_TYPES = ["供应", "原料", "需求传导", "产业传导", "跨链传导", "客户", "销售", "代工"];

function isChainRelation(relation: GraphRelation) {
  return CHAIN_TYPES.some(type => relation.type.includes(type));
}

function buildLayeredLayout(
  companies: GraphCompany[],
  relations: GraphRelation[],
  width: number,
  height: number,
) {
  const chainRelations = relations.filter(isChainRelation);
  const ids = new Set(companies.map(company => company.id));
  const incoming = new Map(companies.map(company => [company.id, 0]));
  const outgoing = new Map(companies.map(company => [company.id, [] as number[]]));

  for (const relation of chainRelations) {
    if (!ids.has(relation.sourceId) || !ids.has(relation.targetId)) continue;
    incoming.set(relation.targetId, (incoming.get(relation.targetId) ?? 0) + 1);
    outgoing.get(relation.sourceId)?.push(relation.targetId);
  }

  const rank = new Map<number, number>();
  const queue = companies.filter(company => incoming.get(company.id) === 0).map(company => company.id);
  for (const id of queue) rank.set(id, 0);

  while (queue.length) {
    const sourceId = queue.shift()!;
    for (const targetId of outgoing.get(sourceId) ?? []) {
      rank.set(targetId, Math.max(rank.get(targetId) ?? 0, (rank.get(sourceId) ?? 0) + 1));
      incoming.set(targetId, (incoming.get(targetId) ?? 1) - 1);
      if (incoming.get(targetId) === 0) queue.push(targetId);
    }
  }

  // Cycles and isolated nodes receive a stable, readable fallback layer.
  companies.forEach((company, index) => {
    if (!rank.has(company.id)) rank.set(company.id, index % 3);
  });

  const maxRawRank = Math.max(0, ...rank.values());
  const normalizedRank = new Map<number, number>();
  for (const [id, value] of rank) {
    normalizedRank.set(id, maxRawRank === 0 ? 1 : Math.round((value / maxRawRank) * 2));
  }

  const layers: GraphCompany[][] = [[], [], []];
  companies.forEach(company => layers[normalizedRank.get(company.id) ?? 1].push(company));

  // Barycentric ordering minimizes crossings between adjacent columns.
  for (let sweep = 0; sweep < 6; sweep++) {
    for (let layerIndex = 1; layerIndex < 3; layerIndex++) {
      const previousOrder = new Map(layers[layerIndex - 1].map((company, index) => [company.id, index]));
      layers[layerIndex].sort((a, b) => {
        const parents = (id: number) => chainRelations
          .filter(relation => relation.targetId === id)
          .map(relation => previousOrder.get(relation.sourceId))
          .filter((value): value is number => value !== undefined);
        const ap = parents(a.id);
        const bp = parents(b.id);
        const aa = ap.length ? ap.reduce((sum, value) => sum + value, 0) / ap.length : layers[layerIndex].indexOf(a);
        const bb = bp.length ? bp.reduce((sum, value) => sum + value, 0) / bp.length : layers[layerIndex].indexOf(b);
        return aa - bb || a.id - b.id;
      });
    }
  }

  const xPositions = [110, width / 2, width - 110];
  const top = 112;
  const bottom = height - 48;
  const positioned: PositionedNode[] = [];
  layers.forEach((layer, layerIndex) => {
    const available = bottom - top;
    layer.forEach((company, index) => {
      const y = layer.length === 1
        ? top + available / 2
        : top + (index * available) / (layer.length - 1);
      positioned.push({ ...company, x: xPositions[layerIndex], y, layer: layerIndex });
    });
  });
  return positioned;
}

function roundedLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  accent: string,
) {
  ctx.font = '12px Arial, "Microsoft YaHei", sans-serif';
  const width = ctx.measureText(text).width + 20;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - 13, width, 26, 13);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.45;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#50645a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

export function RelationGraph({
  companies,
  relations,
  onSelect,
}: {
  companies: GraphCompany[];
  relations: GraphRelation[];
  onSelect: (company: GraphCompany) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 900, height: 640 });

  useEffect(() => {
    if (!wrapRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: Math.max(720, entry.contentRect.width), height: entry.contentRect.height });
    });
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, []);

  const nodes = useMemo(
    () => buildLayeredLayout(companies, relations, size.width, size.height),
    [companies, relations, size],
  );
  const graphHeight = Math.max(640, Math.ceil(companies.length / 3) * 154 + 130);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size.width, size.height);

    const columnWidth = size.width / 3;
    ["上游资源与供应", "核心制造与基础设施", "下游运营与应用"].forEach((label, index) => {
      ctx.fillStyle = index % 2 === 0 ? "#f5f8f4" : "#f9faf7";
      ctx.fillRect(index * columnWidth, 0, columnWidth, size.height);
      if (index > 0) {
        ctx.strokeStyle = "#dfe6df";
        ctx.setLineDash([4, 7]);
        ctx.beginPath();
        ctx.moveTo(index * columnWidth, 24);
        ctx.lineTo(index * columnWidth, size.height - 24);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = "#718078";
      ctx.font = '600 12px Arial, "Microsoft YaHei", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(label, index * columnWidth + columnWidth / 2, 38);
    });

    const byId = new Map(nodes.map(node => [node.id, node]));
    const drawArrow = (endX: number, endY: number, angle: number, color: string) => {
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - 9 * Math.cos(angle - Math.PI / 6), endY - 9 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(endX - 9 * Math.cos(angle + Math.PI / 6), endY - 9 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };

    relations.filter(isChainRelation).forEach(relation => {
      const source = byId.get(relation.sourceId);
      const target = byId.get(relation.targetId);
      if (!source || !target) return;
      const startX = source.x + NODE_W / 2;
      const startY = source.y;
      const endX = target.x - NODE_W / 2;
      const endY = target.y;
      const midX = (startX + endX) / 2;
      const color = relation.type.includes("供应") ? "#3b9f8c" : "#648db6";
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(midX, startY, midX, endY, endX, endY);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      drawArrow(endX, endY, Math.atan2(endY - startY, Math.max(endX - midX, 1)), color);
      roundedLabel(ctx, relation.type, midX, (startY + endY) / 2, color);
    });

    relations.filter(relation => !isChainRelation(relation)).forEach((relation, index) => {
      const source = byId.get(relation.sourceId);
      const target = byId.get(relation.targetId);
      if (!source || !target) return;
      const routeY = index % 2 === 0 ? 74 + index * 18 : size.height - 32 - index * 12;
      const startX = source.x;
      const startY = source.y + (routeY < source.y ? -NODE_H / 2 : NODE_H / 2);
      const endX = target.x;
      const endY = target.y + (routeY < target.y ? -NODE_H / 2 : NODE_H / 2);
      const color = relation.type.includes("主题") ? "#a66bd4" : "#b27b49";
      ctx.save();
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(startX, routeY, endX, routeY, endX, endY);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();
      drawArrow(endX, endY, Math.atan2(endY - routeY, 0.01), color);
      roundedLabel(ctx, relation.type, (startX + endX) / 2, routeY, color);
    });
  }, [nodes, relations, size]);

  return (
    <div className="forceGraph layeredGraph" ref={wrapRef} style={{ height: graphHeight }}>
      <canvas ref={canvasRef} aria-hidden="true" />
      {nodes.map(node => (
        <button
          className="graphNode"
          key={node.id}
          style={{ left: node.x, top: node.y }}
          onClick={() => onSelect(node)}
        >
          <span style={{ background: node.color }}>{node.name.slice(0, 1)}</span>
          <b>{node.name}</b>
          <small>{node.position}</small>
        </button>
      ))}
    </div>
  );
}
