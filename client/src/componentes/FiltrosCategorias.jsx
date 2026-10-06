import { useState } from 'react'
import Boton from './Boton'
import CampoEntrada from './CampoEntrada'

const FiltrosCategorias = ({ alAplicar, alLimpiar, hayFiltros }) => {
  const [buscar, setBuscar] = useState('')
  const [activo, setActivo] = useState('')

  const manejarEnvio = (evento) => {
    evento.preventDefault()
    const filtros = {}
    if (buscar.trim()) filtros.buscar = buscar.trim()
    if (activo !== '') filtros.activo = activo === 'true'
    alAplicar(filtros)
  }

  const limpiar = () => {
    setBuscar('')
    setActivo('')
    alLimpiar()
  }

  return (
    <form
      onSubmit={manejarEnvio}
      className="rounded-lg border border-borde bg-superficie p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.6fr_0.9fr_auto] lg:items-end">
        <CampoEntrada
          id="filtro-categoria-buscar"
          etiqueta="Nombre"
          tipo="search"
          valor={buscar}
          alCambiar={setBuscar}
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filtro-categoria-estado"
            className="text-sm font-medium text-tinta"
          >
            Estado
          </label>
          <select
            id="filtro-categoria-estado"
            value={activo}
            onChange={(evento) => setActivo(evento.target.value)}
            className="h-11 w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors duration-150 hover:border-borde-fuerte"
          >
            <option value="">Todas</option>
            <option value="true">Activas</option>
            <option value="false">Inactivas</option>
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

export default FiltrosCategorias
