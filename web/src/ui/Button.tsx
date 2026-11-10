import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { Link, type LinkProps } from 'react-router';
import styles from './Button.module.css';

/**
 * `primary` once per view (page head or dialog foot) · `secondary` · `ghost` = quiet text button ·
 * `danger` = confirm-level destructive action · `quietDanger` = red text (row-level delete).
 *
 * Every button and icon link carries its variant as `data-variant` (set after the caller's props, so it
 * cannot be overwritten): guards count `[data-variant="primary"]` instead of a hashed class name.
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
      data-variant={variant}
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
      data-variant={variant}
    />
  );
}

/** An icon button that navigates (a real link, so it opens in a new tab and works with the keyboard). */
export function IconLink({
  label,
  className,
  ...rest
}: Omit<LinkProps, 'aria-label' | 'title'> & { label: string }) {
  return (
    <Link
      aria-label={label}
      title={label}
      className={[styles.btn, styles.icon, styles.ghost, styles.link, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
      data-variant="ghost"
    />
  );
}
