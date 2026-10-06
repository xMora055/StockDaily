import { useState } from 'react'
import Alerta from './Alerta'
import Boton from './Boton'
import CampoEntrada from './CampoEntrada'

const claseSelect =
  'h-11 w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors duration-150 hover:border-borde-fuerte'

const FiltrosFacturas = ({
  sucursales = [],
  cargandoSucursales = false,
  errorSucursales = '',
  alReintentarSucursales,
  alAplicar,
  alLimpiar,
  hayFiltros,
}) => {
  const [sucursalId, setSucursalId] = useState('')
  const [estado, setEstado] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [buscar, setBuscar] = useState('')

  const construir = () => {
    const filtros = {}
    if (sucursalId !== '') filtros.sucursal_id = Number(sucursalId)
    if (estado !== '') filtros.estado = estado
    if (desde) filtros.desde = desde
    if (hasta) filtros.hasta = hasta
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
    setDesde('')
    setHasta('')
    setBuscar('')
    alLimpiar()
  }

  return (
    <form
      onSubmit={manejarEnvio}
      className="rounded-lg border border-borde bg-superficie p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="facturas-sucursal"
            className="text-sm font-medium text-tinta"
          >
            Sucursal
          </label>
          <select
            id="facturas-sucursal"
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
            htmlFor="facturas-estado"
            className="text-sm font-medium text-tinta"
          >
            Estado
          </label>
          <select
            id="facturas-estado"
            value={estado}
            onChange={(evento) => setEstado(evento.target.value)}
            className={claseSelect}
          >
            <option value="">Todas</option>
            <option value="emitida">Emitidas</option>
            <option value="anulada">Anuladas</option>
          </select>
        </div>

        <CampoEntrada
          id="facturas-buscar"
          etiqueta="Buscar"
          tipo="search"
          valor={buscar}
          alCambiar={setBuscar}
          ayuda="Número de factura o cliente"
        />

        <CampoEntrada
          id="facturas-desde"
          etiqueta="Desde"
          tipo="date"
          valor={desde}
          alCambiar={setDesde}
        />

        <CampoEntrada
          id="facturas-hasta"
          etiqueta="Hasta"
          tipo="date"
          valor={hasta}
          alCambiar={setHasta}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Boton tipo="submit" variante="secundario" className="px-3 sm:px-4">
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

      {errorSucursales && (
        <div className="mt-3 flex flex-col items-start gap-3">
          <Alerta variante="error" className="w-full">
            {errorSucursales}
          </Alerta>
          {alReintentarSucursales && (
            <Boton variante="secundario" onClick={alReintentarSucursales}>
              Reintentar sucursales
            </Boton>
          )}
        </div>
      )}
    </form>
  )
}

export default FiltrosFacturas
