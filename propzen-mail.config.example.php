<?php
/*
 * Configuración del correo de Propzen para enviar.php. ESTE ARCHIVO ES SOLO UN EJEMPLO, SIN CLAVE.
 *
 * Cómo usarlo en Hostinger:
 *   1) Copia este archivo y renombra la copia a propzen-mail.config.php
 *   2) Escribe la clave de la casilla contacto@propzen.cl en 'smtp_clave' (la misma con que entras a Hostinger Mail)
 *   3) Súbelo una carpeta ARRIBA de public_html (por ejemplo domains/propzen.cl/propzen-mail.config.php),
 *      o, si no puedes, dentro de public_html junto a enviar.php (el .htaccess lo protege).
 * Nunca subas el archivo con la clave a un repositorio ni lo compartas.
 */
return [
    // Servidor de salida de Hostinger Mail (hPanel → Correos → Configuración de clientes de correo)
    'smtp_host' => 'smtp.hostinger.com',
    'smtp_puerto' => 465,
    'smtp_seguridad' => 'ssl',          // 'ssl' para el puerto 465 · 'tls' para el 587
    'smtp_usuario' => 'contacto@propzen.cl',
    'smtp_clave' => 'ESCRIBE_AQUI_LA_CLAVE_DEL_CORREO',

    // Casilla que recibe las solicitudes (puede ser otra de tus casillas) y nombre que aparece como remitente
    'destino' => 'contacto@propzen.cl',
    'remitente_nombre' => 'Propzen · Formulario web',

    // Máximo de solicitudes por hora desde una misma conexión (frena el spam)
    'max_por_hora' => 5,

    // Opciones avanzadas de conexión. Déjalo vacío en Hostinger
    'smtp_opciones' => [],
];
