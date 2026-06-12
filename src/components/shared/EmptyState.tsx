import React from 'react';

interface EmptyStateProps {
  message: string;
  icon?: string;
}

const EmptyState = React.memo(function EmptyState({ message, icon = '\u{1F4CB}' }: EmptyStateProps) {
  return (
    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--txt3)', fontSize: 11 }}>
      <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
      {message}
    </div>
  );
});

export default EmptyState;
