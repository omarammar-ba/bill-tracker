import React, { useState, useEffect, useRef } from 'react';
import { Plus, FilePlus, Banknote, Users } from 'lucide-react';

interface QuickActionsFabProps {
  onAddInvoice: () => void;
  onAddPayment: () => void;
  onAddCustomer: () => void;
}

export default function QuickActionsFab({ onAddInvoice, onAddPayment, onAddCustomer }: QuickActionsFabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const fabRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const actions = [
    {
      id: 'invoice',
      label: 'فاتورة جديدة',
      icon: FilePlus,
      bg: 'bg-[#3B5BDB] dark:bg-[#3B5BDB]',
      textColor: 'text-white',
      borderColor: 'border-[#748FFC] dark:border-[#4F75FF]',
      shadowColor: 'shadow-[0_6px_20px_rgba(59,91,219,0.45)] dark:shadow-[0_0_22px_rgba(79,117,255,0.65)]',
      action: onAddInvoice,
    },
    {
      id: 'payment',
      label: 'سند قبض جديد',
      icon: Banknote,
      bg: 'bg-[#2F9E44] dark:bg-[#2F9E44]',
      textColor: 'text-white',
      borderColor: 'border-[#69DB7C] dark:border-[#34D399]',
      shadowColor: 'shadow-[0_6px_20px_rgba(47,158,68,0.45)] dark:shadow-[0_0_22px_rgba(52,211,153,0.65)]',
      action: onAddPayment,
    },
    {
      id: 'customer',
      label: 'إضافة زبون جديد',
      icon: Users,
      bg: 'bg-[#E8590C] dark:bg-[#E8590C]',
      textColor: 'text-white',
      borderColor: 'border-[#FF922B] dark:border-[#FBA11B]',
      shadowColor: 'shadow-[0_6px_20px_rgba(232,89,12,0.45)] dark:shadow-[0_0_22px_rgba(251,161,27,0.65)]',
      action: onAddCustomer,
    },
  ];

  const n = actions.length;
  // Fan arc angles from top (around 95°) down-left to (around 185°)
  const startDeg = 98;
  const endDeg = 185;
  const R = 82; // radius

  const itemsWithCoords = actions.map((act, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const ang = (startDeg + (endDeg - startDeg) * t) * (Math.PI / 180);
    const tx = Math.cos(ang) * R;
    const ty = -Math.sin(ang) * R;
    return {
      ...act,
      tx: tx.toFixed(1),
      ty: ty.toFixed(1),
      din: `${i * 35}ms`,
      dout: `${(n - 1 - i) * 25}ms`,
    };
  });

  const handleToggle = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (!nextOpen) {
      setActiveHint(null);
      setFocusedIndex(-1);
    } else {
      setFocusedIndex(0);
    }
  };

  const handleSelectAction = (act: () => void) => {
    setIsOpen(false);
    setActiveHint(null);
    setFocusedIndex(-1);
    act();
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (index + 1) % n;
      setFocusedIndex(nextIdx);
      itemRefs.current[nextIdx]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (index - 1 + n) % n;
      setFocusedIndex(prevIdx);
      itemRefs.current[prevIdx]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      fabRef.current?.focus();
    }
  };

  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [isOpen, focusedIndex]);

  return (
    <div 
      className="fixed z-[9999] print:hidden font-['Tajawal'] select-none right-6 bottom-6 md:right-8 md:bottom-8"
    >
      {/* Transparent overlay for outside clicks - no blur or background dimming */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Menu Container */}
      <div className="relative w-[58px] h-[58px] z-50">
        {/* Fan Items */}
        <div className="absolute top-1/2 left-1/2 w-0 h-0 list-none m-0 p-0">
          {itemsWithCoords.map((item, i) => {
            const Icon = item.icon;
            const isHovered = activeHint === item.label;

            return (
              <div key={item.id} className="absolute top-0 left-0">
                <button
                  ref={(el) => { itemRefs.current[i] = el; }}
                  type="button"
                  tabIndex={isOpen ? (focusedIndex === i ? 0 : -1) : -1}
                  aria-label={item.label}
                  onClick={() => handleSelectAction(item.action)}
                  onMouseEnter={() => setActiveHint(item.label)}
                  onMouseLeave={() => setActiveHint(null)}
                  onFocus={() => setActiveHint(item.label)}
                  onBlur={() => setActiveHint(null)}
                  onKeyDown={(e) => handleKeyDown(e, i)}
                  style={{
                    transform: isOpen
                      ? `translate(calc(-50% + ${item.tx}px), calc(-50% + ${item.ty}px)) scale(1)`
                      : 'translate(-50%, -50%) scale(0.3)',
                    transitionDelay: isOpen ? item.din : item.dout,
                  }}
                  className={`absolute top-0 left-0 w-12 h-12 rounded-full flex items-center justify-center cursor-pointer border-2 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90 ${
                    item.bg
                  } ${item.textColor} ${item.borderColor} ${item.shadowColor} ${
                    isOpen ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none'
                  } ${isHovered ? 'scale-115 ring-2 ring-white dark:ring-white/90' : 'hover:scale-110'}`}
                >
                  <Icon className="w-5 h-5 stroke-[2.2]" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Hint Tooltip Pill */}
        <div
          className={`absolute bottom-16 right-16 px-4 py-2 rounded-2xl text-xs font-black tracking-wide whitespace-nowrap backdrop-blur-md bg-[#1C1C2E]/90 dark:bg-[#1A1D2D]/95 text-white border border-white/20 dark:border-[#4F75FF]/30 shadow-2xl dark:shadow-[0_0_20px_rgba(79,117,255,0.35)] pointer-events-none transition-all duration-200 z-50 ${
            activeHint && isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
          }`}
        >
          {activeHint}
        </div>

        {/* Main Floating Action Button (FAB) */}
        <button
          ref={fabRef}
          type="button"
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label={isOpen ? 'إغلاق الخيارات السريعة' : 'فتح الخيارات السريعة'}
          onClick={handleToggle}
          className={`relative w-[58px] h-[58px] rounded-full flex items-center justify-center cursor-pointer border-2 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90 z-50 ${
            isOpen
              ? 'bg-[#3B5BDB] dark:bg-gradient-to-tr dark:from-[#3B5BDB] dark:to-[#4F75FF] text-white border-white/50 dark:border-white/80 scale-105 shadow-[0_10px_30px_rgba(59,91,219,0.55)] dark:shadow-[0_0_35px_rgba(79,117,255,0.7)]'
              : 'bg-[#1C1C2E] dark:bg-[#1A1D2D] text-white border-white/30 dark:border-[#4F75FF]/50 hover:bg-black dark:hover:bg-[#222538] hover:scale-105 dark:hover:border-[#4F75FF] shadow-[0_10px_30px_rgba(28,28,46,0.5)] dark:shadow-[0_0_25px_rgba(79,117,255,0.45)]'
          }`}
        >
          {/* Ambient Breathing Ring */}
          {!isOpen && (
            <span className="absolute -inset-1.5 rounded-full border-2 border-[#1C1C2E]/50 dark:border-[#4F75FF]/60 animate-ping opacity-40 pointer-events-none duration-1000" />
          )}

          <div
            className={`transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              isOpen ? 'rotate-[135deg]' : 'rotate-0'
            }`}
          >
            <Plus className="w-7 h-7 stroke-[2.5]" />
          </div>
        </button>
      </div>
    </div>
  );
}

