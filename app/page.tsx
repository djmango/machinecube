"use client";
import { useState } from "react";
import { ComponentTree } from './components/ComponentTree';
import { Component } from './types/machines';
import { ReactFlowProvider } from 'reactflow';

export default function Home() {
  const [rootComponent, setRootComponent] = useState<Component | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/expand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          componentName: inputValue,
          ancestry: [] // Empty ancestry means this is a root node
        }),
      });

      if (!response.ok) throw new Error('Failed to generate component');

      const children = (await response.json()) as Component[];
      const rootComponent: Component = {
        name: inputValue,
        children,
        parent: null
      };

      // Add parent references to the children
      children.forEach((child: Component) => {
        child.parent = rootComponent;
      });

      setRootComponent(rootComponent);
      setInputValue('');
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to generate component. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExpand = async (component: Component) => {
    try {
      // Build ancestry path for context
      const ancestry = [];
      let current: Component | null = component;
      while (current) {
        ancestry.unshift(current.name);
        current = current.parent;
      }

      const response = await fetch('/api/expand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          componentName: component.name,
          ancestry
        }),
      });

      if (!response.ok) throw new Error('Failed to expand component');

      const children = (await response.json()) as Component[];

      // Update the component tree by adding the new children
      const updateComponentTree = (root: Component): Component => {
        if (root === component) {
          return {
            ...root,
            children: [...root.children, ...children],
          };
        }

        return {
          ...root,
          children: root.children.map(child => updateComponentTree(child)),
        };
      };

      if (rootComponent) {
        const newRoot = updateComponentTree(rootComponent);
        // Reconstruct parent references
        const fixParentReferences = (node: Component, parent: Component | null) => {
          node.parent = parent;
          node.children.forEach(child => fixParentReferences(child, node));
        };
        fixParentReferences(newRoot, null);
        setRootComponent(newRoot);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to expand component. Please try again.');
    }
  };

  return (
    <main className="w-screen h-screen overflow-hidden">
      <ReactFlowProvider>
        <ComponentTree rootComponent={rootComponent} onExpand={handleExpand} />
      </ReactFlowProvider>

      {!rootComponent && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/20 dark:bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl">
            <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
              <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                Machine Component Explorer
              </h1>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter a machine or product name..."
                className="w-96 px-4 py-2 text-lg border-2 border-blue-500 dark:border-blue-400 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:outline-none focus:border-blue-600 dark:focus:border-blue-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg 
                         hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50
                         transition-colors"
              >
                {isLoading ? 'Generating...' : 'Generate'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
