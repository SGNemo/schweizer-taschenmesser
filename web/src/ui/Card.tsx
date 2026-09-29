import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  as?: 'section' | 'div' | 'article' | 'li';
}

export function Card({ title, as: Tag = 'section', className, children, ...rest }: CardProps) {
  return (
    <Tag className={[styles.card, className].filter(Boolean).join(' ')} {...rest}>
      {title ? <h2 className={styles.title}>{title}</h2> : null}
      {children}
    </Tag>
  );
}
