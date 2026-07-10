
import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { usePageMeta } from '../hooks/usePageMeta'

const ProfilePage_proyectosActivos = [
  { id: 1, codigo: 'CR-97', nombre: 'Casa de Roca No. 97 - Redes Sanitarias y Lluvias', progreso: 100, estado: 'completo' },
  { id: 2, codigo: 'AF-AC-01', nombre: 'Red Hidráulica AF y AC - Casa Roca 97', progreso: 98, estado: 'completo' },
  { id: 3, codigo: 'CR-98', nombre: 'Casa de Roca No. 98 - Redes Sanitarias', progreso: 65, estado: 'activo' },
  { id: 4, codigo: 'TOR-01', nombre: 'Torre Residencial - Hidroneumático y bombas', progreso: 80, estado: 'revision' },
]

const ProfilePage_estadoConfig: Record<string, { color: string; label: string }> = {
  completo: { color: 'bg-secondary text-on-secondary-container', label: 'COMPLETO' },
  revision: { color: 'bg-tertiary text-on-tertiary-container', label: 'EN REVISIÓN' },
  activo: { color: 'bg-primary text-on-primary-container', label: 'ACTIVO' },
}

const ProfilePage_campos = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'apellido', label: 'Apellido' },
  { key: 'email', label: 'Correo Electrónico', readonly: true },
  { key: 'profesion', label: 'Profesión' },
  { key: 'matricula', label: 'Matrícula Profesional' },
  { key: 'telefono', label: 'Teléfono' },
]

