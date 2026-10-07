import type { Strings } from '@/strings';

export const help: Strings['help'] = {
  label: 'Ayuda',
  sync: 'El servidor de sincronización es tu propio servidor pequeño que sincroniza los datos de varios dispositivos. Si quieres, los datos se cifran de extremo a extremo: el servidor solo ve valores ilegibles y la frase de contraseña solo la conocen tus dispositivos.',
  aiLocal:
    'Un modelo de lenguaje pequeño funciona solo en este dispositivo y entiende frases que las reglas fijas no conocen, sin token y sin internet. Solo se descarga con tu permiso (antes ves el tamaño, la fuente y la suma de comprobación) y comprueba la descarga por sí mismo.',
  aiWrite:
    'Nemo siempre muestra primero las entradas detectadas como vista previa; solo se guardan cuando las confirmas. Aquí decides si el asistente puede proponer entradas y dónde.',
  aiCloudWrite:
    'Primero Nemo lo intenta con reglas fijas y luego (si está configurado) con el modelo local: ninguna de las dos cosas cuesta nada ni sale del dispositivo. Solo si no basta y lo permites aquí, la frase se envía a un proveedor de IA junto con la fecha y los nombres de campo de los módulos (nunca tus entradas).',
  aiAskMissing:
    'Activado: si falta, p. ej., la fecha de vencimiento, la vista previa la pide. Desactivado: esas frases no se proponen como entrada.',
  aiRouter:
    'Varios proveedores de IA están en un orden. La app pregunta al primero disponible; si está saturado, no responde o ha llegado a su límite, pasa al siguiente. Solo se envían tu pregunta y un esquema breve, nunca tus datos.',
  updateChannel:
    '«Estable» solo ofrece versiones terminadas. «Beta» también muestra versiones previas, con funciones nuevas antes, pero menos probadas. Antes de cada actualización, la app crea una copia de seguridad.',
  vault:
    'La bóveda está cifrada con tu contraseña maestra, que no se guarda en ningún sitio. Si la olvidas, nadie puede recuperar las entradas, ni siquiera nosotros. Por eso guárdala en un lugar seguro.',
  startData:
    'El asistente lee texto o archivos y primero muestra una vista previa. Solo se guarda cuando lo confirmas, y cada importación se puede deshacer por completo.',
  localApi:
    'La interfaz solo escucha en este ordenador (127.0.0.1) y no sirve de nada sin clave de acceso. Cada acceso recibe solo los permisos que marques. Las importaciones llegan primero a la app como vista previa. Nunca puede acceder a la bóveda (contraseñas), los ajustes ni las claves.',
  connectors:
    'Las conexiones solo leen; no cambian nada en el servicio. Los datos de acceso están en el almacén de claves de este dispositivo y nunca se sincronizan ni se copian. Los correos se analizan solo en tu dispositivo y nunca se envían a una IA.',
};
