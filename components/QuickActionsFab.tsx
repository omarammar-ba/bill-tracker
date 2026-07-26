import React, { useState, useEffect, useRef } from 'react';
import { ViewState } from '../types';
import { FilePlus, Banknote, Users, Plus } from 'lucide-react';

interface QuickActionsFabProps {
  changeView: (view: ViewState) => void;
}

interface ActionItem {
  id: string;
  label: string;
  view: ViewState;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  bgColor: string;
  textColor: string;
  borderColor: string;
  accentColor: string;
}

const ACTION_ITEMS: ActionItem[] = [
  {
    id: 'invoice',
    label: 'فاتورة جديدة',
    view: 'NEW_TRANSACTION',
    icon: FilePlus,
    bgColor: '#EEF2FF',
    textColor: '#3B5BDB',
    borderColor: '#C5D0FA',
    accentColor: '#3B5BDB',
  },
  {
    id: 'payment',
    label: 'سند قبض',
    view: 'PAYMENTS',
    icon: Banknote,
    bgColor: '#EBFBEE',
    textColor: '#2F9E44',
    borderColor: '#B2F2BB',
    accentColor: '#2F9E44',
  },
  {
    id: 'customers',
    label: 'الزبائن والمحلات',
    view: 'CUSTOMERS',
    icon: Users,
    bgColor: '#FFF4E6',
    textColor: '#E8590C',
    borderColor: '#FFD8A8',
    accentColor: '#E8590C',
  },
];

export const QuickActionsFab: React.FC<QuickActionsFabProps> = ({ changeView }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const n = ACTION_ITEMS.length;

  // Calculate arc geometry
  // For bottom-right floating corner (right: 28px, bottom: 28px)
  // We fan upward and to the left (95deg down to 175deg)
  const R = 88;
  const startDeg = 95;
  const endDeg = 175;

  useEffect(() => {
    ACTION_ITEMS.forEach((_, i) => {
      const el = itemsRef.current[i];
      if (!el) return;
      const t = n === 1 ? 0.5 : i / (n - 1);
      const ang = (startDeg + (endDeg - startDeg) * t) * (Math.PI / 180);
      const tx = Math.cos(ang) * R;
      const ty = -Math.sin(ang) * R;

      el.style.setProperty('--nrm-tx', `${tx.toFixed(1)}px`);
      el.style.setProperty('--nrm-ty', `${ty.toFixed(1)}px`);
      el.style.setProperty('--nrm-din', `${i * 40}ms`);
      el.style.setProperty('--nrm-dout', `${(n - 1 - i) * 30}ms`);
    });
  }, [n]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHintText(null);
      }
    };
    if (isOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleOpen = () => {
    setIsOpen(prev => {
      const next = !prev;
      if (!next) setHintText(null);
      return next;
    });
  };

  const handleAction = (item: ActionItem) => {
    setPressedId(item.id);
    setTimeout(() => {
      setPressedId(null);
      setIsOpen(false);
      setHintText(null);
      changeView(item.view);
    }, 180);
  };

  const roveTo = (i: number) => {
    const idx = ((i % n) + n) % n;
    const targetEl = itemsRef.current[idx];
    if (targetEl) {
      targetEl.focus();
      setHintText(ACTION_ITEMS[idx].label);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`nrm-root print:hidden ${isOpen ? 'nrm-open' : ''}`}
      dir="rtl"
    >
      {/* Soft radial backdrop focus bloom */}
      <div className="nrm-backdrop" aria-hidden="true" />

      <nav className="nrm-menu" aria-label="الإجراءات السريعة">
        {/* Hint Pill naming active action */}
        <div
          className={`nrm-hint ${hintText && isOpen ? 'nrm-shown' : ''}`}
          aria-hidden="true"
        >
          {hintText}
        </div>

        {/* Arc Items List */}
        <ul
          className="nrm-items"
          role="menu"
          aria-hidden={!isOpen}
        >
          {ACTION_ITEMS.map((item, i) => {
            const IconComponent = item.icon;
            const isPressed = pressedId === item.id;

            return (
              <li key={item.id} role="none">
                <button
                  ref={el => { itemsRef.current[i] = el; }}
                  className={`nrm-item ${isPressed ? 'nrm-pressed' : ''}`}
                  style={{
                    '--item-bg': item.bgColor,
                    '--item-color': item.textColor,
                    '--item-border': item.borderColor,
                    '--item-accent': item.accentColor,
                  } as React.CSSProperties}
                  role="menuitem"
                  tabIndex={isOpen ? 0 : -1}
                  type="button"
                  aria-label={item.label}
                  onClick={() => handleAction(item)}
                  onPointerEnter={() => setHintText(item.label)}
                  onPointerLeave={() => setHintText(null)}
                  onFocus={() => setHintText(item.label)}
                  onKeyDown={e => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      roveTo(i + 1);
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      roveTo(i - 1);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsOpen(false);
                      setHintText(null);
                    } else if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleAction(item);
                    }
                  }}
                >
                  <span className="nrm-ico" aria-hidden="true">
                    <IconComponent size={22} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Main Floating Action Button */}
        <button
          className="nrm-fab"
          type="button"
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label={isOpen ? 'إغلاق الإجراءات السريعة' : 'فتح الإجراءات السريعة'}
          onClick={toggleOpen}
        >
          <span className="nrm-fab-icon" aria-hidden="true">
            <Plus size={26} strokeWidth={2.2} />
          </span>
        </button>
      </nav>
    </div>
  );
};
