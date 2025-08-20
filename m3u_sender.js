async function sendM3UToServer(targetUrlOverride = null) {
    if (typeof showLoading !== 'function' || typeof currentM3UContent === 'undefined' || typeof userSettings === 'undefined' || typeof currentM3UName === 'undefined' || typeof showNotification !== 'function' || typeof escapeHtml !== 'function') {
        console.error("M3U Sender: Funciones o variables esenciales no están disponibles.");
        if(typeof showNotification === 'function') showNotification("Error interno al intentar enviar M3U.", "error");
        return;
    }

    if (!currentM3UContent) {
        showNotification('No hay lista M3U cargada para enviar.', 'info');
        return;
    }

    const effectiveUrl = targetUrlOverride || userSettings.m3uUploadServerUrl;

    if (!effectiveUrl || !effectiveUrl.trim().startsWith('http')) {
        showNotification('La URL del servidor para enviar M3U no está configurada o es inválida. Configúrala en Ajustes (guarda si es necesario) o introduce una URL válida en la pestaña "Enviar M3U" y pulsa el botón allí.', 'warning');
        return;
    }

    showLoading(true, 'Enviando lista M3U al servidor...');

    try {
        const formData = new FormData();
        formData.append('m3u_content', currentM3UContent);
        formData.append('m3u_name', currentM3UName || 'lista_player_desconocida');

        const response = await fetch(effectiveUrl, {
            method: 'POST',
            body: formData,
        });

        const responseData = await response.json();

        if (response.ok && responseData.success) {
            showNotification(`M3U enviado con éxito al servidor. Guardado como: ${escapeHtml(responseData.filename || 'nombre_desconocido')}`, 'success');
        } else {
            throw new Error(responseData.message || `Error del servidor: ${response.status}`);
        }
    } catch (error) {
        console.error("Error enviando M3U al servidor:", error);
        showNotification(`Error al enviar M3U: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}