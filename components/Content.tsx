import { memo } from "react";

// We have to memoize this component to prevent re-renders every time DOM changes
const StaticHtml = memo(
  ({ html, ref }: { html: string, ref: React.Ref<HTMLDivElement> }) => {
    return (
      <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} suppressHydrationWarning />
    );
  },
  (prev, next) => prev.html === next.html
);

StaticHtml.displayName = "StaticHtml";

export default StaticHtml;