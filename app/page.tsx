"use client";
import { useState } from "react";
import { ComponentTree } from './components/ComponentTree';
import { Component } from './types/machines';
import { ReactFlowProvider } from 'reactflow';
import { motion } from "framer-motion";
import { IconBrain, IconAtom, IconCube } from '@tabler/icons-react';

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
    <main className="w-screen h-screen overflow-hidden bg-[#0A0F1C]">
      <ReactFlowProvider>
        <ComponentTree rootComponent={rootComponent} onExpand={handleExpand} />
      </ReactFlowProvider>

      {!rootComponent && (
        <div className="fixed inset-0 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-2xl mx-4"
          >
            {/* Background decorative elements */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-blue-500/10 rounded-3xl blur-3xl" />
            <motion.div
              className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-3xl opacity-20 group-hover:opacity-30 blur"
              animate={{
                background: [
                  "linear-gradient(to right, rgb(99, 102, 241, 0.2), rgb(59, 130, 246, 0.2))",
                  "linear-gradient(to right, rgb(59, 130, 246, 0.2), rgb(99, 102, 241, 0.2))",
                  "linear-gradient(to right, rgb(99, 102, 241, 0.2), rgb(59, 130, 246, 0.2))",
                ],
              }}
              transition={{ duration: 5, repeat: Infinity }}
            />

            <div className="relative bg-[#0F1629]/90 backdrop-blur-xl p-12 rounded-3xl border border-indigo-500/10 shadow-[0_0_50px_-12px] shadow-indigo-500/20">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col items-center"
              >
                <div className="relative mb-4">
                  <motion.div
                    className="absolute inset-0 blur-2xl"
                    animate={{
                      opacity: [0.4, 0.2, 0.4],
                      scale: [1, 1.1, 1],
                    }}
                    transition={{ duration: 4, repeat: Infinity }}
                  >
                    <IconCube size={56} className="text-indigo-500/50" strokeWidth={1.5} />
                  </motion.div>
                  <IconCube size={56} className="text-indigo-400 relative z-10" strokeWidth={1.5} />
                </div>

                <motion.h1
                  className="text-6xl font-black tracking-wider text-center mb-2 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  MACHINECUBE
                </motion.h1>
                <motion.p
                  className="text-indigo-200/60 text-center mb-8 text-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  Decompose any machine into its fundamental components
                </motion.p>

                <motion.form
                  onSubmit={handleSubmit}
                  className="flex flex-col items-center gap-6 w-full"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="relative w-full group">
                    <motion.div
                      className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-300"
                      whileHover={{ scale: 1.02 }}
                    />
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Enter a machine or product name..."
                      className="relative w-full px-6 py-4 text-lg bg-[#0F1629] text-indigo-100 rounded-xl
                               border border-indigo-500/20 focus:border-indigo-500/50
                               focus:outline-none focus:ring-2 focus:ring-indigo-500/20
                               transition-all duration-300 placeholder-indigo-300/30"
                      disabled={isLoading}
                    />
                  </div>

                  <motion.button
                    type="submit"
                    disabled={isLoading}
                    className="relative px-8 py-4 text-lg font-semibold text-white rounded-xl
                             overflow-hidden group transition-all duration-300"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-blue-500"
                      animate={{
                        background: [
                          "linear-gradient(to right, rgb(99, 102, 241), rgb(59, 130, 246))",
                          "linear-gradient(to right, rgb(59, 130, 246), rgb(99, 102, 241))",
                          "linear-gradient(to right, rgb(99, 102, 241), rgb(59, 130, 246))",
                        ],
                      }}
                      transition={{ duration: 5, repeat: Infinity }}
                    />
                    <span className="relative flex items-center gap-2">
                      {isLoading ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          >
                            <IconAtom size={20} />
                          </motion.div>
                          Dividing...
                        </>
                      ) : (
                        <>
                          <IconBrain size={20} />
                          Divide!
                        </>
                      )}
                    </span>
                  </motion.button>
                </motion.form>
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
