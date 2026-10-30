import clsx from "clsx";

export default function PageHeader({ overline, title, description, actions, className, children }) {
  return (
    <div className={clsx("mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="max-w-2xl">
        {overline && <p className="overline mb-1.5">{overline}</p>}
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
