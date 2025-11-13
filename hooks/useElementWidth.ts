import { useEffect, useState } from "react";


export function useElementWidth(ref: React.RefObject<HTMLElement | null>, trigger?: unknown) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (ref.current) {
      setWidth(ref.current.offsetWidth);
    }
  }, [ref, trigger]);

  return width;
}