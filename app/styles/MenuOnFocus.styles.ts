import { useMobile } from "../hooks";

export default function useMenuOnFocusStyles(textareaFocus: boolean) {
  return {
    menuContainer: {
      position: 'fixed' as const,
      zIndex: 100,
      display: 'flex',
      boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.1)',
      borderRadius: '0.75rem',
      background: 'linear-gradient(to bottom right, white, #f9fafb)',
      border: '1px solid #e5e7eb',
      backdropFilter: 'blur(4px)',
    },

    deleteButton: {
      cursor: 'pointer',
      borderRadius: '0.5rem',
      transition: 'all 0.2s',
      color: '#4b5563',
      fontWeight: 500,
      fontSize: '1rem',
      padding: '0.5rem 0.75rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      backgroundColor: '#fef2f2',
      border: '1px solid #fca5a5'
    },

    changeStyleButton: {
      cursor: 'pointer',
      borderRadius: '0.5rem',
      transition: 'all 0.2s',
      color: '#4b5563',
      fontWeight: 500,
      fontSize: '1rem',
      padding: '0.5rem 0.75rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      backgroundColor: '#eff6ff',
      border: '1px solid #bfdbfe'
    },

    commentButton: {
      cursor: 'pointer',
      borderRadius: '0.5rem',
      transition: 'all 0.2s',
      color: '#4b5563',
      fontWeight: 500,
      fontSize: '1rem',
      padding: '0.5rem 0.75rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      backgroundColor: '#f9fafb',
      border: '1px solid #e5e7eb'
    },

    commentInputContainer: {
      position: 'fixed',
      zIndex: 100,
      boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.1)',
      borderRadius: '0.75rem',
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      backdropFilter: 'blur(4px)',
      padding: '0.75rem',
      margin: '0 0.5rem'
    },

    commentTextarea: {
      width: '16rem',
      height: '5rem',
      padding: '0.5rem',
      fontSize: '0.875rem',
      border: textareaFocus ? '1px solid transparent' : '1px solid #d1d5db',
      borderRadius: '0.375rem',
      resize: 'none',
      outline: 'none',
      boxShadow: textareaFocus ? '0 0 0 2px #3b82f6' : undefined
    }
  }
}

