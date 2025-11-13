const dropdownStyles = {
  container: {
    position: 'relative' as const
  },

  button: (buttonHover: boolean, buttonFocus: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    borderRadius: '0.375rem',
    padding: '0.25rem 0.5rem',
    fontSize: '0.875rem',
    outline: 'none',
    backgroundColor: buttonHover ? '#f9fafb' : undefined,
    boxShadow: buttonFocus ? '0 0 0 2px #3b82f6' : undefined
  }),

  menu: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    marginTop: '0.25rem',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '0.375rem',
    zIndex: 10000,
    width: 'max-content'
  },

  menuItem: (isHovered: boolean, isFocused: boolean): React.CSSProperties => ({
    textAlign: 'left',
    padding: '0.5rem',
    fontSize: '0.75rem',
    backgroundColor: (isHovered || isFocused) ? '#f3f4f6' : undefined,
    outline: isFocused ? 'none' : undefined
  })
};

export default dropdownStyles;