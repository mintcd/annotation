const promptBoxStyles = {
  backdrop: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },

  overlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)'
  },

  modal: {
    position: 'fixed' as const,
    top: '50dvh',
    left: '50dvw',
    transform: 'translate(-50%, -50%)',
    width: '100%',
    maxWidth: 'calc(100dvw - 1rem)',
    borderRadius: '0.5rem',
    backgroundColor: 'white',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
    border: '1px solid rgba(0,0,0,0.1)'
  },

  content: {
    padding: '1rem'
  },

  message: {
    fontSize: '0.875rem',
    color: '#374151'
  },

  actions: {
    marginTop: '1rem',
    display: 'flex',
    gap: '0.5rem'
  },

  buttonVariant: (variant?: 'primary' | 'secondary' | 'destructive' | 'neutral'): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      borderRadius: '0.25rem',
      padding: '0.5rem 0.75rem',
      fontSize: '0.875rem',
      fontWeight: 500,
      outline: 'none',
      border: 'none',
      cursor: 'pointer',
    };
    switch (variant) {
      case 'primary':
        return {
          ...base,
          backgroundColor: '#2563EB',
          color: 'white',
        };
      case 'destructive':
        return {
          ...base,
          backgroundColor: '#DC2626',
          color: 'white',
        };
      case 'secondary':
        return {
          ...base,
          border: '1px solid #D1D5DB',
          backgroundColor: 'white',
          color: '#374151',
        };
      default:
        return {
          ...base,
          color: '#6B7280',
        };
    }
  }
};

export default promptBoxStyles;