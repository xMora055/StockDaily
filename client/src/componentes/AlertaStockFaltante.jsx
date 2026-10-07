import Alerta from './Alerta'
import { formatearNumero } from '../utilidades/formatoMoneda'

const AlertaStockFaltante = ({ total = 0, items = [] }) => {
  const totalNumero = Number(total) || 0
  const lista = Array.isArray(items) ? items : []

  if (totalNumero <= 0) {
    return (
      <Alerta variante="exito">
        Sin faltantes de inventario. Todo tu stock está en positivo.
      </Alerta>
    )
  }

  return (
    <section className="rounded-lg border border-error/30 bg-error-suave p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-base font-semibold tracking-tight text-error-fuerte">
          Faltantes de inventario
        </h2>
        <p className="font-mono text-xs text-error-fuerte">
          {formatearNumero(totalNumero)}{' '}
          {totalNumero === 1 ? 'producto' : 'productos'}
        </p>
      </div>

      <p className="mt-1 max-w-prose text-sm text-tinta-suave">
        Estos productos vendieron más de lo disponible y quedaron con saldo
        negativo.
      </p>

      {lista.length > 0 ? (
        <ul className="mt-4 divide-y divide-error/15 border-t border-error/15">
          {lista.map((item, indice) => (
            <li
              key={`${item?.producto_id ?? 'p'}-${item?.sucursal_nombre ?? indice}`}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-tinta">
                  {item?.producto_nombre}
                </span>
                <span className="block truncate font-mono text-xs text-tinta-suave">
                  {item?.producto_codigo} · {item?.sucursal_nombre}
                </span>
              </span>

              <span className="shrink-0 text-right">
                <span className="block font-mono text-base font-semibold tabular-nums text-error-fuerte">
                  {formatearNumero(item?.faltante)}
                </span>
                <span className="block font-mono text-xs text-tinta-suave">
                  por reponer
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-tinta-suave">
          No hay detalle de los casos.
        </p>
      )}
    </section>
  )
}

export default AlertaStockFaltante
