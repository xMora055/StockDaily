import Alerta from './Alerta'
import Boton from './Boton'

const SelectorCliente = ({
  clientes = [],
  clienteRegistrado = null,
  alSeleccionar,
  cargando = false,
  error = '',
  alReintentar,
  deshabilitado = false,
}) => {
  const hayClientes = clientes.length > 0
  const valor = clienteRegistrado ? String(clienteRegistrado.id) : ''

  const manejarCambio = (evento) => {
    const bruto = evento.target.value
    if (bruto === '') {
      alSeleccionar(null)
      return
    }
    const id = Number(bruto)
    alSeleccionar(clientes.find((cliente) => cliente.id === id) ?? null)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="pos-cliente-registrado"
        className="text-sm font-medium text-tinta"
      >
        Cliente registrado
      </label>
      <select
        id="pos-cliente-registrado"
        value={valor}
        onChange={manejarCambio}
        disabled={deshabilitado || cargando}
        className="h-11 w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors duration-150 hover:border-borde-fuerte disabled:opacity-60"
      >
        <option value="">Consumidor final</option>
        {clientes.map((cliente) => (
          <option key={cliente.id} value={cliente.id}>
            {cliente.documento
              ? `${cliente.nombre} · ${cliente.documento}`
              : cliente.nombre}
          </option>
        ))}
      </select>

      {error ? (
        <div className="mt-1 flex flex-col items-start gap-2">
          <Alerta variante="error" className="w-full">
            {error}
          </Alerta>
          {alReintentar && (
            <Boton
              variante="secundario"
              className="h-9 px-3 text-sm"
              onClick={alReintentar}
            >
              Reintentar
            </Boton>
          )}
        </div>
      ) : cargando ? (
        <p className="text-xs text-tinta-suave">
          Cargando clientes de la sucursal…
        </p>
      ) : hayClientes ? (
        <p className="text-xs text-tinta-suave">
          La venta queda asociada a este cliente.
        </p>
      ) : (
        <p className="text-xs text-tinta-suave">
          No hay clientes registrados en esta sucursal. Puedes vender como
          consumidor final.
        </p>
      )}
    </div>
  )
}

export default SelectorCliente
