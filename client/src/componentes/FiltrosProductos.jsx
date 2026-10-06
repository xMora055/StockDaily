import { useState } from 'react'
import Boton from './Boton'
import CampoEntrada from './CampoEntrada'

const FiltrosProductos = ({
  categorias = [],
  alAplicar,
  alLimpiar,
  hayFiltros,
}) => {
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [activo, setActivo] = useState('')

  const manejarEnvio = (evento) => {
    evento.preventDefault()
    const filtros = {}
    if (nombre.trim()) filtros.nombre = nombre.trim()
    if (codigo.trim()) filtros.codigo = codigo.trim()
    if (categoriaId !== '') filtros.categoria_id = Number(categoriaId)
    if (activo !== '') filtros.activo = activo === 'true'
    alAplicar(filtros)
  }

  const limpiar = () => {
    setNombre('')
    setCodigo('')
    setCategoriaId('')
    setActivo('')
    alLimpiar()
  }

  return (
    <form
      onSubmit={manejarEnvio}
      className="rounded-lg border border-borde bg-superficie p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_0.9fr_auto] lg:items-end">
        <CampoEntrada
          id="filtro-nombre"
          etiqueta="Nombre"
          valor={nombre}
          alCambiar={setNombre}
        />
        <CampoEntrada
          id="filtro-codigo"
          etiqueta="Código"
          valor={codigo}
          alCambiar={setCodigo}
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filtro-categoria"
            className="text-sm font-medium text-tinta"
          >
            Categoría
          </label>
          <select
            id="filtro-categoria"
            value={categoriaId}
            onChange={(evento) => setCategoriaId(evento.target.value)}
            className="h-11 w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors duration-150 hover:border-borde-fuerte"
          >
            <option value="">Todas</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filtro-activo"
            className="text-sm font-medium text-tinta"
          >
            Estado
          </label>
          <select
            id="filtro-activo"
            value={activo}
            onChange={(evento) => setActivo(evento.target.value)}
            className="h-11 w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors duration-150 hover:border-borde-fuerte"
          >
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>

        <div className="flex items-end gap-2">
          <Boton
            tipo="submit"
            variante="secundario"
            className="w-full px-3 sm:w-auto"
          >
            Aplicar
          </Boton>
          {hayFiltros && (
            <Boton
              tipo="button"
              variante="sutil"
              className="px-3"
              onClick={limpiar}
            >
              Limpiar
            </Boton>
          )}
        </div>
      </div>
    </form>
  )
}

export default FiltrosProductos
