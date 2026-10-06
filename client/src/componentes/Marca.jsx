const tonos = {
  marca: 'bg-petroleo text-fondo ring-1 ring-inset ring-white/15',
  claro: 'bg-fondo text-petroleo',
}

const Marca = ({ tono = 'marca', className = 'h-9 w-9' }) => (
  <span
    className={`inline-flex shrink-0 items-center justify-center rounded-md ${tonos[tono]} ${className}`}
  >
    <svg
      viewBox="0 0 24 24"
      className="h-[62%] w-[62%]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" />
      <path d="m4 7.5 8 4.5 8-4.5" />
      <path d="M12 12v9" />
      <circle cx="17.6" cy="6.6" r="2.7" className="fill-acento stroke-none" />
    </svg>
  </span>
)

export default Marca
