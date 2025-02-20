'use client';
import { Machine, Component } from '@/app/types/machines';
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { getImageForComponent } from '@/app/api/_services/images';

// Dynamically import ForceGraph2D with no SSR
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>
  )
});

interface MachineGraphProps {
  machine: Machine | null;
}

interface GraphNode {
  id: string;
  name: string;
  type: 'machine' | 'component' | 'material';
  imageUrl: string;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function MachineGraph({ machine }: MachineGraphProps) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [nodeSize, setNodeSize] = useState(20);
  const [chargeForce, setChargeForce] = useState(-300);
  const [linkDistance, setLinkDistance] = useState(100);
  const [centerForce, setCenterForce] = useState(0.5);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [nodeComponents, setNodeComponents] = useState<Map<string, Component[]>>(new Map());

  // Load and cache images
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };

    window.addEventListener('resize', updateDimensions);
    updateDimensions();
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (machine) {
      const loadImages = async () => {
        const nodes = graphData().nodes;
        for (const node of nodes) {
          if (node.imageUrl && !imageCache.current.has(node.imageUrl)) {
            const img = new Image();
            img.src = node.imageUrl;
            await new Promise((resolve) => {
              img.onload = resolve;
            });
            imageCache.current.set(node.imageUrl, img);
          }
        }
      };
      loadImages();
    }
  }, [machine]);

  const processComponent = (
    component: Component,
    nodes: GraphNode[],
    links: GraphLink[]
  ) => {
    nodes.push({
      id: component.name,
      name: component.name,
      type: component.type,
      imageUrl: getImageForComponent(component)
    });
  };

  const handleNodeClick = async (node: GraphNode) => {
    if (loadingNodes.has(node.id)) return;
    if (node.type === 'material') return; // Can't expand materials

    try {
      setLoadingNodes(prev => new Set(prev).add(node.id));

      const response = await fetch('/api/generate/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentName: node.name, parentType: node.type }),
      });

      if (!response.ok) throw new Error('Failed to generate components');
      const components: Component[] = await response.json();

      setNodeComponents(prev => new Map(prev).set(node.id, components));
      setExpandedNodes(prev => new Set(prev).add(node.id));
    } catch (error) {
      console.error('Error generating components:', error);
    } finally {
      setLoadingNodes(prev => {
        const next = new Set(prev);
        next.delete(node.id);
        return next;
      });
    }
  };

  const graphData = useCallback(() => {
    if (!machine) return { nodes: [], links: [] };

    const nodes: GraphNode[] = [{
      id: machine.name,
      name: machine.name,
      type: 'machine',
      imageUrl: getImageForComponent({ name: machine.name, type: 'machine' })
    }];
    const links: GraphLink[] = [];

    // Add first level components
    machine.components.forEach(component => {
      processComponent(component, nodes, links);
      links.push({
        source: machine.name,
        target: component.name
      });
    });

    // Add expanded node components
    expandedNodes.forEach(nodeId => {
      const components = nodeComponents.get(nodeId);
      if (!components) return;

      components.forEach(component => {
        processComponent(component, nodes, links);
        links.push({
          source: nodeId,
          target: component.name
        });
      });
    });

    return { nodes, links };
  }, [machine, expandedNodes, nodeComponents]);

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const graphNode = node as GraphNode;
    const label = graphNode.name;
    const fontSize = 16;
    const nodeR = 40;

    // Draw circle
    ctx.beginPath();
    ctx.arc(graphNode.x!, graphNode.y!, nodeR, 0, 2 * Math.PI, false);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.strokeStyle = graphNode.type === 'machine' ? '#4299e1' :
      graphNode.type === 'component' ? '#48bb78' : '#ed8936';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw image if available
    if (graphNode.imageUrl && imageCache.current.has(graphNode.imageUrl)) {
      const img = imageCache.current.get(graphNode.imageUrl)!;
      const imgSize = nodeR * 1.2;
      ctx.save();
      ctx.clip();
      ctx.drawImage(
        img,
        graphNode.x! - imgSize / 2,
        graphNode.y! - imgSize / 2,
        imgSize,
        imgSize
      );
      ctx.restore();
    }

    // Draw only the name
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${fontSize}px Inter, Sans-Serif`;
    ctx.fillStyle = '#333';
    ctx.fillText(label, graphNode.x!, graphNode.y! + nodeR + fontSize);

    // Draw loading indicator or expand hint
    if (loadingNodes.has(graphNode.id)) {
      ctx.beginPath();
      ctx.arc(graphNode.x! + nodeR, graphNode.y! - nodeR, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#4299e1';
      ctx.fill();
    } else if (graphNode.type !== 'material' && !expandedNodes.has(graphNode.id)) {
      // Draw + symbol to indicate expandability
      ctx.beginPath();
      ctx.moveTo(graphNode.x! + nodeR - 10, graphNode.y! - nodeR);
      ctx.lineTo(graphNode.x! + nodeR + 10, graphNode.y! - nodeR);
      ctx.moveTo(graphNode.x! + nodeR, graphNode.y! - nodeR - 10);
      ctx.lineTo(graphNode.x! + nodeR, graphNode.y! - nodeR + 10);
      ctx.strokeStyle = '#4299e1';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [loadingNodes, expandedNodes]);

  // Add this effect to update forces when values change
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge')?.strength(chargeForce);
      fgRef.current.d3Force('link')?.distance(linkDistance);
      fgRef.current.d3Force('center')?.strength(centerForce);
    }
  }, [chargeForce, linkDistance, centerForce]);

  if (!machine) return null;

  return (
    <div ref={containerRef} className="w-full h-full">
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur p-4 rounded-lg shadow-lg z-10">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Node Size ({nodeSize})</label>
            <input
              type="range"
              min="10"
              max="100"
              value={nodeSize}
              onChange={(e) => setNodeSize(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Charge Force ({chargeForce})</label>
            <input
              type="range"
              min="-1000"
              max="0"
              value={chargeForce}
              onChange={(e) => setChargeForce(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Link Distance ({linkDistance})</label>
            <input
              type="range"
              min="50"
              max="300"
              value={linkDistance}
              onChange={(e) => setLinkDistance(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Center Force ({centerForce})</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={centerForce}
              onChange={(e) => setCenterForce(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <ForceGraph2D
        ref={fgRef}
        graphData={graphData()}
        nodeRelSize={nodeSize}
        linkColor={() => '#cbd5e0'}
        nodeCanvasObject={nodeCanvasObject}
        onNodeClick={(node) => handleNodeClick(node as GraphNode)}
      />
    </div>
  );
} 
