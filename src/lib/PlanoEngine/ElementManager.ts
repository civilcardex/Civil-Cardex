export interface PlanoElement {
  id: string;
  type: 'ramal' | 'bajante' | 'tributario' | 'area' | 'dim' | 'text' | 'cota';
  [key: string]: any;
}

export function renameElement(elements: PlanoElement[], id: string, newId: string): PlanoElement[] {
  return elements.map(el => {
    if (el.id === id) return { ...el, id: newId, label: newId };
    return el;
  });
}

export function deleteElement(elements: PlanoElement[], id: string): PlanoElement[] {
  return elements.filter(el => el.id !== id);
}

export function findElementById(elements: PlanoElement[], id: string): PlanoElement | null {
  return elements.find(el => el.id === id) || null;
}
