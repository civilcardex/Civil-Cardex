import React, { type ReactNode } from 'react'

export function FormatText({ children }: { children?: ReactNode }) {
  return (
    <div className="bg-surface-bg border border-outline-variant rounded px-4 py-3 font-mono text-[13px] text-primary tracking-wide my-2 leading-relaxed">
      {children}
    </div>
  )
}

export function TableWrapper({ children }: { children?: ReactNode }) {
  return (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-[12px] font-mono border-collapse">
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function TableHeader({ children }: { children?: ReactNode }) {
  return (
    <th className="text-left px-3 py-1.5 bg-surface-container-high text-on-surface-variant font-semibold border border-outline-variant whitespace-nowrap">
      {children}
    </th>
  )
}

export function TableCell({ children }: { children?: ReactNode }) {
  return (
    <td className="px-3 py-1.5 border border-outline-variant text-on-surface whitespace-nowrap">
      {children}
    </td>
  )
}

export function TableRow({ children }: { children?: ReactNode }) {
  return <tr>{children}</tr>
}

interface SectionAccordionProps {
  section: {
    title: string
    body: ReactNode
    categoryColor?: string
    categoryName?: string
  }
  sectionKey: string
  isOpen: boolean
  onToggle: (key: string) => void
  showCategory: boolean
}

export default function SectionAccordion({ section, sectionKey, isOpen, onToggle, showCategory }: SectionAccordionProps) {
  return (
    <div
      className="border border-outline-variant rounded overflow-hidden bg-surface-container"
      data-section-color
      style={{ '--section-color': section.categoryColor } as React.CSSProperties}
    >
      <button
        onClick={() => onToggle(sectionKey)}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-high"
      >
        <span className={`material-symbols-outlined text-lg transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
          chevron_right
        </span>
        <span className="text-[13px] font-semibold text-on-surface">{section.title}</span>
        {showCategory && (
          <span className="text-[10px] px-2 py-0.5 rounded font-mono" style={{ color: section.categoryColor, border: '1px solid var(--section-color)' }}>
            {section.categoryName}
          </span>
        )}
        <span className="ml-auto material-symbols-outlined text-on-surface-variant text-sm">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-outline-variant animate-fade-in">
          {section.body}
        </div>
      )}
    </div>
  )
}
