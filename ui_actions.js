function showLoading(show, message = 'Cargando...') {
    const overlay = $('#loading-overlay');
    if (show) {
        overlay.find('.loader').next('span').remove();
        overlay.find('.loader').after(`<span class="ms-2 text-light">${escapeHtml(message)}</span>`);
        overlay.addClass('show');
    } else {
        overlay.removeClass('show');
    }
}

function showNotification(message, type = 'info', duration) {
    if (notificationTimeout) clearTimeout(notificationTimeout);
    const notification = $('#notification');
    notification.text(message).removeClass('success error info warning').addClass(type).addClass('show');

    let effectiveDuration = duration;
    if (effectiveDuration === undefined) {
        effectiveDuration = type === 'error' ? 8000 : type === 'warning' ? 6000 : 4000;
    }

    notificationTimeout = setTimeout(() => {
        notification.removeClass('show');
        notificationTimeout = null;
    }, effectiveDuration);
}

function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') {
    return '';
  }
  return unsafe.replace(/[&<>"']/g, m => ({
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"'
  })[m]);
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

async function showConfirmationModal(message, title = "Confirmación", confirmText = "Confirmar", confirmClass = "btn-primary") {
    return new Promise((resolve) => {
        const modalId = 'genericConfirmationModal';
        let modalElement = document.getElementById(modalId);

        if (!modalElement) {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = `
                <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
                  <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                      <div class="modal-header">
                        <h5 class="modal-title" id="${modalId}Label">${escapeHtml(title)}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                      </div>
                      <div class="modal-body">
                        <p>${escapeHtml(message)}</p>
                      </div>
                      <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn ${escapeHtml(confirmClass)}" id="${modalId}ConfirmBtn">${escapeHtml(confirmText)}</button>
                      </div>
                    </div>
                  </div>
                </div>
            `;
            modalElement = wrapper.firstElementChild;
            document.body.appendChild(modalElement);
        } else {
             $(modalElement).find('.modal-title').text(title);
             $(modalElement).find('.modal-body p').text(message);
             $(modalElement).find(`#${modalId}ConfirmBtn`).text(confirmText).attr('class', `btn ${confirmClass}`);
        }

        const confirmBtn = document.getElementById(`${modalId}ConfirmBtn`);
        const modalInstance = bootstrap.Modal.getOrCreateInstance(document.getElementById(modalId));


        const confirmHandler = () => {
            confirmBtn.removeEventListener('click', confirmHandler);
            modalInstance.hide();
            resolve(true);
        };

        $(modalElement).off('hidden.bs.modal.confirm').one('hidden.bs.modal.confirm', () => {
            confirmBtn.removeEventListener('click', confirmHandler);
            resolve(false);
        });

        $(confirmBtn).off('click.confirm').one('click.confirm', confirmHandler);

        modalInstance.show();
    });
}