const sharedButtonBase =
  'inline-flex self-start rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-inset transition-colors disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50'

/** Shared action button style based on the compact pill variant. */
export const sharedButtonClass = `${sharedButtonBase} bg-slate-100 text-slate-900 ring-slate-300 hover:bg-slate-200`

/** Shared tiny action button style for inline helper actions. */
export const sharedButtonTinyClass =
  'inline-flex align-middle rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold whitespace-nowrap shadow-sm ring-1 ring-inset transition-colors bg-slate-100 text-slate-900 ring-slate-300 hover:bg-slate-200 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50'
