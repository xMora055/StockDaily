import BuscadorProductos from '../componentes/BuscadorProductos'
import CarritoLineas from '../componentes/CarritoLineas'
import ReciboEmitido from '../componentes/ReciboEmitido'
import ResumenVenta from '../componentes/ResumenVenta'
import SelectorSucursal from '../componentes/SelectorSucursal'
import { usePuntoDeVenta } from '../hooks/usePuntoDeVenta'

const fechaDeHoy = () =>
  new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date())

const PuntoDeVenta = () => {
  const {
    sucursales,
    cargandoSucursales,
    errorSucursales,
    recargarSucursales,
    productos,
    cargandoProductos,
    errorProductos,
    recargarProductos,
    sucursalId,
    seleccionarSucursal,
    clientes,
    cargandoClientes,
    errorClientes,
    recargarClientes,
    clienteRegistrado,
    seleccionarCliente,
    lineas,
    agregarProducto,
    cambiarCantidad,
    normalizarCantidad,
    cambiarDescuentoLinea,
    normalizarDescuentoLinea,
    quitarLinea,
    vaciarCarrito,
    descuentoGlobal,
    cambiarDescuentoGlobal,
    normalizarDescuentoGlobal,
    clienteNombre,
    cambiarClienteNombre,
    clienteDocumento,
    cambiarClienteDocumento,
    totales,
    enviando,
    errorEnvio,
    enviarVenta,
    facturaEmitida,
    cerrarRecibo,
    anularFacturaEmitida,
  } = usePuntoDeVenta()

  const puedeVender =
    Boolean(sucursalId) && lineas.length > 0 && !enviando

  return (
    <div>
      <div className="flex items-center justify-between border-b border-borde pb-3 font-mono text-xs text-tinta-suave">
        <span>Caja · venta directa</span>
        <span className="capitalize">{fechaDeHoy()}</span>
      </div>

      <div className="mt-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Punto de venta
        </h1>
        <p className="mt-2 max-w-prose text-base text-tinta-suave">
          Arma la venta desde el catálogo, ajusta cantidades y descuentos, y
          emite la factura. El inventario se descuenta al confirmar.
        </p>
      </div>

      {facturaEmitida && (
        <div className="mt-6">
          <ReciboEmitido
            factura={facturaEmitida}
            alCerrar={cerrarRecibo}
            alAnular={anularFacturaEmitida}
          />
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-start xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <section className="flex min-w-0 flex-col gap-6">
          <SelectorSucursal
            sucursales={sucursales}
            sucursalId={sucursalId}
            alSeleccionar={seleccionarSucursal}
            cargando={cargandoSucursales}
            error={errorSucursales}
            alReintentar={recargarSucursales}
          />

          <BuscadorProductos
            productos={productos}
            cargando={cargandoProductos}
            error={errorProductos}
            alAgregar={agregarProducto}
            alReintentar={recargarProductos}
          />
        </section>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6">
          <CarritoLineas
            lineas={lineas}
            totales={totales}
            alCambiarCantidad={cambiarCantidad}
            alNormalizarCantidad={normalizarCantidad}
            alCambiarDescuento={cambiarDescuentoLinea}
            alNormalizarDescuento={normalizarDescuentoLinea}
            alQuitar={quitarLinea}
            alVaciar={vaciarCarrito}
          />

          <ResumenVenta
            totales={totales}
            descuentoGlobal={descuentoGlobal}
            alCambiarDescuento={cambiarDescuentoGlobal}
            alNormalizarDescuento={normalizarDescuentoGlobal}
            clientes={clientes}
            clienteRegistrado={clienteRegistrado}
            alSeleccionarCliente={seleccionarCliente}
            cargandoClientes={cargandoClientes}
            errorClientes={errorClientes}
            alReintentarClientes={recargarClientes}
            clienteNombre={clienteNombre}
            alCambiarClienteNombre={cambiarClienteNombre}
            clienteDocumento={clienteDocumento}
            alCambiarClienteDocumento={cambiarClienteDocumento}
            enviando={enviando}
            errorEnvio={errorEnvio}
            alEnviar={enviarVenta}
            puedeEnviar={puedeVender}
          />
        </aside>
      </div>
    </div>
  )
}

export default PuntoDeVenta
