import React, { useState } from 'react'
import Navbar from '../components/Navbar'
import { docData } from './docs/docData'
import SectionAccordion from './docs/SectionAccordion'
import { usePageMeta } from '../hooks/usePageMeta'

function DocsPage() {
  const [activeCat, setActiveCat] = useState('hidraulica')
  const [search, setSearch] = useState('')
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  usePageMeta('Documentación', 'Guía completa de CivilCore. Normas NTC 1500, RAS 2000, NTC 3728. Tutoriales de diseño hidrosanitario y estructural.');

  const categories = Object.entries(docData).map(([id, data]: [string, any]) => ({
    id,
    ...data,
    sections: data.sections.map((s: any) => ({
      ...s,
      categoryColor: data.color,
      categoryName: data.name,
      categoryId: id,
    }))
  }))
  const activeCategory = categories.find((c) => c.id === activeCat)

  const allSections = categories.flatMap(c => c.sections)

  const toggleSection = (sectionKey: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }))
  }

  const filteredSections =
    search.trim() === ''
      ? activeCategory?.sections || []
      : allSections.filter((s) => {
          const str = JSON.stringify(s.body.props.children)
          return (
            s.title.toLowerCase().includes(search.toLowerCase()) ||
            (str && str.toLowerCase().includes(search.toLowerCase()))
          )
        })

  return (
    <div className="min-h-screen bg-surface-bg flex flex-col">
      <Navbar />
      <div className="flex gap-4 h-[calc(100vh-64px)] pt-16">
      <style>{`
        [data-section-color] .text-primary,
        [data-section-color] .\\!text-primary {
          color: var(--section-color) !important;
        }
        .docs-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .docs-scroll::-webkit-scrollbar-track {
          background: #1a1c20;
        }
        .docs-scroll::-webkit-scrollbar-thumb {
          background: #3a494a;
          border-radius: 3px;
        }
        .docs-scroll::-webkit-scrollbar-thumb:hover {
          background: #4d8ff7;
        }
      `}</style>
      <div className="w-64 shrink-0 border border-outline-variant bg-surface-container flex flex-col">
        <div className="p-4 border-b border-outline-variant">
          <h2 className="text-[11px] font-bold tracking-widest uppercase text-on-surface-variant">
            Categorías
          </h2>
        </div>
        <div className="flex-1 overflow-auto docs-scroll">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCat(cat.id)
                setOpenSections({})
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                activeCat === cat.id
                  ? 'bg-surface-container-high border-l-2 text-on-surface'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
              style={{
                borderLeftColor: activeCat === cat.id ? cat.color : 'transparent',
              }}
            >
              <span className="material-symbols-outlined text-[20px]" style={{ color: cat.color }}>
                {cat.icon}
              </span>
              <span className="text-[13px] font-medium">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4 flex items-center gap-4">
          <span className="material-symbols-outlined text-3xl" style={{ color: search.trim() ? '#e9feff' : activeCategory?.color }}>
            {search.trim() ? 'search' : activeCategory?.icon}
          </span>
          <div className="flex-1">
            <h1 className="text-headline-sm font-bold text-on-surface">
              {search.trim() ? 'Resultados de búsqueda' : activeCategory?.name}
            </h1>
          </div>
          <div className="w-72">
            <div className="flex items-center border border-outline-variant bg-surface-container px-3">
              <span className="material-symbols-outlined text-on-surface-variant text-lg">search</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="flex-1 h-10 px-3 bg-transparent text-on-surface text-[13px] font-mono focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto space-y-2 pr-1 docs-scroll">
          {filteredSections.map((section: any) => {
            const sectionKey = `${section.categoryId}:${section.title}`
            return (
              <div key={sectionKey}>
              <SectionAccordion
                section={section}
                sectionKey={sectionKey}
                isOpen={openSections[sectionKey]}
                onToggle={toggleSection}
                showCategory={search.trim() !== ''}
              />
              </div>
            )
          })}
          {filteredSections.length === 0 && (
            <div className="text-center text-on-surface-variant text-[13px] py-12">
              No se encontraron resultados
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  )
}

export default DocsPage
