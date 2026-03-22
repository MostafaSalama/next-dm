import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";

export function useTauriCommand<TArgs, TResult>(command: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (args?: TArgs): Promise<TResult | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<TResult>(command, args as Record<string, unknown>);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [command],
  );

  return { execute, loading, error };
}
