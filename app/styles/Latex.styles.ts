const latexStyles = {
  container: (style?: React.CSSProperties, shouldTruncate?: boolean): React.CSSProperties => ({
    ...style,
    display: 'inline-block', // Added to ensure the span respects width and height
    overflow: shouldTruncate ? 'hidden' : undefined,
    whiteSpace: shouldTruncate ? 'nowrap' : undefined,
    textOverflow: shouldTruncate ? 'ellipsis' : undefined,
    maxWidth: '100%'
  })
};

export default latexStyles;