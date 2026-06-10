import React, { type ReactNode } from 'react'

interface SectionCardProps {
  title: string
  subtitle?: string
  children?: ReactNode
  scroll?: boolean
  span?: number
  maxWidth?: string
  compact?: boolean
}

export default function SectionCard({ title, subtitle, children, scroll, span = 1, maxWidth, compact = false }: SectionCardProps) {
  return (
    <div className="card" style={{ gridColumn: `span ${span}`, display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: compact ? 'none' : '100%', width: '100%', maxWidth: maxWidth || 'none', alignSelf: compact ? 'start' : 'stretch', boxShadow: '0 1px 0 var(--line)' }}>
      <div className="card-h" style={{ padding: '6px 12px' }}>
        <span className="card-t" style={{ fontSize: 12, textTransform: 'uppercase' }}>{title}</span>
        {subtitle && <span className="card-s" style={{ fontSize: 10 }}>{subtitle}</span>}
      </div>
      <div className="card-b" style={{ padding: 0, overflow: scroll ? 'auto' : 'visible', flex: compact ? 0 : 1, minHeight: 0 }}>
        {children}
      </div>
    </div>
  )
}
