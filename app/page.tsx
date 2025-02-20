"use client";
import { useState } from "react";
import { Machine } from "./types/machines";
import { MachineGraph } from './components/MachineGraph';

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
    <div className="fixed inset-0 overflow-hidden bg-gray-50">
      {/* Floating search box */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 w-full max-w-xl px-4">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={machineName}
            onChange={(e) => setMachineName(e.target.value)}
            placeholder="Enter machine name..."
            className="w-full p-4 rounded-xl shadow-lg bg-white/90 backdrop-blur border border-gray-100 pr-24
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-500 text-white px-4 py-2 rounded-lg
                     hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
          >
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </form>
        {error && (
          <div className="mt-2 text-red-500 text-center bg-white/90 backdrop-blur rounded-lg p-2 shadow-lg">
            {error}
          </div>
        )}
      </div>

      {/* Full-screen graph */}
      <div className="absolute inset-0">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-500">Generating machine data...</p>
            </div>
          </div>
        ) : (
          <MachineGraph machine={machine} />
        )}
      </div>
    </div>
  );
}
