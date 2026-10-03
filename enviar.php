<?php
/*
 * Propzen · envío del formulario de contacto (#contacto) a tu correo de Hostinger.
 *
 * script.js manda aquí los datos del formulario (JSON). Este archivo los vuelve a revisar, frena a los bots y envía
 * la solicitud por el SMTP de Hostinger, autenticado como tu casilla, con "Responder a" apuntando al correo del cliente.
 *
 * La clave del correo NO va en este archivo. Va en propzen-mail.config.php (copia propzen-mail.config.example.php):
 *   1) Lo ideal: una carpeta ARRIBA de public_html (por ejemplo domains/propzen.cl/propzen-mail.config.php).
 *      Ahí nadie puede abrirlo desde el navegador.
 *   2) Si no puedes, junto a este archivo en public_html. El .htaccess de la raíz bloquea su acceso desde el navegador.
 */
declare(strict_types=1);

use PHPMailer\PHPMailer\Exception as MailException;
use PHPMailer\PHPMailer\PHPMailer;

require __DIR__ . '/phpmailer/Exception.php';
require __DIR__ . '/phpmailer/PHPMailer.php';
require __DIR__ . '/phpmailer/SMTP.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function responder(int $status, array $cuerpo): void
{
    http_response_code($status);
    echo json_encode($cuerpo, JSON_UNESCAPED_UNICODE);
    exit;
}

// Solo POST y solo desde la misma página (un formulario de otro sitio no puede usar este envío)
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    responder(405, ['ok' => false, 'error' => 'metodo']);
}
$origen = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origen !== '' && parse_url($origen, PHP_URL_HOST) !== parse_url('//' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST)) {
    responder(403, ['ok' => false, 'error' => 'origen']);
}

// Configuración: primero fuera de public_html, si no, junto a este archivo
$cfg = null;
foreach ([dirname(__DIR__) . '/propzen-mail.config.php', __DIR__ . '/propzen-mail.config.php'] as $ruta) {
    if (@is_file($ruta)) {
        $cfg = require $ruta;
        break;
    }
}
if (!is_array($cfg) || empty($cfg['smtp_clave']) || $cfg['smtp_clave'] === 'ESCRIBE_AQUI_LA_CLAVE_DEL_CORREO') {
    error_log('Propzen: falta propzen-mail.config.php o la clave del correo.');
    responder(500, ['ok' => false, 'error' => 'config']);
}

// Datos: JSON de hasta 8 KB
$crudo = file_get_contents('php://input', false, null, 0, 8192);
$datos = json_decode((string) $crudo, true);
if (!is_array($datos)) {
    responder(400, ['ok' => false, 'error' => 'formato']);
}

// Campo trampa: si un bot lo completó, se responde como si todo saliera bien y no se envía nada
if (trim((string) ($datos['web'] ?? '')) !== '') {
    responder(200, ['ok' => true]);
}

// Texto de una línea: sin saltos ni caracteres de control, en UTF-8 válido
$texto = static function (string $campo, int $max) use ($datos): ?string {
    $v = $datos[$campo] ?? '';
    if (!is_string($v) || !preg_match('//u', $v)) {
        return null;
    }
    $v = trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $v));
    return preg_match_all('/./us', $v) <= $max ? $v : null;
};

// Las mismas reglas del formulario (script.js)
$errores = [];
$nombre = $texto('nombre', 80);
if ($nombre === null || $nombre === '') {
    $errores[] = 'nombre';
}
$empresa = $texto('empresa', 120);
if ($empresa === null || $empresa === '') {
    $errores[] = 'empresa';
}
$digitos = preg_replace('/\D/', '', (string) ($texto('telefono', 30) ?? ''));
if (strlen($digitos) === 11 && strncmp($digitos, '569', 3) === 0) {
    $telefono = '+' . $digitos;
} elseif (strlen($digitos) === 9 && $digitos[0] === '9') {
    $telefono = '+56' . $digitos;
} else {
    $telefono = '';
    $errores[] = 'telefono';
}
$email = $texto('email', 120);
if ($email === null || ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL))) {
    $errores[] = 'email';
}
$operacion = $texto('operacion', 40) ?? '';
if (!in_array($operacion, ['', 'Venta', 'Arriendo', 'Venta y arriendo', 'Administración'], true)) {
    $errores[] = 'operacion';
}
$plan = $texto('plan', 40) ?? '';
if (!in_array($plan, ['', 'Estudio', 'Dúplex', 'Penthouse', 'Todavía no lo sé'], true)) {
    $errores[] = 'plan';
}
if (empty($datos['acepto'])) {
    $errores[] = 'acepto';
}
if ($errores) {
    responder(422, ['ok' => false, 'error' => 'datos', 'campos' => $errores]);
}

// Límite de envíos por conexión (por defecto 5 por hora). Se guarda solo una huella de la IP, no la IP
$limite = (int) ($cfg['max_por_hora'] ?? 5);
$carpeta = sys_get_temp_dir() . '/propzen-envios';
if (!is_dir($carpeta)) {
    @mkdir($carpeta, 0700, true);
}
$registro = $carpeta . '/' . hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . $cfg['smtp_clave']) . '.json';
$fp = @fopen($registro, 'c+');
if ($fp) {
    flock($fp, LOCK_EX);
    $ahora = time();
    $marcas = array_filter((array) json_decode((string) stream_get_contents($fp), true), static fn ($t) => is_int($t) && $t > $ahora - 3600);
    if (count($marcas) >= $limite) {
        flock($fp, LOCK_UN);
        fclose($fp);
        responder(429, ['ok' => false, 'error' => 'limite']);
    }
    $marcas[] = $ahora;
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode(array_values($marcas)));
    flock($fp, LOCK_UN);
    fclose($fp);
}

