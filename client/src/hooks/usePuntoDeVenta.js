import { useCallback, useMemo, useState } from 'react'
import { crearFactura } from '../servicios/facturas'
import { useClientesSucursal } from './useClientesSucursal'
import { useProductos } from './useProductos'
import { useSucursales } from './useSucursales'

/* Redondeo a 2 decimales para que los totales cuadren con numeric(14,2) del backend. */
export const redondear2 = (valor) => {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return 0
  return Math.round((numero + Number.EPSILON) * 100) / 100
}

const aEntero = (valor) => {
  const numero = Number.parseInt(valor, 10)
  return Number.isFinite(numero) ? numero : 0
}

const aDecimal = (valor) => {
  const numero = Number.parseFloat(valor)
  return Number.isFinite(numero) ? numero : 0
}

const limitar = (valor, minimo, maximo) =>
  Math.min(Math.max(valor, minimo), maximo)

/* Permite escribir decimales con . o , y descarta caracteres inválidos. */
const sanearDecimal = (valor) => {
  const texto = String(valor).replace(',', '.')
  return /^\d*\.?\d*$/.test(texto) ? texto : null
}

/*
 * Cálculo de una línea, idéntico a la fórmula del backend (RF-005):
 *   1. subtotal = redondear2(cantidad * precio * (1 - descuento% / 100))
 *   2. impuesto = redondear2(subtotal_redondeado * impuesto% / 100)
 *   3. total    = redondear2(subtotal_redondeado + impuesto_redondeado)
 * Se devuelven SIEMPRE los importes ya redondeados para que la suma de líneas
 * coincida con la cabecera calculada en `totales` (misma base que el backend).
 */
const calcularLinea = (linea) => {
  const descuento = limitar(aDecimal(linea.descuento_porcentaje), 0, 100)
  const subtotal = redondear2(
    linea.cantidad * linea.precio_unitario * (1 - descuento / 100),
  )
  const impuesto = redondear2(
    (subtotal * limitar(aDecimal(linea.impuesto_porcentaje), 0, 100)) / 100,
  )
  return { subtotal, impuesto, total: redondear2(subtotal + impuesto) }
}

