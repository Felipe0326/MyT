"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

type SmoothFilterOption = {
  value: string;
  label: string;
};

type SmoothFilterSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SmoothFilterOption[];
  placeholder: string;
  ariaLabel: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  align?: "start" | "end";
};

const CLOSE_DURATION_MS = 150;

export function SmoothFilterSelect({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  searchable = false,
  searchPlaceholder = "Buscar...",
  align = "start",
}: SmoothFilterSelectProps) {
  const id = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const changeTimerRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedLabel = options.find((option) => option.value === value)?.label;
  const visibleOptions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es-MX");
    if (!query) return options;
    return options.filter((option) => option.label.toLocaleLowerCase("es-MX").includes(query));
  }, [options, search]);

  function clearTimers() {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    if (changeTimerRef.current !== null) window.clearTimeout(changeTimerRef.current);
    closeTimerRef.current = null;
    changeTimerRef.current = null;
  }

  function openMenu() {
    clearTimers();
    setMounted(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setOpen(true));
    });
  }

  function closeMenu() {
    setOpen(false);
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      setSearch("");
      closeTimerRef.current = null;
    }, CLOSE_DURATION_MS);
  }

  function toggleMenu() {
    if (open || mounted) closeMenu();
    else openMenu();
  }

  function selectOption(nextValue: string) {
    if (nextValue === value) {
      closeMenu();
      return;
    }

    closeMenu();
    // Primero cierra suavemente el menú y después aplica el filtro. Esto evita
    // saltos visuales cuando el tablero comienza a consultar los nuevos datos.
    changeTimerRef.current = window.setTimeout(() => {
      onChange(nextValue);
      changeTimerRef.current = null;
    }, CLOSE_DURATION_MS - 20);
  }

  useEffect(() => {
    if (!mounted) return;

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) closeMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mounted]);

  useEffect(() => () => clearTimers(), []);

  return (
    <div ref={wrapperRef} className="smooth-filter-select">
      <button
        type="button"
        className="smooth-filter-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        onClick={toggleMenu}
      >
        <span className={selectedLabel ? "smooth-filter-value" : "smooth-filter-placeholder"}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown className={`smooth-filter-chevron ${open ? "is-open" : ""}`} aria-hidden="true" />
      </button>

      {mounted && (
        <>
          <button
            type="button"
            className={`smooth-filter-backdrop ${open ? "is-open" : ""}`}
            aria-label="Cerrar opciones"
            tabIndex={-1}
            onClick={closeMenu}
          />
          <div
            id={`${id}-options`}
            className={`smooth-filter-panel ${searchable ? "is-searchable" : "is-compact"} ${align === "end" ? "align-end" : "align-start"} ${open ? "is-open" : ""}`}
            role="listbox"
            aria-label={ariaLabel}
            aria-hidden={!open}
          >
            {searchable && (
              <div className="smooth-filter-search-wrap">
                <div className="smooth-filter-search">
                  <Search size={16} aria-hidden="true" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda">
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="smooth-filter-options">
              <button
                type="button"
                role="option"
                aria-selected={!value}
                className="smooth-filter-option"
                onClick={() => selectOption("")}
              >
                <span>{placeholder}</span>
                {!value && <Check size={16} aria-hidden="true" />}
              </button>

              {visibleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={value === option.value}
                  className="smooth-filter-option"
                  onClick={() => selectOption(option.value)}
                >
                  <span>{option.label}</span>
                  {value === option.value && <Check size={16} aria-hidden="true" />}
                </button>
              ))}

              {visibleOptions.length === 0 && (
                <p className="smooth-filter-empty">No se encontraron opciones.</p>
              )}
            </div>

            {searchable && (
              <div className="smooth-filter-count">{options.length} opciones disponibles</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
