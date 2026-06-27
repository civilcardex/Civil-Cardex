import React from 'react';

interface EditButtonProps {
  edit: boolean;
  setEdit: React.Dispatch<React.SetStateAction<boolean>>;
}

const BASE: React.CSSProperties = {
  border: '1px solid var(--acc)',
  borderRadius: 4,
  padding: '2px 6px',
  fontSize: 10,
  cursor: 'pointer',
  fontWeight: 600,
  marginLeft: 'auto',
};

export default function EditButton({ edit, setEdit }: EditButtonProps) {
  return (
    <button
      onClick={() => setEdit(prev => !prev)}
      style={edit ? { ...BASE, background: 'var(--acc)', color: '#fff' } : { ...BASE, background: 'transparent', color: 'var(--acc)' }}
    >
      {edit ? 'LISTO' : 'EDITAR'}
    </button>
  );
}