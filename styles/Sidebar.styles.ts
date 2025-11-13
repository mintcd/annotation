interface ViewportInfo {
  layoutHeight: number;
  offsetTop: number;
  visualHeight: number;
  visualWidth: number;
  offsetLeft: number;
  layoutWidth?: number;
}

const sidebarStyles = {
  toggleButton: (isMobile: boolean, isIOS: boolean, viewportInfo: ViewportInfo): React.CSSProperties => ({
    position: 'fixed' as const,
    zIndex: 9999,
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.1)',
    backgroundColor: '#F3F4F6',
    padding: '0.75rem',
    borderRadius: '9999px',
    margin: isMobile && isIOS ? 0 : '1rem',
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(4px)',
    bottom: isMobile && isIOS ? '1rem' : (isMobile ? viewportInfo.layoutHeight - viewportInfo.offsetTop - viewportInfo.visualHeight : 0),
    right: isMobile ? viewportInfo.layoutWidth! - viewportInfo.offsetLeft - viewportInfo.visualWidth : 0 as number,
  }),

  sidebarContainer: (isMobile: boolean, viewportInfo: ViewportInfo, width: number): React.CSSProperties => ({
    position: 'fixed' as const,
    background: 'linear-gradient(to bottom right, white, #F9FAFB)',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    backdropFilter: 'blur(4px)',
    zIndex: 9999,
    borderRadius: '0.75rem',
    ...(isMobile ? {
      borderTop: '1px solid',
      width: '100vw',
      maxWidth: 'none',
      height: viewportInfo.visualHeight / 2,
      bottom: viewportInfo.layoutHeight - viewportInfo.offsetTop - viewportInfo.visualHeight,
      left: 0,
      touchAction: 'none',
    } : {
      top: 0,
      right: 0,
      height: '100vh',
      borderLeft: '1px solid',
      maxWidth: '90vw',
      width: width,
    })
  }),

  searchContainer: {
    padding: '0.5rem 0.75rem',
    margin: '0 0.5rem'
  },

  headerSection: {
    borderBottom: '1px solid #e5e7eb',
    padding: '0.5rem 0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },

  statsContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem'
  },

  statsText: {
    fontSize: '0.75rem',
    color: '#6b7280'
  },

  syncContainer: {
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem'
  },

  syncingText: {
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem'
  },

  syncedText: {
    color: '#10b981',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem'
  },

  syncButton: (buttonHover: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    color: buttonHover ? '#1d4ed8' : '#2563eb',
    fontSize: '0.75rem',
    transition: 'all 0.2s'
  }),

  resizeHandle: {
    position: 'absolute' as const,
    top: 0,
    height: '100%',
    cursor: 'col-resize',
    width: 16,
    left: 0,
    zIndex: 30,
    touchAction: 'none'
  }
};

export default sidebarStyles;