import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  contentClassName?: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title, children, defaultOpen = true, contentClassName = 'px-4 py-4 space-y-4'
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<string>(defaultOpen ? 'none' : '0px');

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    if (open) {
      setMaxHeight(`${el.scrollHeight}px`);
      const timer = setTimeout(() => setMaxHeight('none'), 300);
      return () => clearTimeout(timer);
    } else {
      el.style.maxHeight = `${el.scrollHeight}px`;
      el.offsetHeight; // force reflow
      setMaxHeight('0px');
    }
  }, [open]);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 text-sm font-semibold text-slate-700 hover:bg-slate-100"
      >
        {title}
        <span className={`transition-transform duration-300 ${open ? 'rotate-180' : 'rotate-0'}`}>
          <ChevronDown size={16} />
        </span>
      </button>
      <div
        ref={contentRef}
        style={{ maxHeight, overflow: maxHeight === 'none' ? 'visible' : 'hidden' }}
        className="transition-[max-height] duration-300 ease-in-out"
      >
        <div className={contentClassName}>{children}</div>
      </div>
    </div>
  );
};
