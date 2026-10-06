import { useState } from 'react'
import Alerta from './Alerta'
import Boton from './Boton'
import CampoEntrada from './CampoEntrada'
import { useSucursales } from '../hooks/useSucursales'

const claseSelect =
  'h-11 w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors duration-150 hover:border-borde-fuerte'

const FiltrosClientes = ({ alAplicar, alLimpiar, hayFiltros }) => {
  const {
    datos: sucursales,
    cargando: cargandoSucursales,
    error: errorSucursales,
    recargar: recargarSucursales,
  } = useSucursales({}, { porPaginaInicial: 100 })

  const [sucursalId, setSucursalId] = useState('')
  const [estado, setEstado] = useState('')
  const [buscar, setBuscar] = useState('')

  const construir = () => {
    const filtros = {}
    if (sucursalId !== '') filtros.sucursal_id = Number(sucursalId)
    if (estado !== '') filtros.activo = estado === 'true'
    if (buscar.trim()) filtros.buscar = buscar.trim()
    return filtros
  }

  const manejarEnvio = (evento) => {
    evento.preventDefault()
    alAplicar(construir())
  }

  const limpiar = () => {
    setSucursalId('')
    setEstado('')
    setBuscar('')
    alLimpiar()
  }

  return (
    <form
      onSubmit={manejarEnvio}
      className="rounded-lg border border-borde bg-superficie p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.2fr_0.9fr_1.4fr_auto] xl:items-end">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="clientes-sucursal"
            className="text-sm font-medium text-tinta"
          >
            Sucursal
          </label>
          <select
            id="clientes-sucursal"
            value={sucursalId}
            onChange={(evento) => setSucursalId(evento.target.value)}
            disabled={cargandoSucursales}
            className={claseSelect}
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
            htmlFor="clientes-estado"
            className="text-sm font-medium text-tinta"
          >
            Estado
          </label>
          <select
            id="clientes-estado"
            value={estado}
            onChange={(evento) => setEstado(evento.target.value)}
            className={claseSelect}
          >
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>

        <CampoEntrada
          id="clientes-buscar"
          etiqueta="Buscar"
          tipo="search"
          valor={buscar}
          alCambiar={setBuscar}
          ayuda="Nombre o documento"
        />

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

      {errorSucursales && (
        <div className="mt-3 flex flex-col items-start gap-3">
          <Alerta variante="error" className="w-full">
            {errorSucursales}
          </Alerta>
          <Boton variante="secundario" onClick={recargarSucursales}>
            Reintentar sucursales
          </Boton>
        </div>
      )}
    </form>
  )
}

export default FiltrosClientes
