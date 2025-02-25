'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Background,
    Panel,
    useNodesState,
    useEdgesState,
    useReactFlow,
    MarkerType,
    MiniMap,
    BackgroundVariant,
} from 'reactflow';
import ELK from 'elkjs/lib/elk.bundled.js';
import 'reactflow/dist/style.css';
import { Component } from '../types/machines';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;
const ZOOM_LEVEL = 1.5;
const ZOOM_DURATION = 800;
const ANIMATION_DURATION = 800;

const elk = new ELK();

const LoadingSpinner = () => (
    <div className="animate-in-fast">
        <div className="h-8 w-8 animate-spin">
            <svg className="text-indigo-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
            </svg>
        </div>
    </div>
);

const getLayoutedElements = async (nodes: Node[], edges: Edge[]) => {
    const elkNodes = nodes.map((node) => ({
        id: node.id,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
    }));

    const elkEdges = edges.map((edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
    }));

    const elkGraph = {
        id: 'root',
        layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': 'DOWN',
            'elk.spacing.nodeNode': '30',
            'elk.layered.spacing.nodeNodeBetweenLayers': '70',
            'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
            'elk.layered.crossingMinimization.strategy': 'INTERACTIVE',
            'elk.layered.considerModelOrder.strategy': 'PREFER_NODES',
            'elk.layered.spacing.edgeNode': '80',
            'elk.layered.spacing.edgeEdge': '80',
            'elk.spacing.componentComponent': '150',
            'elk.layered.priority.straightness': '10',
            'elk.layered.mergeEdges': 'false',
            'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
            'elk.spacing.individual': '50',
            'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
            'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
        },
        children: elkNodes,
        edges: elkEdges,
    };

    const layoutedGraph = await elk.layout(elkGraph);

    // Transform the nodes back to React Flow format
    const layoutedNodes = nodes.map((node) => {
        const layoutNode = layoutedGraph.children?.find((n) => n.id === node.id);
        if (!layoutNode) return node;

        return {
            ...node,
            position: {
                x: layoutNode.x || 0,
                y: layoutNode.y || 0,
            },
        };
    });

    return { nodes: layoutedNodes, edges };
};

interface ComponentTreeProps {
    rootComponent: Component | null;
    onExpand: (component: Component) => void;
    isGenerating?: boolean;
}

