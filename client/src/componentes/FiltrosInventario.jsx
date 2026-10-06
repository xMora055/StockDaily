import { useState } from 'react'
import Boton from './Boton'

const FiltrosInventario = ({
  sucursales,
  alAplicar,
  alLimpiar,
  hayFiltros,
}) => {
  const [sucursalId, setSucursalId] = useState('')
  const [buscar, setBuscar] = useState('')
  const [soloFaltantes, setSoloFaltantes] = useState(false)

  const construir = (sobreescritos = {}) => {
    const estado = { sucursalId, buscar, soloFaltantes, ...sobreescritos }
    const filtros = {}

    if (estado.sucursalId !== '') {
      filtros.sucursal_id = Number(estado.sucursalId)
    }
    if (estado.buscar.trim()) filtros.buscar = estado.buscar.trim()
    if (estado.soloFaltantes) filtros.solo_faltantes = true

    return filtros
  }

  const manejarEnvio = (evento) => {
    evento.preventDefault()
    alAplicar(construir())
  }

  const alternarFaltantes = (evento) => {
    const marcado = evento.target.checked
    setSoloFaltantes(marcado)
    alAplicar(construir({ soloFaltantes: marcado }))
  }

  const limpiar = () => {
    setSucursalId('')
    setBuscar('')
    setSoloFaltantes(false)
    alLimpiar()
  }

  return (
    <form
      onSubmit={manejarEnvio}
      className="rounded-lg border border-borde bg-superficie p-4"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] xl:items-end">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="inventario-sucursal"
            className="text-sm font-medium text-tinta"
          >
            Sucursal
          </label>
          <select
            id="inventario-sucursal"
            value={sucursalId}
            onChange={(evento) => setSucursalId(evento.target.value)}
            className="h-11 w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors duration-150 hover:border-borde-fuerte"
          >
            <option value="">Todas</option>
            {sucursales.map((sucursal) => (
              <option key={sucursal.id} value={sucursal.id}>
                {sucursal.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="inventario-buscar"
            className="text-sm font-medium text-tinta"
          >
            Producto
          </label>
          <input
            id="inventario-buscar"
            type="search"
            value={buscar}
            onChange={(evento) => setBuscar(evento.target.value)}
            placeholder="Nombre o código…"
            autoComplete="off"
            spellCheck="false"
            className="h-11 w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors duration-150 placeholder:text-tinta-suave/70 hover:border-borde-fuerte"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 md:col-span-2 xl:col-span-1 xl:justify-end">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-tinta">
            <input
              type="checkbox"
              checked={soloFaltantes}
              onChange={alternarFaltantes}
              className="h-5 w-5 rounded border-borde-fuerte accent-marca"
            />
            Solo faltantes
          </label>

          <div className="flex items-center gap-2">
            <Boton
              tipo="submit"
              variante="secundario"
              className="px-3 sm:px-4"
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
      </div>
    </form>
  )
}

export default FiltrosInventario
