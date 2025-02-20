'use client';

import React, { useCallback, useEffect } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Background,
    Controls,
    Panel,
    useNodesState,
    useEdgesState,
} from 'reactflow';
import ELK from 'elkjs/lib/elk.bundled.js';
import 'reactflow/dist/style.css';
import { Component } from '../types/machines';

const NODE_WIDTH = 250;
const NODE_HEIGHT = 100;

const elk = new ELK();

const getLayoutedElements = async (nodes: Node[], edges: Edge[]) => {
    const elkNodes = nodes.map((node) => ({
        id: node.id,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        // ELK requires fixed positions for initial layout
        x: node.position.x,
        y: node.position.y,
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
            'elk.spacing.nodeNode': '80',
            'elk.layered.spacing.nodeNodeBetweenLayers': '100',
            'elk.edgeRouting': 'ORTHOGONAL',
            'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
            'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX'
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
}

export const ComponentTree: React.FC<ComponentTreeProps> = ({ rootComponent, onExpand }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        const component = findComponent(rootComponent, node.id);
        if (component) {
            onExpand(component);
        }
    }, [onExpand, rootComponent]);

    const findComponent = (root: Component | null, id: string): Component | null => {
        if (!root) return null;
        if (root.name === id) return root;
        for (const child of root.children) {
            const found = findComponent(child, id);
            if (found) return found;
        }
        return null;
    };

    const createNodesAndEdges = useCallback((
        component: Component,
        parentId: string | null = null,
    ): { nodes: Node[], edges: Edge[] } => {
        const nodes: Node[] = [];
        const edges: Edge[] = [];

        // Create node for current component
        const newNode: Node = {
            id: component.name,
            position: { x: 0, y: 0 }, // Position will be set by ELK
            data: {
                label: component.name,
                subLabel: 'Click to expand'
            },
            draggable: false,
            className: 'bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-lg p-4 hover:shadow-xl hover:border-blue-600 dark:hover:border-blue-500 transition-all shadow-[0_8px_16px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_16px_rgba(0,0,0,0.3)] cursor-pointer',
        };
        nodes.push(newNode);

        // Create edge if there's a parent
        if (parentId) {
            const newEdge: Edge = {
                id: `${parentId}-${component.name}`,
                source: parentId,
                target: component.name,
                type: 'smoothstep',
                style: { stroke: '#94a3b8', strokeWidth: 2 },
                animated: false,
            };
            edges.push(newEdge);
        }

        // Create nodes and edges for children
        if (component.children.length > 0) {
            component.children.forEach((child) => {
                const childElements = createNodesAndEdges(child, component.name);
                nodes.push(...childElements.nodes);
                edges.push(...childElements.edges);
            });
        }

        return { nodes, edges };
    }, []);

    useEffect(() => {
        if (rootComponent) {
            // First create nodes and edges without positions
            const elements = createNodesAndEdges(rootComponent, null);

            // Then apply the layout
            getLayoutedElements(elements.nodes, elements.edges).then(({ nodes: layoutedNodes, edges: layoutedEdges }) => {
                console.log('Generated nodes:', layoutedNodes);
                console.log('Generated edges:', layoutedEdges);
                setNodes(layoutedNodes);
                setEdges(layoutedEdges);
            });
        }
    }, [rootComponent, createNodesAndEdges, setNodes, setEdges]);

    return (
        <div className="w-full h-full bg-slate-50 dark:bg-slate-900">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                nodesDraggable={false}
                nodesConnectable={false}
                fitView
                fitViewOptions={{ padding: 0.2 }}
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
                <Panel position="top-left" className="dark:text-gray-300 text-sm m-3">
                    Click nodes to expand
                </Panel>
            </ReactFlow>
        </div>
    );
}; 
