import { useEffect } from "react";

export function useHotkey(keyCondition: (e: KeyboardEvent) => boolean, callback: (e: KeyboardEvent) => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (keyCondition(e)) {
        e.preventDefault();
        callback(e);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [keyCondition, callback]);
}