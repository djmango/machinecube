'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Background,
    Controls,
    Panel,
    useNodesState,
    useEdgesState,
    useReactFlow,
    MarkerType,
    MiniMap,
} from 'reactflow';
import ELK from 'elkjs/lib/elk.bundled.js';
import 'reactflow/dist/style.css';
import { Component } from '../types/machines';

const NODE_WIDTH = 250;
const NODE_HEIGHT = 100;
const ZOOM_LEVEL = 1.5;
const ZOOM_DURATION = 800;
const ANIMATION_DURATION = 300; // ms for node animations

const elk = new ELK();

const LoadingSpinner = () => (
    <div className="animate-in-fast">
        <div className="h-8 w-8 animate-spin">
            <svg className="text-blue-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
            'elk.spacing.nodeNode': '1',
            'elk.layered.spacing.nodeNodeBetweenLayers': '10',
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
    const [isLoading, setIsLoading] = useState(false);
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

        // Calculate the center position of the node
        const x = node.position.x + NODE_WIDTH / 2;
        const y = node.position.y + NODE_HEIGHT / 2;

        // Smoothly zoom to the node
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
            setIsLoading(true);
            setClickedNodeId(node.id);

            // Mark the new nodes that will be created
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
            className: `bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-lg p-4 
                hover:shadow-xl hover:border-blue-600 dark:hover:border-blue-500 
                shadow-[0_8px_16px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_16px_rgba(0,0,0,0.3)] 
                cursor-pointer backdrop-blur-sm transition-all duration-300
                ${isClicked ? 'scale-110 border-blue-600' : ''}
                ${isNew ? 'animate-in' : ''}`,
            style: {
                opacity: 1,
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
                    stroke: '#94a3b8',
                    strokeWidth: 2,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                },
                animated: true,
                markerEnd: {
                    type: MarkerType.Arrow,
                    width: 20,
                    height: 20,
                    color: '#94a3b8',
                },
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

                // Only zoom and clear animations if we're coming from a click
                if (clickedNodeId) {
                    // Start zoom animation immediately
                    zoomToNode(clickedNodeId);

                    // Wait for zoom and node animations to complete before clearing states
                    layoutTimeoutRef.current = setTimeout(() => {
                        setClickedNodeId(null);
                        setNewNodeIds(new Set());
                        // Only clear loading if we're not still generating
                        if (!isGenerating) {
                            setIsLoading(false);
                        }
                    }, ZOOM_DURATION + ANIMATION_DURATION + 200); // Add a small buffer for smoother transition
                }
            });
        }

        return () => {
            if (layoutTimeoutRef.current) {
                clearTimeout(layoutTimeoutRef.current);
                layoutTimeoutRef.current = null;
            }
        };
    }, [rootComponent, createNodesAndEdges, setNodes, setEdges, clickedNodeId, zoomToNode, isGenerating]);

    // Add effect to handle isGenerating changes
    useEffect(() => {
        if (!isGenerating && !clickedNodeId) {
            // Only clear loading when generation is complete and we're not in the middle of an animation
            setIsLoading(false);
        }
    }, [isGenerating, clickedNodeId]);

    return (
        <div ref={containerRef} className="w-full h-full bg-slate-50 dark:bg-slate-900">
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
                    padding: 0.3,
                    duration: ZOOM_DURATION
                }}
                proOptions={{ hideAttribution: true }}
                className="dark:bg-slate-900"
            >
                <Background
                    color="#475569"
                    className="dark:opacity-20 opacity-10"
                    size={20}
                />
                <Controls
                    className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
                />
                <MiniMap
                    nodeColor="#1e40af"
                    nodeStrokeWidth={3}
                    nodeClassName="dark:bg-gray-800"
                    maskColor="rgba(0, 0, 0, 0.2)"
                    className="dark:bg-slate-800 rounded-lg border dark:border-gray-700"
                    style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                    pannable
                    zoomable
                    ariaLabel="Mini map"
                    position="bottom-right"
                    inversePan={false}
                    onClick={undefined}
                />
                <Panel position="top-left" className="dark:text-gray-300 text-sm m-3">
                    <div className="mt-2">
                        <a href="https://x.com/sulaimanghori" target="_blank" rel="noopener noreferrer" className="hover:text-blue-500">
                            Everything is made of other things.
                        </a>
                    </div>
                </Panel>
                {(isLoading || isGenerating) && (
                    <Panel position="top-right" className="m-3">
                        <LoadingSpinner />
                    </Panel>
                )}
            </ReactFlow>
        </div>
    );
}; 
