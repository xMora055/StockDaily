import Alerta from './Alerta'
import Boton from './Boton'

const SelectorSucursal = ({
  sucursales,
  sucursalId,
  alSeleccionar,
  cargando = false,
  error = '',
  alReintentar,
}) => {
  if (cargando) {
    return (
      <div
        className="rounded-lg border border-borde bg-superficie p-4"
        aria-live="polite"
      >
        <p className="sr-only">Cargando sucursales…</p>
        <div className="h-4 w-28 animate-pulse rounded bg-superficie-2" />
        <div className="mt-3 h-11 w-full animate-pulse rounded-md bg-superficie-2" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-error/30 bg-error-suave p-5">
        <Alerta variante="error">{error}</Alerta>
        <Boton variante="secundario" onClick={alReintentar}>
          Reintentar
        </Boton>
      </div>
    )
  }

  if (sucursales.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-borde-fuerte bg-superficie px-5 py-6">
        <h2 className="font-display text-base font-semibold tracking-tight">
          Sin sucursales activas
        </h2>
        <p className="mt-1.5 max-w-prose text-sm text-tinta-suave">
          Activa una sucursal en la sección Sucursales para poder emitir
          ventas desde el punto de venta.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-borde bg-superficie p-4">
      <label
        htmlFor="pos-sucursal"
        className="text-sm font-medium text-tinta"
      >
        Sucursal de venta
      </label>
      <select
        id="pos-sucursal"
        value={sucursalId ?? ''}
        onChange={(evento) => alSeleccionar(Number(evento.target.value))}
        className="mt-1.5 h-11 w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors duration-150 hover:border-borde-fuerte"
      >
        {sucursales.map((sucursal) => (
          <option key={sucursal.id} value={sucursal.id}>
            {sucursal.nombre}
          </option>
        ))}
      </select>
      <p className="mt-2 font-mono text-xs text-tinta-suave">
        El inventario y la numeración se descuentan de esta sede.
      </p>
    </div>
  )
}

export default SelectorSucursal
