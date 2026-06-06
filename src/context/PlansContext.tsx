import { useState, createContext, useContext } from 'react';

const PlanosContext = createContext(null);

export function PlanosProvider({ children }) {
  const [planos, setPlanos] = useState([]);
  const [error, setError] = useState(null);

  const addPlanos = (newFiles) => {
    const pdfs = [];
    for (const f of newFiles) {
      const isPdf = f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf');
      if (isPdf) pdfs.push({ id: Date.now() + Math.random(), file: f, name: f.name, nivel: null, scale: 100, status: 'pending' });
    }
    if (pdfs.length === 0 && newFiles.length > 0) {
      setError('Solo se permiten archivos PDF.');
      setTimeout(() => setError(null), 3000);
      return [];
    }
    if (pdfs.length === 0) return [];
    setPlanos(prev => [...prev, ...pdfs]);
    return pdfs;
  };

  const removePlano = (id) => {
    setPlanos(prev => prev.filter(p => p.id !== id));
  };

  const updatePlano = (id, updates) => {
    setPlanos(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const confirmPlano = (id) => {
    setPlanos(prev => prev.map(p => p.id === id && p.status === 'pending' ? { ...p, status: 'confirmed' } : p));
  };

  const getPlanoById = (id) => {
    return planos.find(p => p.id === id) || null;
  };

  return (
    <PlanosContext.Provider value={{ planos, error, setError, addPlanos, removePlano, updatePlano, confirmPlano, getPlanoById }}>
      {children}
    </PlanosContext.Provider>
  );
}

export function usePlanos() {
  const ctx = useContext(PlanosContext);
  if (!ctx) throw new Error('usePlanos debe usarse dentro de <PlanosProvider>');
  return ctx;
}
