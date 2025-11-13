const commentEditorStyles = {
  container: {
    marginTop: '0.75rem',
    padding: '0.75rem 0.75rem 0.75rem',
    borderTop: '1px solid #f3f4f6'
  },

  relativeContainer: {
    position: 'relative' as const
  },

  textarea: (isFocused: boolean): React.CSSProperties => ({
    width: '100%',
    borderRadius: '0.75rem',
    border: isFocused ? '2px solid #60a5fa' : '2px solid #bfdbfe',
    background: 'linear-gradient(to bottom right, #eff6ff, white)',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    outline: 'none',
    resize: 'none' as const,
    boxShadow: isFocused ? '0 0 0 2px #60a5fa, 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)' : '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
    transition: 'all 0.3s'
  }),

  helperText: {
    position: 'absolute' as const,
    bottom: '0.5rem',
    right: '0.5rem',
    fontSize: '0.75rem',
    color: '#9ca3af',
    backgroundColor: 'rgba(255,255,255,0.8)',
    padding: '0.25rem 0.5rem',
    borderRadius: '0.375rem'
  }
};

export default commentEditorStyles;