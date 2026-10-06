/*
 * Generacion de codigos de prueba claramente identificables (`QA-*`).
 * Se marcan inactivos al final de la suite; nunca se borran filas.
 */
let contador = 0

function codigoUnico(prefijo = 'QA') {
  contador += 1
  const sufijo = `${Date.now()}-${contador}-${Math.random()
    .toString(36)
    .slice(2, 7)}`
  return `${prefijo}-${sufijo}`.slice(0, 50)
}

// Claves exactas del contrato `Producto` (ordenadas para comparacion).
const CLAVES_PRODUCTO = [
  'activo',
  'actualizado_en',
  'categoria_id',
  'codigo',
  'creado_en',
  'descripcion',
  'id',
  'impuesto_porcentaje',
  'nombre',
  'precio_unitario',
].sort()

// Claves exactas del contrato `Sucursal` (sin `empresa_id`, ordenadas).
const CLAVES_SUCURSAL = [
  'activo',
  'actualizado_en',
  'creado_en',
  'direccion',
  'id',
  'nombre',
  'telefono',
].sort()

// Nombre de sucursal unico y claramente identificable (max 150, varchar(150)).
function nombreUnico(prefijo = 'QA-SUC') {
  return `${prefijo}-${codigoUnico('n').slice(2)}`.slice(0, 150)
}

module.exports = { codigoUnico, nombreUnico, CLAVES_PRODUCTO, CLAVES_SUCURSAL }