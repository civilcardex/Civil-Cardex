export interface PlanoElementLoose {
  id: string;
  type: 'ramal' | 'bajante' | 'tributario' | 'area' | 'dim' | 'text' | 'cota';
  [key: string]: any;
}

export function renameElement(elements: PlanoElementLoose[], id: string, newId: string): PlanoElementLoose[] {
  return elements.map(el => {
    if (el.id === id) return { ...el, id: newId, label: newId };
    return el;
  });
}

export function deleteElement(elements: PlanoElementLoose[], id: string): PlanoElementLoose[] {
  return elements.filter(el => el.id !== id);
}

export function findElementById(elements: PlanoElementLoose[], id: string): PlanoElementLoose | null {
  return elements.find(el => el.id === id) || null;
}