// Correo
$e = static fn (string $s): string => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
$telVisible = substr($telefono, 0, 3) . ' ' . substr($telefono, 3, 1) . ' ' . substr($telefono, 4, 4) . ' ' . substr($telefono, 8);
$meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
$fecha = new DateTimeImmutable('now', new DateTimeZone('America/Santiago'));
$cuando = $fecha->format('j') . ' de ' . $meses[(int) $fecha->format('n') - 1] . ' de ' . $fecha->format('Y') . ', ' . $fecha->format('H:i') . ' (hora de Chile)';
$sitio = parse_url('//' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST) ?: 'la página web';
$sinDato = 'No lo indicó';

$filas = [
    ['Nombre', $e($nombre)],
    ['Corredora', $e($empresa)],
    ['WhatsApp', '<a href="https://wa.me/' . $e(ltrim($telefono, '+')) . '" style="color:#2B241F;font-weight:700">' . $e($telVisible) . '</a>'],
    ['Correo', $email !== '' ? '<a href="mailto:' . $e($email) . '" style="color:#2B241F">' . $e($email) . '</a>' : $sinDato],
    ['Se dedica a', $operacion !== '' ? $e($operacion) : $sinDato],
    ['Plan que le interesa', $plan !== '' ? $e($plan) : $sinDato],
    ['Privacidad', 'Aceptó la Política de Privacidad y que lo contacten'],
];
$html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#2B241F;max-width:560px">'
    . '<p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#2E3D42">Nueva solicitud de demo</p>'
    . '<h1 style="margin:0 0 16px;font-size:22px">' . $e($empresa) . '</h1>'
    . '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:15px">';
foreach ($filas as [$etiqueta, $valor]) {
    $html .= '<tr><td style="padding:9px 12px 9px 0;border-bottom:1px solid #E6DCCB;color:#2E3D42;white-space:nowrap;vertical-align:top">' . $etiqueta . '</td>'
        . '<td style="padding:9px 0;border-bottom:1px solid #E6DCCB">' . $valor . '</td></tr>';
}
$html .= '</table>'
    . '<p style="margin:16px 0 0;font-size:13px;color:#2E3D42">Enviada desde el formulario de ' . $e($sitio) . ' el ' . $e($cuando) . '.'
    . ($email !== '' ? ' Puedes responder este correo para escribirle directamente.' : '') . '</p></div>';

$plano = "Nueva solicitud de demo\n\n";
foreach ([['Nombre', $nombre], ['Corredora', $empresa], ['WhatsApp', $telVisible . ' (https://wa.me/' . ltrim($telefono, '+') . ')'], ['Correo', $email ?: $sinDato], ['Se dedica a', $operacion ?: $sinDato], ['Plan que le interesa', $plan ?: $sinDato]] as [$etiqueta, $valor]) {
    $plano .= $etiqueta . ': ' . $valor . "\n";
}
$plano .= "Privacidad: aceptó la Política de Privacidad y que lo contacten\n\nEnviada desde el formulario de " . $sitio . ' el ' . $cuando . '.';

$mail = new PHPMailer(true);
try {
    $mail->isSMTP();
    $mail->Host = (string) ($cfg['smtp_host'] ?? 'smtp.hostinger.com');
    $mail->Port = (int) ($cfg['smtp_puerto'] ?? 465);
    $seguridad = $cfg['smtp_seguridad'] ?? 'ssl';
    if ($seguridad === 'ssl') {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    } elseif ($seguridad === 'tls') {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    } else {
        $mail->SMTPSecure = '';
        $mail->SMTPAutoTLS = false;
    }
    if (!empty($cfg['smtp_opciones']) && is_array($cfg['smtp_opciones'])) {
        $mail->SMTPOptions = $cfg['smtp_opciones'];
    }
    $mail->SMTPAuth = true;
    $mail->Username = (string) $cfg['smtp_usuario'];
    $mail->Password = (string) $cfg['smtp_clave'];
    $mail->Timeout = 15;
    $mail->CharSet = PHPMailer::CHARSET_UTF8;
    $mail->setFrom((string) $cfg['smtp_usuario'], (string) ($cfg['remitente_nombre'] ?? 'Propzen · Formulario web'));
    $mail->addAddress((string) ($cfg['destino'] ?? $cfg['smtp_usuario']));
    if ($email !== '') {
        $mail->addReplyTo($email, $nombre);
    }
    $mail->Subject = 'Nueva solicitud de demo: ' . $empresa . ' (' . $nombre . ')';
    $mail->isHTML(true);
    $mail->Body = $html;
    $mail->AltBody = $plano;
    $mail->send();
} catch (MailException $ex) {
    error_log('Propzen: no se pudo enviar la solicitud: ' . $mail->ErrorInfo);
    responder(502, ['ok' => false, 'error' => 'envio']);
}

responder(200, ['ok' => true]);
