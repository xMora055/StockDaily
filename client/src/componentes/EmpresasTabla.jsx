import Boton from './Boton'
import Paginacion from './Paginacion'

const claseEstado = (activo) =>
  activo
    ? 'border-exito/40 bg-exito-suave text-exito-fuerte'
    : 'border-borde bg-superficie-2 text-tinta-suave'

const etiquetaEstado = (activo) => (activo ? 'Activa' : 'Inactiva')

const textoOpcional = (valor) => valor?.trim() || '—'

const EmpresasTabla = ({
  empresas,
  idAlternando,
  confirmandoId,
  alVer,
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
  const renderAcciones = (empresa) => {
    const ocupado = idAlternando === empresa.id
    const confirmando = confirmandoId === empresa.id

    return (
      <div className="flex flex-wrap items-center gap-2 [&>button]:px-2.5">
        {!confirmando && (
          <Boton
            variante="sutil"
            className="text-sm"
            onClick={() => alVer(empresa)}
            deshabilitado={ocupado}
          >
            Ver
          </Boton>
        )}

        {!confirmando && (
          <Boton
            variante="secundario"
            className="text-sm"
            onClick={() => alEditar(empresa)}
            deshabilitado={ocupado}
          >
            Editar
          </Boton>
        )}

        {empresa.activo ? (
          confirmando ? (
            <>
              <Boton
                variante="acento"
                className="text-sm"
                cargando={ocupado}
                onClick={() => alConfirmarDesactivar(empresa)}
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
              onClick={() => alSolicitarDesactivar(empresa)}
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
            onClick={() => alActivar(empresa)}
          >
            Activar
          </Boton>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-borde bg-superficie md:block">
        <div className="overflow-x-auto rounded-lg">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
            <caption className="sr-only">Empresas registradas</caption>
            <colgroup>
              <col />
              <col className="w-[140px]" />
              <col className="w-[90px]" />
              <col className="w-[120px]" />
              <col className="w-[110px]" />
              <col className="w-[220px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-borde bg-superficie-2 text-left font-mono text-xs uppercase tracking-wide text-tinta-suave">
                <th
                  scope="col"
                  className="px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Empresa
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Documento
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Moneda
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Teléfono
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Estado
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {empresas.map((empresa) => (
                <tr key={empresa.id} className="align-middle">
                  <td className="px-3 py-3 sm:px-4">
                    <p
                      className="truncate font-medium text-tinta"
                      title={empresa.nombre}
                    >
                      {empresa.nombre}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-tinta-suave">
                      {textoOpcional(empresa.correo)}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums text-tinta-suave sm:px-4">
                    {textoOpcional(empresa.documento)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums text-tinta-suave sm:px-4">
                    {textoOpcional(empresa.moneda)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums text-tinta-suave sm:px-4">
                    {textoOpcional(empresa.telefono)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${claseEstado(
                        empresa.activo,
                      )}`}
                    >
                      {etiquetaEstado(empresa.activo)}
                    </span>
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    {renderAcciones(empresa)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {empresas.map((empresa) => (
          <li
            key={empresa.id}
            className="rounded-lg border border-borde bg-superficie p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 font-medium text-tinta">{empresa.nombre}</p>
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${claseEstado(
                  empresa.activo,
                )}`}
              >
                {etiquetaEstado(empresa.activo)}
              </span>
            </div>

            <dl className="mt-3 flex flex-col gap-3 border-t border-borde pt-3 text-sm">
              <div>
                <dt className="font-mono text-xs text-tinta-suave">
                  Documento
                </dt>
                <dd className="mt-0.5 font-mono tabular-nums text-tinta">
                  {textoOpcional(empresa.documento)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-tinta-suave">Moneda</dt>
                <dd className="mt-0.5 font-mono tabular-nums text-tinta">
                  {textoOpcional(empresa.moneda)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-tinta-suave">Teléfono</dt>
                <dd className="mt-0.5 font-mono tabular-nums text-tinta">
                  {textoOpcional(empresa.telefono)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-tinta-suave">Correo</dt>
                <dd className="mt-0.5 break-words text-tinta">
                  {textoOpcional(empresa.correo)}
                </dd>
              </div>
            </dl>

            <div className="mt-4">{renderAcciones(empresa)}</div>
          </li>
        ))}
      </ul>

      {Number(total) > 0 && (
        <Paginacion
          pagina={pagina}
          totalPaginas={totalPaginas}
          total={total}
          porPagina={porPagina}
          etiqueta="empresa"
          plural="empresas"
          ariaLabel="Paginación de empresas"
          alAnterior={alAnterior}
          alSiguiente={alSiguiente}
          alCambiarPorPagina={alCambiarPorPagina}
        />
      )}
    </>
  )
}

export default EmpresasTabla