export const ComponentTree: React.FC<ComponentTreeProps> = ({ rootComponent, onExpand, isGenerating = false }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [clickedNodeId, setClickedNodeId] = useState<string | null>(null);
    const [newNodeIds, setNewNodeIds] = useState<Set<string>>(new Set());
    const [isAnimating, setIsAnimating] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const idCounterRef = useRef<{ [key: string]: number }>({});
    const layoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { setViewport, getNode } = useReactFlow();

    const getUniqueId = useCallback((baseName: string) => {
        idCounterRef.current[baseName] = (idCounterRef.current[baseName] || 0) + 1;
        return idCounterRef.current[baseName] === 1 ? baseName : `${baseName}-${idCounterRef.current[baseName]}`;
    }, []);

    const zoomToNode = useCallback((nodeId: string) => {
        const node = getNode(nodeId);
        if (!node) return;

        const x = node.position.x + NODE_WIDTH / 2;
        const y = node.position.y + NODE_HEIGHT / 2;

        setViewport(
            {
                x: -x * ZOOM_LEVEL + window.innerWidth / 2,
                y: -y * ZOOM_LEVEL + window.innerHeight / 2,
                zoom: ZOOM_LEVEL,
            },
            { duration: ZOOM_DURATION }
        );
    }, [getNode, setViewport]);

    const findComponent = useCallback((root: Component | null, name: string): Component | null => {
        if (!root) return null;
        if (root.name === name) return root;
        for (const child of root.children) {
            const found = findComponent(child, name);
            if (found) return found;
        }
        return null;
    }, []);

    const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        const originalName = node.id.split('-').slice(0, -1).join('-') || node.id;
        const component = findComponent(rootComponent, originalName);
        if (component) {
            setIsAnimating(true);
            setClickedNodeId(node.id);

            const newIds = new Set(component.children.map(child => getUniqueId(child.name)));
            setNewNodeIds(newIds);

            onExpand(component);
        }
    }, [onExpand, rootComponent, getUniqueId, findComponent]);

    const createNodesAndEdges = useCallback((
        component: Component,
        parentId: string | null = null,
        level: number = 0
    ): { nodes: Node[], edges: Edge[] } => {
        const nodes: Node[] = [];
        const edges: Edge[] = [];

        if (level === 0) {
            idCounterRef.current = {};
        }

        const nodeId = getUniqueId(component.name);
        const isClicked = nodeId === clickedNodeId;
        const isNew = newNodeIds.has(nodeId);

        const newNode: Node = {
            id: nodeId,
            position: { x: 0, y: 0 },
            data: {
                label: component.name.replace(/\b\w/g, l => l.toUpperCase()),
                subLabel: 'Click to expand'
            },
            draggable: false,
            className: `bg-[#1e293b] border-2 border-indigo-500/50 rounded-xl p-4
                hover:shadow-lg hover:border-indigo-400 
                shadow-[0_4px_12px_rgba(0,0,0,0.2)] 
                cursor-pointer transition-all duration-300
                ${isClicked ? 'scale-105 border-indigo-400 shadow-indigo-500/30' : ''}
                ${isNew ? 'animate-in' : ''}`,
            style: {
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
                color: '#e2e8f0',
            },
        };
        nodes.push(newNode);

        if (parentId) {
            const newEdge: Edge = {
                id: `${parentId}-${nodeId}`,
                source: parentId,
                target: nodeId,
                type: 'smoothstep',
                style: {
                    stroke: '#818cf8',
                    strokeWidth: 2.5,
                },
                animated: true,
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 20,
                    height: 20,
                    color: '#818cf8',
                },
                zIndex: 10,
            };
            edges.push(newEdge);
        }

        if (component.children.length > 0) {
            component.children.forEach((child) => {
                const childElements = createNodesAndEdges(child, nodeId, level + 1);
                nodes.push(...childElements.nodes);
                edges.push(...childElements.edges);
            });
        }

        return { nodes, edges };
    }, [getUniqueId, clickedNodeId, newNodeIds]);

    useEffect(() => {
        if (rootComponent) {
            const elements = createNodesAndEdges(rootComponent, null);
            getLayoutedElements(elements.nodes, elements.edges).then(({ nodes: layoutedNodes, edges: layoutedEdges }) => {
                setNodes(layoutedNodes);
                setEdges(layoutedEdges);

                if (clickedNodeId) {
                    zoomToNode(clickedNodeId);

                    layoutTimeoutRef.current = setTimeout(() => {
                        setClickedNodeId(null);
                        setNewNodeIds(new Set());
                        setIsAnimating(false);
                    }, ZOOM_DURATION + ANIMATION_DURATION);
                }
            });
        }

        return () => {
            if (layoutTimeoutRef.current) {
                clearTimeout(layoutTimeoutRef.current);
                layoutTimeoutRef.current = null;
            }
        };
    }, [rootComponent, createNodesAndEdges, setNodes, setEdges, clickedNodeId, zoomToNode]);

    return (
        <div ref={containerRef} className="w-full h-full bg-[#111827]">
            <style jsx global>{`
                .animate-in {
                    animation: fadeIn 0.8s ease-out forwards;
                }
                .animate-in-fast {
                    animation: fadeIn 0.15s ease-out forwards;
                }
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: scale(0.95) translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }

                .react-flow__node {
                    font-family: ui-sans-serif, system-ui, sans-serif;
                    background-color: #43536b !important;
                }

                .react-flow__node-default {
                    background: transparent;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    font-weight: 500;
                    padding: 0;
                    line-height: 1.3;
                    color: #e2e8f0;
                }

                .react-flow__node-default .react-flow__node-default__label {
                    font-size: 14px;
                    font-weight: 600;
                    color: #e2e8f0;
                }

                .react-flow__node-default .react-flow__node-default__sublabel {
                    font-size: 12px;
                    color: #94a3b8;
                    margin-top: 4px;
                }

                .react-flow__node:hover {
                    transform: translateY(-2px);
                }

                .react-flow__node.selected {
                    border-color: rgb(129 140 248 / 0.6);
                    box-shadow: 0 0 0 2px rgb(129 140 248 / 0.2);
                }

                .react-flow__handle {
                    opacity: 0;
                }

                .react-flow__edge-path {
                    stroke-width: 2.5;
                }

                .react-flow__edge {
                    z-index: 5;
                    filter: drop-shadow(0 0 2px rgba(129, 140, 248, 0.3));
                }

                .react-flow__edge-interaction {
                    stroke-width: 10;
                }

                .react-flow__edge-text {
                    font-size: 12px;
                }

                .react-flow__minimap {
                    background-color: #1a2236;
                    border-radius: 12px;
                    border: 1px solid rgb(129 140 248 / 0.2);
                    overflow: hidden;
                }

                .react-flow__minimap-mask {
                    fill: rgb(129 140 248 / 0.1);
                }

                .react-flow__minimap-node {
                    fill: rgb(129 140 248 / 0.6);
                    stroke: rgb(129 140 248 / 0.3);
                }

                .react-flow__controls {
                    display: none;
                }

                .react-flow__attribution {
                    display: none;
                }
            `}</style>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                nodesDraggable={false}
                nodesConnectable={false}
                fitView
                fitViewOptions={{
                    padding: 0.5,
                    duration: ZOOM_DURATION
                }}
                proOptions={{ hideAttribution: true }}
                className="bg-[#111827]"
            >
                <Background
                    color="rgb(129 140 248 / 0.2)"
                    className="opacity-10"
                    variant={BackgroundVariant.Lines}
                    size={1}
                    gap={20}
                />
                <MiniMap
                    nodeColor="rgb(129 140 248 / 0.6)"
                    nodeStrokeWidth={2}
                    nodeStrokeColor="rgb(129 140 248 / 0.3)"
                    maskColor="rgba(26, 34, 54, 0.7)"
                    className="!bg-[#1a2236]"
                    style={{ right: 12, bottom: 12 }}
                    pannable
                    zoomable
                />
                {(isGenerating || isAnimating) && (
                    <Panel position="top-right" className="m-3">
                        <LoadingSpinner />
                    </Panel>
                )}
            </ReactFlow>
        </div>
    );
}; 
