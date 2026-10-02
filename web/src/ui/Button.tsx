import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import styles from './Button.module.css';

/**
 * `primary` once per view (page head or dialog foot) · `secondary` · `ghost` = quiet text button ·
 * `danger` = confirm-level destructive action · `quietDanger` = red text (row-level delete).
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quietDanger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** `sm`: 32 px row button, still a 44 px hit area. */
  size?: 'md' | 'sm';
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[styles.btn, styles[variant], size === 'sm' ? styles.sm : '', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  variant?: Variant;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({
  label,
  variant = 'ghost',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={[styles.btn, styles.icon, styles[variant], className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
}
