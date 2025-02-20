"use client";
import { useState } from "react";
import Image from "next/image";
import { Machine } from "./types/machines";

export default function Home() {
  const [machineName, setMachineName] = useState('');
  const [machine, setMachine] = useState<Machine | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineName }),
      });

      if (!response.ok) throw new Error('Failed to generate machine data');
      const data: Machine = await response.json();
      setMachine(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <main className="max-w-6xl mx-auto">
        {/* Header */}
        <h1 className="text-3xl font-bold mb-8">Machine Component Explorer</h1>

        {/* Search Section */}
        <form onSubmit={handleSubmit} className="mb-8">
          <input
            type="text"
            value={machineName}
            onChange={(e) => setMachineName(e.target.value)}
            placeholder="Enter machine name..."
            className="p-2 border rounded mr-2"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </form>

        {error && (
          <div className="text-red-500 mb-4">{error}</div>
        )}

        {machine && (
          <div className="border rounded p-4">
            <h2 className="text-2xl font-bold mb-4">{machine.name}</h2>
            <p className="mb-4">{machine.description}</p>
            <h3 className="text-xl font-semibold mb-2">Components:</h3>
            <ul className="list-disc pl-5">
              {machine.components.map((component, i) => (
                <li key={i} className="mb-2">
                  <h4 className="font-semibold">{component.name}</h4>
                  <p>{component.description}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Display Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Machine Display */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Selected Machine</h2>
            <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
              {loading ? (
                <p>Loading...</p>
              ) : machine ? (
                <div className="text-center">
                  <Image
                      src={machine.imageUrl}
                      alt={machine.name}
                      width={300}
                      height={300}
                      className="rounded-lg"
                    />
                  <h3 className="mt-4 font-semibold">{machine.name}</h3>
                  <p className="text-sm text-gray-600">{machine.description}</p>
                </div>
              ) : (
                <p className="text-gray-500">No machine selected</p>
              )}
            </div>
          </div>

          {/* Component Graph */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Component Graph</h2>
            <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
              <p className="text-gray-500">Select a machine to view components</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
