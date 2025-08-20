function makeWindowsDraggableAndResizable() {
    let activeWindow = null;
    let action = null;
    let offsetX, offsetY, startX, startY, startWidth, startHeight;

    function onMouseDown(e) {
        const target = e.target;
        const draggableWindow = target.closest('.player-window');

        if (!draggableWindow) return;

        if (typeof setActivePlayer === 'function') {
            setActivePlayer(draggableWindow.id);
        }
        
        if (target.classList.contains('resize-handle')) {
            action = 'resize';
        } else if (target.closest('.modal-header-draggable')) {
            action = 'drag';
        } else {
            action = null;
        }

        if (action) {
            e.preventDefault();
            activeWindow = draggableWindow;

            if (action === 'drag') {
                offsetX = e.clientX - activeWindow.getBoundingClientRect().left;
                offsetY = e.clientY - activeWindow.getBoundingClientRect().top;
            } else if (action === 'resize') {
                startX = e.clientX;
                startY = e.clientY;
                startWidth = parseInt(document.defaultView.getComputedStyle(activeWindow).width, 10);
                startHeight = parseInt(document.defaultView.getComputedStyle(activeWindow).height, 10);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
    }

    function onMouseMove(e) {
        if (!activeWindow) return;

        if (action === 'drag') {
            let x = e.clientX - offsetX;
            let y = e.clientY - offsetY;

            const container = document.getElementById('app-container');
            const containerRect = container.getBoundingClientRect();
            const windowRect = activeWindow.getBoundingClientRect();

            x = Math.max(containerRect.left, Math.min(x, containerRect.right - windowRect.width));
            y = Math.max(containerRect.top, Math.min(y, containerRect.bottom - windowRect.height));

            activeWindow.style.left = x + 'px';
            activeWindow.style.top = y + 'px';
        } else if (action === 'resize') {
            const newWidth = startWidth + (e.clientX - startX);
            const newHeight = startHeight + (e.clientY - startY);
            
            activeWindow.style.width = Math.max(400, newWidth) + 'px'; 
            activeWindow.style.height = Math.max(300, newHeight) + 'px'; 
        }
    }

    function onMouseUp() {
        activeWindow = null;
        action = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousedown', onMouseDown);
}