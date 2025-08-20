const phpGenerator = (() => {
    let dom = {};

    function cacheDom() {
        const settingsModal = document.getElementById('settingsModal');
        if (!settingsModal) return false;
        
        dom.secretKeyCheck = settingsModal.querySelector('#phpSecretKeyCheck');
        dom.secretKey = settingsModal.querySelector('#phpSecretKey');
        dom.restrictExtIdCheck = settingsModal.querySelector('#phpRestrictToExtensionIdCheck');
        dom.savePath = settingsModal.querySelector('#phpSavePath');
        dom.filenameOriginalRadio = settingsModal.querySelector('#phpFilenameOriginal');
        dom.filenameFixedRadio = settingsModal.querySelector('#phpFilenameFixed');
        dom.fixedFilename = settingsModal.querySelector('#phpFixedFilename');
        dom.addTimestampCheck = settingsModal.querySelector('#phpAddTimestamp');
        dom.overwriteCheck = settingsModal.querySelector('#phpOverwrite');
        dom.generatedCode = settingsModal.querySelector('#generatedPhpCode');
        dom.generateBtn = settingsModal.querySelector('#generatePhpScriptBtn');
        dom.copyBtn = settingsModal.querySelector('#copyPhpScriptBtn');
        
        return dom.generateBtn && dom.copyBtn;
    }

    function init() {
        if (!cacheDom()) {
            console.error("No se pudieron cachear los elementos del DOM para el generador PHP.");
            return;
        }
        dom.generateBtn.addEventListener('click', generatePhpScript);
        dom.copyBtn.addEventListener('click', copyScript);
    }
    
    function generatePhpScript() {
        const useSecretKey = dom.secretKeyCheck.checked;
        const secretKey = dom.secretKey.value.trim();
        const useExtensionIdCheck = dom.restrictExtIdCheck.checked;
        const extensionId = chrome.runtime.id;
        
        const savePath = dom.savePath.value.trim();
        const useFixedFilename = dom.filenameFixedRadio.checked;
        const fixedFilename = dom.fixedFilename.value.trim();
        const addTimestamp = dom.addTimestampCheck.checked;
        const allowOverwrite = dom.overwriteCheck.checked;

        let script = `<?php
// Script generado por DRM Player Avanzado para recibir listas M3U
// Versión: 1.0

// --- Cabeceras ---
// Permiten que la extensión se comunique con este script desde cualquier origen.
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Origin');

// Manejo de la solicitud pre-vuelo (preflight) de CORS
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// --- Configuración ---
`;
        if (useSecretKey) {
            script += `define('SECRET_KEY', '${secretKey.replace(/'/g, "\\'")}'); // Clave secreta para validar la solicitud\n`;
        }
        if (useExtensionIdCheck) {
            script += `define('ALLOWED_EXTENSION_ID', '${extensionId}'); // ID de la extensión de Chrome permitida\n`;
        }
        script += `define('TARGET_DIRECTORY', '${savePath.replace(/'/g, "\\'")}'); // Directorio donde se guardarán las listas. Dejar vacío para el mismo directorio del script.\n`;
        script += `define('USE_FIXED_FILENAME', ${useFixedFilename ? 'true' : 'false'}); // true para usar un nombre de archivo fijo, false para usar el original.\n`;
        script += `define('FIXED_FILENAME', '${fixedFilename.replace(/'/g, "\\'")}'); // Nombre de archivo a usar si USE_FIXED_FILENAME es true.\n`;
        script += `define('ADD_TIMESTAMP', ${addTimestamp ? 'true' : 'false'}); // Añadir fecha y hora al nombre del archivo para evitar sobrescrituras.\n`;
        script += `define('ALLOW_OVERWRITE', ${allowOverwrite ? 'true' : 'false'}); // Permitir sobrescribir archivos si ya existen (ignorado si ADD_TIMESTAMP es true).\n`;

        script += `
// --- Lógica del Script ---

$response = ['success' => false, 'message' => '', 'filename' => ''];

// Verificar el método de la solicitud
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $response['message'] = 'Error: Método no permitido. Solo se acepta POST.';
    http_response_code(405);
    echo json_encode($response);
    exit;
}

// Verificar la clave secreta si está configurada
`;
        if (useSecretKey) {
            script += `
if (defined('SECRET_KEY') && SECRET_KEY !== '') {
    $submittedKey = isset($_POST['secret']) ? $_POST['secret'] : '';
    if ($submittedKey !== SECRET_KEY) {
        $response['message'] = 'Error: Clave secreta inválida.';
        http_response_code(403);
        echo json_encode($response);
        exit;
    }
}
`;
        }
        
        if (useExtensionIdCheck) {
            script += `
// Verificar el origen de la extensión de Chrome si está configurado
if (defined('ALLOWED_EXTENSION_ID') && ALLOWED_EXTENSION_ID !== '') {
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
    if ($origin !== 'chrome-extension://' . ALLOWED_EXTENSION_ID) {
        $response['message'] = 'Error: Solicitud desde un origen no permitido.';
        http_response_code(403);
        echo json_encode($response);
        exit;
    }
}
`;
        }
        
        script += `
// Obtener datos del POST
$m3uContent = isset($_POST['m3u_content']) ? $_POST['m3u_content'] : null;
$originalM3uName = isset($_POST['m3u_name']) ? $_POST['m3u_name'] : 'lista_subida.m3u';

if (empty($m3uContent)) {
    $response['message'] = 'Error: No se recibió contenido M3U (m3u_content).';
    http_response_code(400);
    echo json_encode($response);
    exit;
}

// Determinar el directorio de destino
$targetDir = TARGET_DIRECTORY !== '' ? rtrim(TARGET_DIRECTORY, '/\\\\') : __DIR__;

if (!is_dir($targetDir) || !is_writable($targetDir)) {
    $response['message'] = 'Error: El directorio de destino no existe o no tiene permisos de escritura.';
    http_response_code(500);
    echo json_encode($response);
    exit;
}

// Determinar el nombre del archivo final
$filename = '';
if (USE_FIXED_FILENAME && FIXED_FILENAME !== '') {
    $filename = FIXED_FILENAME;
} else {
    $filename = empty(trim($originalM3uName)) ? 'lista_sin_nombre.m3u' : $originalM3uName;
}

// Asegurarse de que el nombre del archivo tiene la extensión .m3u
if (strtolower(substr($filename, -4)) !== '.m3u') {
    $filename .= '.m3u';
}

// Sanitizar el nombre del archivo para seguridad
$baseFilename = basename($filename);
$safeFilename = preg_replace('/[^\w\s._-]/', '_', $baseFilename);
$safeFilename = preg_replace('/\s+/', '_', $safeFilename);

// Añadir timestamp si está configurado
if (ADD_TIMESTAMP) {
    $nameWithoutExt = pathinfo($safeFilename, PATHINFO_FILENAME);
    $extension = pathinfo($safeFilename, PATHINFO_EXTENSION);
    $timestamp = date('Ymd_His');
    $safeFilename = "{$nameWithoutExt}_{$timestamp}.{$extension}";
}

$targetFilePath = $targetDir . DIRECTORY_SEPARATOR . $safeFilename;

// Comprobar si se permite sobrescribir (solo si no se añade timestamp)
if (!ADD_TIMESTAMP && !ALLOW_OVERWRITE && file_exists($targetFilePath)) {
    $response['message'] = 'Error: El archivo ya existe y no está permitida la sobrescritura.';
    http_response_code(409);
    echo json_encode($response);
    exit;
}

// Guardar el archivo
if (file_put_contents($targetFilePath, $m3uContent) !== false) {
    $response['success'] = true;
    $response['message'] = 'Archivo M3U guardado correctamente en el servidor.';
    $response['filename'] = $safeFilename;
    http_response_code(200);
} else {
    $response['message'] = 'Error: No se pudo escribir el archivo en el servidor.';
    http_response_code(500);
}

// Enviar la respuesta final
echo json_encode($response);
?>
`;
        dom.generatedCode.value = script;
        showNotification("Script PHP generado.", "success");
    }

    function copyScript() {
        if (!dom.generatedCode.value || dom.generatedCode.value.startsWith('Configura')) {
            showNotification("Primero genera un script para poder copiarlo.", "warning");
            return;
        }
        navigator.clipboard.writeText(dom.generatedCode.value).then(() => {
            showNotification("Script PHP copiado al portapapeles.", "success");
        }).catch(err => {
            showNotification("Error al copiar el script. Revisa la consola.", "error");
            console.error('Error al copiar: ', err);
        });
    }

    return {
        init: init
    };
})();