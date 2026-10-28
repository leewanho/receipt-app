import type { ReactNode } from 'react';

interface BigButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'plain' | 'danger';
  disabled?: boolean;
}

export function BigButton({ children, onClick, variant = 'primary', disabled }: BigButtonProps) {
  return (
    <button type="button" className={`big-btn ${variant}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

interface ScreenProps {
  title?: string;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Screen({ title, onBack, children, footer }: ScreenProps) {
  return (
    <div className="screen">
      {(title || onBack) && (
        <header className="top-bar">
          {onBack && (
            <button type="button" className="back-btn" onClick={onBack}>
              ← 뒤로
            </button>
          )}
          {title && <h1>{title}</h1>}
        </header>
      )}
      <main className="content">{children}</main>
      {footer && <footer className="bottom-bar">{footer}</footer>}
    </div>
  );
}

export function Message({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return (
    <p className={`message ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}

interface SheetProps {
  title: string;
  children: ReactNode;
}

/** 화면 아래에서 올라오는 선택창 */
export function BottomSheet({ title, children }: SheetProps) {
  return (
    <div className="sheet-backdrop">
      <div className="sheet" role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
