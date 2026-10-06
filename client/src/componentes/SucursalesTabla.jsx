import Boton from './Boton'
import Paginacion from './Paginacion'

const claseEstado = (activo) =>
  activo
    ? 'border-exito/40 bg-exito-suave text-exito-fuerte'
    : 'border-borde bg-superficie-2 text-tinta-suave'

const etiquetaEstado = (activo) => (activo ? 'Activa' : 'Inactiva')

const textoOpcional = (valor) => valor?.trim() || '—'

const SucursalesTabla = ({
  sucursales,
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
  const renderAcciones = (sucursal) => {
    const ocupado = idAlternando === sucursal.id
    const confirmando = confirmandoId === sucursal.id

    return (
      <div className="flex flex-wrap items-center gap-2 [&>button]:px-2.5">
        {!confirmando && (
          <Boton
            variante="secundario"
            className="text-sm"
            onClick={() => alEditar(sucursal)}
            deshabilitado={ocupado}
          >
            Editar
          </Boton>
        )}

        {sucursal.activo ? (
          confirmando ? (
            <>
              <Boton
                variante="acento"
                className="text-sm"
                cargando={ocupado}
                onClick={() => alConfirmarDesactivar(sucursal)}
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
              onClick={() => alSolicitarDesactivar(sucursal)}
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
            onClick={() => alActivar(sucursal)}
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
          <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
            <caption className="sr-only">Sucursales registradas</caption>
            <colgroup>
              <col />
              <col className="w-0 lg:w-[24%]" />
              <col className="w-[136px]" />
              <col className="w-[110px]" />
              <col className="w-[200px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-borde bg-superficie-2 text-left font-mono text-xs uppercase tracking-wide text-tinta-suave">
                <th
                  scope="col"
                  className="px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Sucursal
                </th>
                <th
                  scope="col"
                  className="hidden px-3 py-3 align-middle font-medium sm:px-4 lg:table-cell"
                >
                  Dirección
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Teléfono
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
              {sucursales.map((sucursal) => (
                <tr key={sucursal.id} className="align-middle">
                  <td className="px-3 py-3 sm:px-4">
                    <p
                      className="truncate font-medium text-tinta"
                      title={sucursal.nombre}
                    >
                      {sucursal.nombre}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-tinta-suave lg:hidden">
                      {textoOpcional(sucursal.direccion)}
                    </p>
                  </td>
                  <td className="hidden px-3 py-3 sm:px-4 lg:table-cell">
                    <span
                      className="block truncate text-tinta-suave"
                      title={textoOpcional(sucursal.direccion)}
                    >
                      {textoOpcional(sucursal.direccion)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums text-tinta-suave sm:px-4">
                    {textoOpcional(sucursal.telefono)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${claseEstado(
                        sucursal.activo,
                      )}`}
                    >
                      {etiquetaEstado(sucursal.activo)}
                    </span>
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    {renderAcciones(sucursal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Móvil: tarjetas, sin scroll horizontal. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {sucursales.map((sucursal) => (
          <li
            key={sucursal.id}
            className="rounded-lg border border-borde bg-superficie p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 font-medium text-tinta">{sucursal.nombre}</p>
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${claseEstado(
                  sucursal.activo,
                )}`}
              >
                {etiquetaEstado(sucursal.activo)}
              </span>
            </div>

            <dl className="mt-3 flex flex-col gap-3 border-t border-borde pt-3 text-sm">
              <div>
                <dt className="font-mono text-xs text-tinta-suave">
                  Dirección
                </dt>
                <dd className="mt-0.5 break-words text-tinta">
                  {textoOpcional(sucursal.direccion)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-tinta-suave">Teléfono</dt>
                <dd className="mt-0.5 font-mono tabular-nums text-tinta">
                  {textoOpcional(sucursal.telefono)}
                </dd>
              </div>
            </dl>

            <div className="mt-4">{renderAcciones(sucursal)}</div>
          </li>
        ))}
      </ul>

      {Number(total) > 0 && (
        <Paginacion
          pagina={pagina}
          totalPaginas={totalPaginas}
          total={total}
          porPagina={porPagina}
          etiqueta="sucursal"
          plural="sucursales"
          ariaLabel="Paginación de sucursales"
          alAnterior={alAnterior}
          alSiguiente={alSiguiente}
          alCambiarPorPagina={alCambiarPorPagina}
        />
      )}
    </>
  )
}

export default SucursalesTabla
