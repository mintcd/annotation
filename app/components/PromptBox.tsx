import React from 'react';
import promptBoxStyles from '../styles/PromptBox.styles';

type Action = {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary' | 'destructive' | 'neutral';
};

type Props = {
  message: React.ReactNode;
  actions: Action[]; // usually up to 3
  onClose?: () => void;
};

export default function PromptBox({ message, actions, onClose }: Props) {
  return (
    <div style={promptBoxStyles.backdrop}>
      <div style={promptBoxStyles.overlay} onClick={onClose} />
      <div style={promptBoxStyles.modal}>
        <div style={promptBoxStyles.content}>
          <div style={promptBoxStyles.message}>{message}</div>

          <div style={promptBoxStyles.actions}>
            {actions.map((a, i) => (
              <button
                key={i}
                type="button"
                style={promptBoxStyles.buttonVariant(a.variant)}
                onClick={a.action}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
