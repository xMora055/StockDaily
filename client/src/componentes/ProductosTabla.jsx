import Boton from './Boton'
import Paginacion from './Paginacion'
import { useAutenticacion } from '../hooks/useAutenticacion'
import { formatearMoneda } from '../utilidades/formatoMoneda'

const claseEstado = (activo) =>
  activo
    ? 'border-exito/40 bg-exito-suave text-exito-fuerte'
    : 'border-borde bg-superficie-2 text-tinta-suave'

const etiquetaEstado = (activo) => (activo ? 'Activo' : 'Inactivo')

const ProductosTabla = ({
  productos,
  mapaCategorias = {},
  idAlternando,
  confirmandoId,
  alEditar,
  alActivar,
  alSolicitarDesactivar,
  alConfirmarDesactivar,
  alCancelarDesactivar,
  pagina,
  totalPaginas,
  total,
  porPagina,
  alAnterior,
  alSiguiente,
  alCambiarPorPagina,
}) => {
  const { usuario } = useAutenticacion()
  const moneda = usuario?.empresa?.moneda || 'COP'
  const renderAcciones = (producto) => {
    const ocupado = idAlternando === producto.id
    const confirmando = confirmandoId === producto.id

    return (
      <div className="flex flex-wrap items-center gap-2 [&>button]:px-2.5">
        {!confirmando && (
          <Boton
            variante="secundario"
            className="text-sm"
            onClick={() => alEditar(producto)}
            deshabilitado={ocupado}
          >
            Editar
          </Boton>
        )}

        {producto.activo ? (
          confirmando ? (
            <>
              <Boton
                variante="acento"
                className="text-sm"
                cargando={ocupado}
                onClick={() => alConfirmarDesactivar(producto)}
              >
                Confirmar
              </Boton>
              <Boton
                variante="sutil"
                className="text-sm"
                onClick={alCancelarDesactivar}
                deshabilitado={ocupado}
              >
                Cancelar
              </Boton>
            </>
          ) : (
            <Boton
              variante="sutil"
              className="text-sm"
              onClick={() => alSolicitarDesactivar(producto)}
              deshabilitado={ocupado}
            >
              Desactivar
            </Boton>
          )
        ) : (
          <Boton
            variante="secundario"
            className="text-sm"
            cargando={ocupado}
            onClick={() => alActivar(producto)}
          >
            Activar
          </Boton>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Escritorio/tablet: tabla de ancho fijo con proporciones intencionales.
          `min-w` marca el suelo legible; si el contenedor baja de ahí, el
          wrapper desplaza horizontalmente en lugar de recortar columnas. */}
      <div className="hidden overflow-hidden rounded-lg border border-borde bg-superficie md:block">
        <div className="overflow-x-auto rounded-lg">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
            <caption className="sr-only">Productos registrados</caption>
            <colgroup>
              <col className="w-[104px]" />
              <col />
              <col className="w-[150px]" />
              <col className="w-[128px]" />
              <col className="w-0 xl:w-[96px]" />
              <col className="w-[112px]" />
              <col className="w-[208px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-borde bg-superficie-2 text-left font-mono text-xs uppercase tracking-wide text-tinta-suave">
                <th
                  scope="col"
                  className="whitespace-nowrap px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Código
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Producto
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Categoría
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-3 py-3 text-right align-middle font-medium sm:px-4"
                >
                  Precio
                </th>
                <th
                  scope="col"
                  className="hidden whitespace-nowrap px-3 py-3 text-right align-middle font-medium sm:px-4 xl:table-cell"
                >
                  Impuesto
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Estado
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {productos.map((producto) => (
                <tr key={producto.id} className="align-middle">
                  <td className="px-3 py-3 font-mono text-xs text-tinta-suave sm:px-4">
                    <span className="block truncate" title={producto.codigo}>
                      {producto.codigo}
                    </span>
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <p
                      className="truncate font-medium text-tinta"
                      title={producto.nombre}
                    >
                      {producto.nombre}
                    </p>
                    {producto.descripcion && (
                      <p
                        className="mt-0.5 truncate text-xs text-tinta-suave"
                        title={producto.descripcion}
                      >
                        {producto.descripcion}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <span
                      className="block truncate text-tinta-suave"
                      title={mapaCategorias[producto.categoria_id] ?? 'Sin categoría'}
                    >
                      {mapaCategorias[producto.categoria_id] ?? '—'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums sm:px-4">
                    {formatearMoneda(producto.precio_unitario, moneda)}
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums text-tinta-suave sm:px-4 xl:table-cell">
                    {`${producto.impuesto_porcentaje}%`}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${claseEstado(
                        producto.activo,
                      )}`}
                    >
                      {etiquetaEstado(producto.activo)}
                    </span>
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    {renderAcciones(producto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Móvil: tarjetas, sin scroll horizontal. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {productos.map((producto) => (
          <li
            key={producto.id}
            className="rounded-lg border border-borde bg-superficie p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-tinta-suave">
                  {producto.codigo}
                </p>
                <p className="mt-1 font-medium text-tinta">
                  {producto.nombre}
                </p>
              </div>
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${claseEstado(
                  producto.activo,
                )}`}
              >
                {etiquetaEstado(producto.activo)}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-borde pt-3 text-sm">
              <div>
                <dt className="font-mono text-xs text-tinta-suave">Precio</dt>
                <dd className="mt-0.5 font-mono tabular-nums">
                  {formatearMoneda(producto.precio_unitario, moneda)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-tinta-suave">Impuesto</dt>
                <dd className="mt-0.5 font-mono tabular-nums">
                  {`${producto.impuesto_porcentaje}%`}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="font-mono text-xs text-tinta-suave">
                  Categoría
                </dt>
                <dd className="mt-0.5 text-tinta">
                  {mapaCategorias[producto.categoria_id] ?? '—'}
                </dd>
              </div>
            </dl>

            <div className="mt-4">{renderAcciones(producto)}</div>
          </li>
        ))}
      </ul>

      {Number(total) > 0 && (
        <Paginacion
          pagina={pagina}
          totalPaginas={totalPaginas}
          total={total}
          porPagina={porPagina}
          etiqueta="producto"
          plural="productos"
          ariaLabel="Paginación de productos"
          alAnterior={alAnterior}
          alSiguiente={alSiguiente}
          alCambiarPorPagina={alCambiarPorPagina}
        />
      )}
    </>
  )
}

export default ProductosTabla