import type { Strings } from '@/strings';

export const shortcuts: Strings['shortcuts'] = {
  title: 'Atajos de teclado',
  hint: 'Las letras sueltas solo funcionan cuando no estás escribiendo en un campo.',
  items: [
    { keys: ['Ctrl', 'K'], text: 'Buscar o preguntar' },
    { keys: ['N'], text: 'Añadir nuevo' },
    { keys: ['G', 'luego H'], text: 'Ir al resumen' },
    {
      keys: ['G', 'luego P / G / A / W / T'],
      text: 'Ir a Planificar, Dinero, Hogar, Conocimiento, Bóveda',
    },
    { keys: ['J', 'K'], text: 'Fila siguiente / anterior (también ↓ ↑)' },
    { keys: ['Enter'], text: 'Abrir fila' },
    { keys: ['E'], text: 'Editar fila' },
    { keys: ['Espacio'], text: 'Marcar fila como hecha' },
    { keys: ['/'], text: 'Buscar en la lista' },
    { keys: ['Ctrl', 'Z'], text: 'Deshacer la última acción' },
    { keys: ['Alt', 'L'], text: 'Activar o desactivar la ayuda de lectura' },
    { keys: ['Esc'], text: 'Cerrar / quitar selección' },
    { keys: ['Alt', 'Inicio'], text: 'Ir al resumen' },
    { keys: ['?'], text: 'Esta lista' },
  ],
};