function ProfilePage() {
  const [perfil, setPerfil] = useState({
    nombre: '',
    apellido: '',
    profesion: '',
    matricula: '',
    telefono: '',
    email: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [proyectosOpen, setProyectosOpen] = useState(false);
  const userIdRef = useRef<string | null>(null);

  const proyectosActivos = ProfilePage_proyectosActivos

  const navigate = useNavigate()

  const estadoConfig = ProfilePage_estadoConfig

  async function fetchPerfil() {
    if (!supabase) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userIdRef.current = user.id

      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) { if (import.meta.env.DEV) console.error('Error cargando perfil:', error.message); return }
      if (data) {
        setPerfil({
          nombre: data.nombre || '',
          apellido: data.apellido || '',
          profesion: data.profesion || '',
          matricula: data.matricula || '',
          telefono: data.telefono || '',
          email: data.email || '',
        })
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  usePageMeta('Perfil', 'Gestione su perfil de CivilCore: datos personales, proyectos activos y configuración de cuenta de ingeniería.');
  // fetchPerfil is async and only calls setState after awaiting Supabase — standard
  // fetch-on-mount, not a synchronous cascading update.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchPerfil() }, [])

  function handleEditStart(field: string) {
    setEditField(field)
    setEditValue((perfil as Record<string, string>)[field] || '')
  }

  function handleEditCancel() {
    setEditField(null)
    setEditValue('')
  }

  async function handleEditSave(field: string) {
    if (editValue === (perfil as Record<string, string>)[field]) { handleEditCancel(); return }
    setSaving(field)
    try {
      const { error } = await supabase
        .from('perfiles')
        .update({ [field]: editValue })
        .eq('id', userIdRef.current)
      if (error) { if (import.meta.env.DEV) console.error('Error guardando:', error.message); return }
      setPerfil(prev => ({ ...prev, [field]: editValue }))
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error:', err)
    } finally {
      setSaving(null)
      setEditField(null)
      setEditValue('')
    }
  }

  function handleEditKeyDown(e: React.KeyboardEvent, field: string) {
    if (e.key === 'Enter') handleEditSave(field)
    if (e.key === 'Escape') handleEditCancel()
  }

  const nombreCompleto = [perfil.nombre, perfil.apellido].filter(Boolean).join(' ')

  const campos = ProfilePage_campos

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-on-surface-variant text-sm">Cargando perfil...</span>
      </div>
    )
  }

  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    'name': nombreCompleto || 'Usuario',
    'jobTitle': perfil.profesion || undefined,
    'identifier': perfil.matricula || undefined,
    'telephone': perfil.telefono || undefined,
    'email': perfil.email || undefined
  };

  return (
    <div className="space-y-6">
      <script type="application/ld+json">{JSON.stringify(personJsonLd)}</script>
      <Navbar />
      <header className="border border-outline-variant bg-surface-container p-6 flex items-start gap-6">
        <div className="w-20 h-20 border-2 border-primary bg-surface-container flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-4xl text-primary">person</span>
        </div>
        <div className="flex-1">
          <h1 className="text-headline-md font-bold text-on-surface">{nombreCompleto || 'Sin nombre'}</h1>
          <p className="text-body-md text-on-surface-variant mt-1">{perfil.profesion || 'Profesión no definida'}</p>
          {perfil.matricula && (
            <div className="flex items-center gap-2 mt-3">
              <span className="px-2 py-1 text-[11px] font-bold tracking-wider uppercase bg-secondary text-on-secondary-container border border-outline-variant">
                {perfil.matricula}
              </span>
            </div>
          )}
        </div>
      </header>

      <section aria-labelledby="info-personal-heading" className="border border-outline-variant bg-surface-container p-6">
        <h2 id="info-personal-heading" className="text-[11px] font-bold tracking-widest uppercase text-on-surface-variant mb-4">
          Información Personal
        </h2>
  <ul role="list" className="grid grid-cols-2 gap-4" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
    {campos.map(({ key, label, readonly }) => (
      <li key={key} className="border-l-2 border-primary pl-3 py-2 group">
        <span className="text-[11px] font-bold tracking-widest uppercase text-on-surface-variant block mb-1">
          {label}
        </span>
        {editField === key ? (
          <div className="flex items-center gap-2">
            <input
              type={key === 'email' ? 'email' : 'text'}
              value={editValue}
              aria-label={label}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => handleEditKeyDown(e, key)}
              autoFocus
              className="flex-1 h-8 px-2 border text-sm bg-surface-container-low text-on-surface focus:outline-none"
              style={{ borderColor: 'var(--primary)', fontFamily: 'var(--mono)' }}
            />
            <button type="button"
              onClick={() => handleEditSave(key)}
              disabled={saving === key}
              className="h-8 w-8 flex items-center justify-center bg-primary text-on-primary text-sm"
            >✓</button>
            <button type="button"
              onClick={handleEditCancel}
              className="h-8 w-8 flex items-center justify-center border border-outline-variant text-on-surface-variant text-sm hover:text-error"
            >✕</button>
          </div>
        ) : readonly ? (
          <span className="text-[13px] text-on-surface font-medium">{(perfil as Record<string, string>)[key]}</span>
        ) : (
          <button
            type="button"
            className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors bg-transparent border-0 p-0 text-left font-inherit"
            onClick={() => handleEditStart(key)}
          >
            <span className="text-[13px] text-on-surface font-medium">
              {(perfil as Record<string, string>)[key] || <span className="text-on-surface-variant italic opacity-50">Click para editar</span>}
            </span>
            <span className="material-symbols-outlined text-xs text-on-surface-variant opacity-0 group-hover:opacity-60 transition-opacity">edit</span>
          </button>
        )}
      </li>
    ))}
  </ul>
      </section>

      <section aria-labelledby="proyectos-heading" className="border border-outline-variant bg-surface-container">
        <button type="button"
          onClick={() => setProyectosOpen(prev => !prev)}
          aria-expanded={proyectosOpen}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-surface-container-low transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-xl">folder_open</span>
            <div>
              <h2 id="proyectos-heading" className="text-[11px] font-bold tracking-widest uppercase text-on-surface-variant">
                Proyectos Activos
              </h2>
              <span className="text-[13px] text-on-surface font-medium">{proyectosActivos.length} proyectos</span>
            </div>
          </div>
          <span className={`material-symbols-outlined text-on-surface-variant transition-transform ${proyectosOpen ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </button>

        {proyectosOpen && (
          <div className="border-t border-outline-variant">
            <div className="px-6 py-3 border-b border-outline-variant bg-surface-container-low">
              <button type="button"
                className="flex items-center gap-2 text-primary hover:text-primary-fixed text-[13px] font-medium transition-colors"
                onClick={() => navigate('/civilflowareatrabajo')}
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                Nuevo Proyecto
              </button>
            </div>

            <ul className="divide-y divide-outline-variant" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {proyectosActivos.map((proy) => {
                const e = estadoConfig[proy.estado] || estadoConfig.activo
                return (
                  <li key={proy.id} className="px-6 py-3 flex items-center gap-4 hover:bg-surface-container-low transition-colors cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-bold font-mono text-on-surface">{proy.codigo}</span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase ${e.color}`}>
                          {e.label}
                        </span>
                      </div>
                      <p className="text-[12px] text-on-surface-variant truncate">{proy.nombre}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-20">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-on-surface-variant">{proy.progreso}%</span>
                        </div>
                        <div className="h-1 bg-surface-container-low border border-outline-variant">
                          <div className="h-full bg-primary transition-all" style={{ width: `${proy.progreso}%` }} />
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant text-lg">arrow_forward</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>

      <div className="border border-outline-variant bg-surface-container p-6 flex justify-end">
        <button type="button"
          onClick={async () => {
            if (!supabase) return
            await supabase.auth.signOut()
            navigate('/')
          }}
          className="px-5 py-2 text-xs font-bold tracking-widest uppercase border border-error text-error hover:bg-error hover:text-on-error transition-all"
          style={{ fontFamily: 'Geist, monospace' }}
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  )
}

export default ProfilePage