export const usePuntoDeVenta = () => {
  const {
    datos: sucursalesCargadas,
    cargando: cargandoSucursales,
    error: errorSucursales,
    recargar: recargarSucursales,
  } = useSucursales({}, { porPaginaInicial: 100 })

  const {
    datos: productos,
    cargando: cargandoProductos,
    error: errorProductos,
    recargar: recargarProductos,
  } = useProductos({ activo: true }, { porPaginaInicial: 100 })

  const sucursales = useMemo(
    () => sucursalesCargadas.filter((sucursal) => sucursal.activo),
    [sucursalesCargadas],
  )

  const [sucursalElegida, setSucursalElegida] = useState(null)
  const [lineas, setLineas] = useState([])
  const [descuentoGlobal, setDescuentoGlobal] = useState('0')
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteDocumento, setClienteDocumento] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState('')
  const [facturaEmitida, setFacturaEmitida] = useState(null)

  /* Sucursal efectiva: la elegida si sigue activa; si no, la primera activa. */
  const sucursalId = useMemo(() => {
    if (
      sucursalElegida !== null &&
      sucursales.some((sucursal) => sucursal.id === sucursalElegida)
    ) {
      return sucursalElegida
    }
    return sucursales.length > 0 ? sucursales[0].id : null
  }, [sucursalElegida, sucursales])

  // Catálogo de clientes activos de la sucursal elegida (los clientes son por sede).
  const {
    clientes,
    cargando: cargandoClientes,
    error: errorClientes,
    recargar: recargarClientes,
  } = useClientesSucursal(sucursalId)

  // RF-017: al cambiar la sucursal se limpia el cliente registrado elegido.
  const [sucursalCliente, setSucursalCliente] = useState(sucursalId)
  if (sucursalCliente !== sucursalId) {
    setSucursalCliente(sucursalId)
    setClienteSeleccionado(null)
  }

  const seleccionarCliente = useCallback((cliente) => {
    setClienteSeleccionado(cliente ?? null)
    setErrorEnvio('')
  }, [])

  const agregarProducto = useCallback((producto) => {
    if (!producto || producto.id === null || producto.id === undefined) return
    setFacturaEmitida(null)
    setErrorEnvio('')
    setLineas((previas) => {
      const existente = previas.find(
        (linea) => linea.producto_id === producto.id,
      )
      if (existente) {
        return previas.map((linea) =>
          linea.producto_id === producto.id
            ? { ...linea, cantidad: linea.cantidad + 1 }
            : linea,
        )
      }
      return [
        ...previas,
        {
          producto_id: producto.id,
          nombre: producto.nombre,
          codigo: producto.codigo,
          precio_unitario: producto.precio_unitario,
          impuesto_porcentaje: producto.impuesto_porcentaje,
          cantidad: 1,
          descuento_porcentaje: '0',
        },
      ]
    })
  }, [])

  const cambiarCantidad = useCallback((productoId, valor) => {
    setLineas((previas) =>
      previas.map((linea) =>
        linea.producto_id === productoId
          ? { ...linea, cantidad: limitar(aEntero(valor), 0, 999999) }
          : linea,
      ),
    )
  }, [])

  const normalizarCantidad = useCallback((productoId) => {
    setLineas((previas) =>
      previas.map((linea) =>
        linea.producto_id === productoId
          ? { ...linea, cantidad: Math.max(1, linea.cantidad) }
          : linea,
      ),
    )
  }, [])

  const cambiarDescuentoLinea = useCallback((productoId, valor) => {
    const texto = sanearDecimal(valor)
    if (texto === null) return
    const acotado =
      texto === '' || texto === '.'
        ? texto
        : limitar(aDecimal(texto), 0, 100)
    setLineas((previas) =>
      previas.map((linea) =>
        linea.producto_id === productoId
          ? { ...linea, descuento_porcentaje: String(acotado) }
          : linea,
      ),
    )
  }, [])

  const normalizarDescuentoLinea = useCallback((productoId) => {
    setLineas((previas) =>
      previas.map((linea) =>
        linea.producto_id === productoId
          ? {
              ...linea,
              descuento_porcentaje: String(
                redondear2(
                  limitar(aDecimal(linea.descuento_porcentaje), 0, 100),
                ),
              ),
            }
          : linea,
      ),
    )
  }, [])

  const quitarLinea = useCallback((productoId) => {
    setLineas((previas) =>
      previas.filter((linea) => linea.producto_id !== productoId),
    )
  }, [])

  const vaciarCarrito = useCallback(() => {
    setLineas([])
    setDescuentoGlobal('0')
    setClienteSeleccionado(null)
    setClienteNombre('')
    setClienteDocumento('')
  }, [])

  const cambiarDescuentoGlobal = useCallback((valor) => {
    const texto = sanearDecimal(valor)
    if (texto === null) return
    setDescuentoGlobal(texto)
  }, [])

  const normalizarDescuentoGlobal = useCallback(() => {
    setDescuentoGlobal((actual) =>
      String(redondear2(Math.max(0, aDecimal(actual)))),
    )
  }, [])

  /* Líneas con importes ya redondeados, listas para pintar. `calcularLinea`
     ya devuelve valores redondeados, así que lo pintado y lo sumado coinciden. */
  const lineasCalculadas = useMemo(
    () =>
      lineas.map((linea) => {
        const calculo = calcularLinea(linea)
        return {
          ...linea,
          subtotal: calculo.subtotal,
          impuesto: calculo.impuesto,
          total: calculo.total,
        }
      }),
    [lineas],
  )

  /* Totales de cabecera (RF-006): se suman los importes YA redondeados de cada
     línea, igual que el backend. `subtotal = Σ subtotalLinea`,
     `impuesto = Σ impuestoLinea`, `total = redondear2(subtotal - descuento + impuesto)`. */
  const totales = useMemo(() => {
    const acumulado = lineas.reduce(
      (acc, linea) => {
        const calculo = calcularLinea(linea)
        acc.subtotal += calculo.subtotal
        acc.impuesto += calculo.impuesto
        return acc
      },
      { subtotal: 0, impuesto: 0 },
    )

    // `acumulado.*` ya es suma de valores redondeados a 2 decimales; se vuelve a
    // redondear por seguridad frente al error de coma flotante al sumar.
    const subtotal = redondear2(acumulado.subtotal)
    const impuesto = redondear2(acumulado.impuesto)
    const descuento = redondear2(Math.max(0, aDecimal(descuentoGlobal)))
    const total = redondear2(subtotal - descuento + impuesto)

    return {
      subtotal,
      impuesto,
      descuento,
      total,
      unidades: lineas.reduce((acc, linea) => acc + linea.cantidad, 0),
      articulos: lineas.length,
    }
  }, [lineas, descuentoGlobal])

  const validarVenta = useCallback(() => {
    if (sucursalId === null || sucursalId === undefined) {
      return 'Selecciona la sucursal donde se emite la venta.'
    }
    if (lineas.length === 0) {
      return 'Agrega al menos un producto al carrito.'
    }
    if (
      lineas.some(
        (linea) => !Number.isInteger(linea.cantidad) || linea.cantidad <= 0,
      )
    ) {
      return 'Cada producto debe tener una cantidad entera mayor que cero.'
    }
    if (
      lineas.some((linea) => {
        const descuento = aDecimal(linea.descuento_porcentaje)
        return descuento < 0 || descuento > 100
      })
    ) {
      return 'El descuento por línea debe estar entre 0 y 100 %.'
    }
    if (clienteNombre.trim().length > 150) {
      return 'El nombre del cliente no puede superar 150 caracteres.'
    }
    if (clienteDocumento.trim().length > 30) {
      return 'El documento del cliente no puede superar 30 caracteres.'
    }
    if (totales.total < 0) {
      return 'El descuento global supera el total de la venta.'
    }
    return ''
  }, [
    sucursalId,
    lineas,
    clienteNombre,
    clienteDocumento,
    totales.total,
  ])

  const enviarVenta = useCallback(async () => {
    const mensaje = validarVenta()
    if (mensaje) {
      setErrorEnvio(mensaje)
      return null
    }

    setEnviando(true)
    setErrorEnvio('')
    try {
      const factura = await crearFactura({
        sucursal_id: sucursalId,
        metodo_pago_id: null,
        cliente_id: clienteSeleccionado?.id ?? null,
        cliente_nombre: clienteSeleccionado
          ? clienteSeleccionado.nombre
          : clienteNombre.trim() || null,
        cliente_documento: clienteSeleccionado
          ? clienteSeleccionado.documento?.trim() || null
          : clienteDocumento.trim() || null,
        descuento: totales.descuento,
        lineas: lineas.map((linea) => ({
          producto_id: linea.producto_id,
          cantidad: linea.cantidad,
          descuento_porcentaje: redondear2(
            limitar(aDecimal(linea.descuento_porcentaje), 0, 100),
          ),
        })),
      })

      setFacturaEmitida(factura)
      vaciarCarrito()
      return factura
    } catch (fallo) {
      setErrorEnvio(
        fallo?.message || 'No pudimos emitir la factura. Inténtalo de nuevo.',
      )
      return null
    } finally {
      setEnviando(false)
    }
  }, [
    validarVenta,
    sucursalId,
    clienteSeleccionado,
    clienteNombre,
    clienteDocumento,
    totales.descuento,
    lineas,
    vaciarCarrito,
  ])

  const cerrarRecibo = useCallback(() => {
    setFacturaEmitida(null)
    setErrorEnvio('')
  }, [])

  /* Refleja la factura devuelta por la anulación para que el recibo no vuelva
     a ofrecer la acción y muestre el estado `anulada`. */
  const anularFacturaEmitida = useCallback((facturaAnulada) => {
    setFacturaEmitida((actual) =>
      actual && facturaAnulada && actual.id === facturaAnulada.id
        ? facturaAnulada
        : actual,
    )
  }, [])

  return {
    // Datos de apoyo
    sucursales,
    cargandoSucursales,
    errorSucursales,
    recargarSucursales,
    productos,
    cargandoProductos,
    errorProductos,
    recargarProductos,

    // Selección de sucursal
    sucursalId,
    seleccionarSucursal: setSucursalElegida,

    // Cliente registrado de la sucursal (POS)
    clientes,
    cargandoClientes,
    errorClientes,
    recargarClientes,
    clienteRegistrado: clienteSeleccionado,
    seleccionarCliente,

    // Carrito
    lineas: lineasCalculadas,
    agregarProducto,
    cambiarCantidad,
    normalizarCantidad,
    cambiarDescuentoLinea,
    normalizarDescuentoLinea,
    quitarLinea,
    vaciarCarrito,

    // Descuento global
    descuentoGlobal,
    cambiarDescuentoGlobal,
    normalizarDescuentoGlobal,

    // Cliente opcional
    clienteNombre,
    cambiarClienteNombre: setClienteNombre,
    clienteDocumento,
    cambiarClienteDocumento: setClienteDocumento,

    // Totales y envío
    totales,
    enviando,
    errorEnvio,
    enviarVenta,
    facturaEmitida,
    cerrarRecibo,
    anularFacturaEmitida,
  }
}
