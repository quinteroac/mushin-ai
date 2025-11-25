"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Memory = {
  id: string;
  content: string;
  created_at: string;
};

export default function VaultPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Parse search params
  const query = searchParams.get("q") || "";
  
  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/memories");
      if (!response.ok) throw new Error("Failed to fetch memories");
      const data = await response.json();
      setMemories(data);
    } catch (error) {
      toast.error("Could not load memories");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this memory?")) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/memories/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      
      setMemories(memories.filter((m) => m.id !== id));
      toast.success("Memory deleted");
    } catch (error) {
      toast.error("Failed to delete memory");
    }
  };

  // Client-side filtering based on query
  const filteredMemories = memories.filter((m) => {
    if (!query) return true;
    
    const lowerQuery = query.toLowerCase();
    
    // Date filter: date:YYYY-MM-DD
    if (lowerQuery.startsWith("date:")) {
      const dateTarget = lowerQuery.split(":")[1];
      return m.created_at.startsWith(dateTarget);
    }
    
    // Content filter
    return m.content.toLowerCase().includes(lowerQuery);
  });

  return (
    <div className="min-h-screen bg-background p-8 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-black/5 rounded-full transition-colors">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-2xl font-bold">The Vault</h1>
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredMemories.length} memories found
          </div>
        </div>

        {/* Search Context */}
        {query && (
          <div className="bg-indigo-500/10 text-indigo-500 px-4 py-2 rounded-lg text-sm inline-block self-start">
            Filtering by: <span className="font-mono font-bold">{query}</span>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Loading vault...</div>
        ) : (
          <div className="border border-black/10 dark:border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/5 dark:bg-white/5">
                <tr>
                  <th className="p-4 font-medium text-muted-foreground w-48">Date</th>
                  <th className="p-4 font-medium text-muted-foreground">Content</th>
                  <th className="p-4 font-medium text-muted-foreground w-20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {filteredMemories.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-muted-foreground">
                      No memories found in the vault.
                    </td>
                  </tr>
                ) : (
                  filteredMemories.map((memory) => (
                    <tr key={memory.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors group">
                      <td className="p-4 font-mono text-xs text-muted-foreground align-top">
                        {new Date(memory.created_at).toLocaleString()}
                      </td>
                      <td className="p-4 align-top whitespace-pre-wrap">
                        {memory.content}
                      </td>
                      <td className="p-4 text-right align-top">
                        <button
                          onClick={() => handleDelete(memory.id)}
                          className="p-2 text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete memory"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

