const socket = io();

const isShareUrl =
    window.location.pathname.startsWith('/share/');

const token = localStorage.getItem('token');
const savedShareToken = localStorage.getItem('shareToken');

if (!token && !savedShareToken && !isShareUrl) {
    window.location.href = '/login.html';
}

async function api(url, options = {}) {

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    const token = localStorage.getItem('token');
    const shareToken = localStorage.getItem('shareToken');

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    if (shareToken) {
        headers['x-share-token'] = shareToken;
    }

    options.headers = headers;

    const res = await fetch(url, options);

    if (res.status === 401 && !shareToken) {

        localStorage.removeItem('token');
        localStorage.removeItem('user');

        window.location.href = '/login.html';

        return;
    }

    return res;
}

const board = document.getElementById('board');

const viewport =
    document.getElementById('boardViewport');

const btn = document.getElementById('addNote');
const rectBtn = document.getElementById('addRect');
const lineBtn = document.getElementById('addLine');
const boardsList = document.getElementById('boardsList');
const boardMenu = document.getElementById('boardMenu');
const shareMenu = document.getElementById('shareMenu');
const addBoardBtn = document.getElementById('addBoard');
const shareBtn = document.getElementById('shareBoard');
const logoutBtn = document.getElementById('logoutBtn');

const adminBtn = document.getElementById('adminBtn');

const currentUser =
    JSON.parse(localStorage.getItem('user') || 'null');

if (
    currentUser &&
    currentUser.role === 'admin' &&
    !isShareUrl
) {
    adminBtn.style.display = 'inline-block';
}

adminBtn.onclick = () => {
    window.location.href = '/admin.html';
};

const colors = ['yellow', 'blue', 'green', 'pink'];

const colorHex = {
    yellow: '#facc15',
    blue: '#38bdf8',
    green: '#22c55e',
    pink: '#f472b6'
};

function applyShapeColor(el, color) {

    el.dataset.color = color;

    const hex =
        colorHex[color] || colorHex.blue;

    if (el.dataset.type === 'rect') {

        el.style.borderColor = hex;
        el.style.background = hex + '33';
    }

    if (el.dataset.type === 'line') {

        el.style.background = hex;
    }
}

function openShapeColorMenu(el, e) {

    e.preventDefault();

    document.querySelectorAll('.color-menu')
        .forEach(m => m.remove());

    const menu =
        document.createElement('div');

    menu.className =
        'color-menu';

    colors.forEach(c => {

        const item =
            document.createElement('div');

        item.className =
            'color-item ' + c;

        item.onclick = async () => {

            applyShapeColor(el, c);

            await save(el);

            menu.remove();
        };

        menu.appendChild(item);
    });

    menu.style.left =
        e.pageX + 'px';

    menu.style.top =
        e.pageY + 'px';

    document.body.appendChild(menu);
}

function isTouchPointer(e) {
    return e.pointerType === 'touch' || e.pointerType === 'pen';
}

function openMobileColorMenu(el, clientX, clientY) {

    if (isViewMode) return;

    document.querySelectorAll('.color-menu')
        .forEach(m => m.remove());

    document.querySelectorAll('.palette')
        .forEach(p => p.classList.remove('show'));

    const menu =
        document.createElement('div');

    menu.className =
        'color-menu';

    menu.style.position =
        'fixed';

    colors.forEach(c => {

        const item =
            document.createElement('div');

        item.className =
            'color-item ' + c;

        item.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
        });

        item.onclick = async (e) => {

            e.stopPropagation();

            if (el.dataset.type === 'note') {

                el.className =
                    'note ' + c;

                el.dataset.color =
                    c;

            } else {

                applyShapeColor(el, c);
            }

            await save(el);

            menu.remove();
        };

        menu.appendChild(item);
    });

    document.body.appendChild(menu);

    const menuWidth =
        menu.offsetWidth || 160;

    const menuHeight =
        menu.offsetHeight || 48;

    menu.style.left =
        Math.max(
            8,
            Math.min(clientX, window.innerWidth - menuWidth - 8)
        ) + 'px';

    menu.style.top =
        Math.max(
            8,
            Math.min(clientY, window.innerHeight - menuHeight - 8)
        ) + 'px';
}

function bindMobileColorMenu(el) {

    let longPressTimer = null;
    let startX = 0;
    let startY = 0;

    function clearLongPress() {

        if (longPressTimer) {
            clearTimeout(longPressTimer);
        }

        longPressTimer = null;
    }

    el.addEventListener('pointerdown', (e) => {

        if (isViewMode) return;
        if (!isTouchPointer(e)) return;

        if (e.target.closest('.palette')) return;
        if (e.target.classList.contains('resize-handle')) return;
        if (e.target.classList.contains('line-end-handle')) return;

        startX =
            e.clientX;

        startY =
            e.clientY;

        longPressTimer =
            setTimeout(() => {

                longPressTimer = null;

                openMobileColorMenu(
                    el,
                    startX,
                    startY
                );

            }, 550);
    });

    el.addEventListener('pointermove', (e) => {

        if (!longPressTimer) return;

        const distance =
            Math.hypot(
                e.clientX - startX,
                e.clientY - startY
            );

        if (distance > 8) {
            clearLongPress();
        }
    });

    el.addEventListener('pointerup', clearLongPress);
    el.addEventListener('pointercancel', clearLongPress);
    el.addEventListener('pointerleave', clearLongPress);
}

function bindMobileNoteEditing(noteEl, contentEl) {

    let lastTapTime = 0;

    contentEl.addEventListener('pointerup', (e) => {

        if (isViewMode) return;
        if (!isTouchPointer(e)) return;
        if (contentEl.isContentEditable) return;

        const now =
            Date.now();

        if (now - lastTapTime < 350) {

            e.preventDefault();
            e.stopPropagation();

            noteEl.dataset.editing =
                'true';

            contentEl.contentEditable =
                true;

            contentEl.focus();

            const range =
                document.createRange();

            const selection =
                window.getSelection();

            range.selectNodeContents(contentEl);
            range.collapse(false);

            selection.removeAllRanges();
            selection.addRange(range);

            lastTapTime = 0;

            return;
        }

        lastTapTime =
            now;
    });
}

let boardId = null;
let isViewMode = false;
let isShareMode = false;

let boardOffsetX = 0;
let boardOffsetY = 0;

let boardScale = 1;

const BOARD_WIDTH = 5000;
const BOARD_HEIGHT = 5000;

const NOTE_MIN_WIDTH = 120;
const NOTE_MIN_HEIGHT = 80;

function getNoteMinSize(noteEl, targetWidth = null) {

    if (!noteEl || noteEl.dataset.type !== 'note') {
        return {
            width: NOTE_MIN_WIDTH,
            height: NOTE_MIN_HEIGHT
        };
    }

    const content =
        noteEl.querySelector('.note-content');

    if (!content) {
        return {
            width: NOTE_MIN_WIDTH,
            height: NOTE_MIN_HEIGHT
        };
    }

    const noteStyle =
        window.getComputedStyle(noteEl);

    const contentStyle =
        window.getComputedStyle(content);

    const paddingLeft =
        parseFloat(noteStyle.paddingLeft) || 0;

    const paddingRight =
        parseFloat(noteStyle.paddingRight) || 0;

    const paddingTop =
        parseFloat(noteStyle.paddingTop) || 0;

    const paddingBottom =
        parseFloat(noteStyle.paddingBottom) || 0;

    const text =
        content.innerText || '';

    const words =
        text
            .replace(/\n/g, ' ')
            .split(/\s+/)
            .filter(Boolean);

    const canvas =
        document.createElement('canvas');

    const ctx =
        canvas.getContext('2d');

    ctx.font =
        contentStyle.font ||
        `${contentStyle.fontSize} ${contentStyle.fontFamily}`;

    let longestWordWidth = 0;

    words.forEach(word => {

        const measured =
            ctx.measureText(word).width;

        if (measured > longestWordWidth) {
            longestWordWidth = measured;
        }
    });

    const requiredWidth =
        Math.ceil(
            longestWordWidth +
            paddingLeft +
            paddingRight +
            10
        );

    const minWidth =
        Math.max(
            NOTE_MIN_WIDTH,
            requiredWidth
        );

    const noteWidth =
        Math.max(
            targetWidth || noteEl.offsetWidth || minWidth,
            minWidth
        );

    const contentWidth =
        Math.max(
            1,
            noteWidth - paddingLeft - paddingRight
        );

    const measurer =
        document.createElement('div');

    measurer.style.position = 'absolute';
    measurer.style.visibility = 'hidden';
    measurer.style.pointerEvents = 'none';
    measurer.style.left = '-9999px';
    measurer.style.top = '-9999px';

    measurer.style.width =
        contentWidth + 'px';

    measurer.style.font =
        contentStyle.font;

    measurer.style.fontSize =
        contentStyle.fontSize;

    measurer.style.fontFamily =
        contentStyle.fontFamily;

    measurer.style.fontWeight =
        contentStyle.fontWeight;

    measurer.style.lineHeight =
        contentStyle.lineHeight;

    measurer.style.whiteSpace =
        'pre-wrap';

    measurer.style.overflowWrap =
        'normal';

    measurer.style.wordBreak =
        'normal';

    measurer.innerText =
        text;

    document.body.appendChild(measurer);

    const textHeight =
        measurer.scrollHeight;

    document.body.removeChild(measurer);

    const requiredHeight =
        textHeight +
        paddingTop +
        paddingBottom +
        18;

    return {
        width: minWidth,
        height: Math.max(
            NOTE_MIN_HEIGHT,
            requiredHeight
        )
    };
}

function normalizeNoteSize(noteEl) {

    if (!noteEl || noteEl.dataset.type !== 'note') return;

    const minSize =
        getNoteMinSize(noteEl, noteEl.offsetWidth);

    if (noteEl.offsetWidth < minSize.width) {
        noteEl.style.width =
            minSize.width + 'px';
    }

    if (noteEl.offsetHeight < minSize.height) {
        noteEl.style.height =
            minSize.height + 'px';
    }
}

// ================= INIT =================
async function init() {

    const params = new URLSearchParams(window.location.search);

    const boardFromUrl = params.get('board');
    const mode = params.get('mode');

    const isShareUrl =
        window.location.pathname.startsWith('/share/');

    const shareTokenFromUrl =
        isShareUrl
            ? window.location.pathname.split('/')[2]
            : null;

    let boards = [];

    if (shareTokenFromUrl) {

        const res =
            await fetch('/api/share/' + shareTokenFromUrl);

        if (!res.ok) {

            document.body.innerHTML =
                '<h1 style="padding:30px;">Недійсне або застаріле посилання доступу</h1>';

            return;
        }

        const data =
            await res.json();

        localStorage.setItem(
            'shareToken',
            shareTokenFromUrl
        );

        boardId =
            parseInt(data.board_id);

        isShareMode = true;

        if (data.mode === 'view') {
            isViewMode = true;
        }

        boards = [
            {
                id: boardId,
                title: data.title || 'Спільна дошка'
            }
        ];

    } else {

        localStorage.removeItem('shareToken');

        let res =
            await api('/api/boards');

        boards =
            await res.json();

        if (boards.length === 0) {

            let b =
                await api(
                    '/api/boards',
                    {
                        method: 'POST'
                    }
                );

            let data =
                await b.json();

            boardId =
                data.id;

            boards =
                [data];

            } else {

                const requestedBoardId =
                    boardFromUrl
                        ? parseInt(boardFromUrl)
                        : null;

                const requestedBoardExists =
                    requestedBoardId &&
                    boards.some(b => b.id === requestedBoardId);

                if (requestedBoardExists) {

                    boardId =
                        requestedBoardId;

                } else {

                    boardId =
                        boards[0].id;

                    history.replaceState(
                        null,
                        '',
                        `?board=${boardId}`
                    );
                }
            }
    }

    socket.emit('join-board', boardId);

    if (isShareMode) {

        addBoardBtn.style.display = 'none';
        shareBtn.style.display = 'none';
        adminBtn.style.display = 'none';
    }

    if (isViewMode) {

        btn.style.display = 'none';
        rectBtn.style.display = 'none';
        lineBtn.style.display = 'none';
        addBoardBtn.style.display = 'none';
        shareBtn.style.display = 'none';
        adminBtn.style.display = 'none';

        const info =
            document.createElement('div');

        info.innerText =
            'Режим перегляду';

        info.style.position = 'fixed';
        info.style.bottom = '20px';
        info.style.right = '20px';
        info.style.background = '#1e293b';
        info.style.padding = '10px 14px';
        info.style.borderRadius = '10px';
        info.style.zIndex = '9999';

        document.body.appendChild(info);
    }

    renderBoards(boards);
    loadNotes();
}

// ================= LOAD =================
async function loadNotes() {

    if (!boardId) {
        board.innerHTML = '';
        return;
    }

    const res =
        await api(`/api/boards/${boardId}/elements`);

    if (!res) {
        return;
    }

    if (!res.ok) {

        const errorData =
            await res.json().catch(() => ({}));

        console.warn(
            'Cannot load board elements:',
            errorData
        );

        board.innerHTML = '';

        // Якщо немає доступу до дошки — прибираємо старий board з URL
        if (res.status === 403 || res.status === 404) {

            if (!isShareMode) {

                history.replaceState(
                    null,
                    '',
                    '/'
                );
            }

            alert(
                'Немає доступу до цієї дошки або вона була видалена'
            );
        }

        return;
    }

    const notes =
        await res.json();

    if (!Array.isArray(notes)) {

        console.warn(
            'Expected array, got:',
            notes
        );

        board.innerHTML = '';
        return;
    }

    board.innerHTML = '';

    notes.forEach(createElement);
}

// ================= CREATE =================
function createElement(n) {

    let color = 'yellow';

    if (n.type === 'note') {
        color = n.color || colors[Math.floor(Math.random() * colors.length)];
    }

    // =========================
    // TYPE
    // =========================
    if (n.type === 'rect') {
        const div = document.createElement('div');
        div.className = 'rect';
        div.dataset.type = 'rect';

        div.style.left = n.x + 'px';
        div.style.top = n.y + 'px';
        div.style.width = (n.width || 160) + 'px';
        div.style.height = (n.height || 100) + 'px';

        div.dataset.id = n.id;

        div.dataset.color = n.color || 'blue';
        applyShapeColor(div, div.dataset.color);

        // DELETE
        div.oncontextmenu = async (e) => {

            e.preventDefault();

            if (isViewMode) return;

            if (e.shiftKey) {

                await api(`/api/elements/${n.id}`, {
                    method: 'DELETE'
                });

                socket.emit('element-delete', {
                    boardId,
                    id: n.id
                });

                div.remove();

                return;
            }

            openShapeColorMenu(div, e);
        };

        bindMobileColorMenu(div);

        // DRAG
        div.onpointerdown = (e) => {
            if (e.button === 2) return;
            startDrag(e);
        };

        // RESIZE
        const resize = document.createElement('div');
        resize.className = 'resize-handle';

        resize.onpointerdown = (e) => {
            e.stopPropagation();
            startResize(e, div);
        };

        div.appendChild(resize);
        board.appendChild(div);
        return;
    }

    if (n.type === 'line') {
        const div = document.createElement('div');
        div.className = 'line';
        div.dataset.type = 'line';

        div.style.left = n.x + 'px';
        div.style.top = n.y + 'px';
        div.style.width = (n.width || 150) + 'px';
        div.style.height = '2px';

        div.dataset.id = n.id;

        div.dataset.rotation =
            n.rotation || 0;

        div.style.transform =
            `rotate(${div.dataset.rotation}deg)`;

        div.dataset.color = n.color || 'green';
        applyShapeColor(div, div.dataset.color);

        // DELETE
        div.oncontextmenu = async (e) => {

            e.preventDefault();

            if (isViewMode) return;

            if (e.shiftKey) {

                await api(`/api/elements/${n.id}`, {
                    method: 'DELETE'
                });

                socket.emit('element-delete', {
                    boardId,
                    id: n.id
                });

                div.remove();

                return;
            }

            openShapeColorMenu(div, e);
        };

        bindMobileColorMenu(div);

        // DRAG
        div.onpointerdown = (e) => {
            if (e.button === 2) return;
            startDrag(e);
        };

        const lineHandle =
            document.createElement('div');

        lineHandle.className =
            'line-end-handle';

        lineHandle.onpointerdown = (e) => {
            startLineTransform(e, div);
        };

        div.appendChild(lineHandle);
        
        board.appendChild(div);
        return;
    }

    // =========================
    // NOTE (твій старий код)
    // =========================

    

    //NOTE
    const div = document.createElement('div');
    div.className = 'note ' + color;
    div.dataset.type = 'note';

    div.style.left = n.x + 'px';
    div.style.top = n.y + 'px';
    div.style.width = (n.width || 160) + 'px';
    div.style.height = (n.height || 100) + 'px';

    const content = document.createElement('div');
    content.className = 'note-content';
    content.innerText = n.text;

    div.appendChild(content);

    // ===== COLOR PICKER =====
    const palette = document.createElement('div');
    palette.className = 'palette';

    colors.forEach(c => {
        const btn = document.createElement('div');
        btn.className = 'color ' + c;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            div.className = 'note ' + c;
            div.dataset.color = c;
            save(div);
        });

        palette.appendChild(btn);
    });

    div.appendChild(palette);

    div.addEventListener('click', (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        if (e.target.closest('.palette')) return;
        palette.classList.toggle('show');
    });

    // EDIT
    content.ondblclick = () => {

        if (isViewMode) return;

        div.dataset.editing = 'true';

        content.contentEditable = true;
        content.focus();
    };

    bindMobileNoteEditing(div, content);

    content.oninput = () => {
        normalizeNoteSize(div);
    };

    content.onblur = () => {

        content.contentEditable = false;

        div.dataset.editing = 'false';

        normalizeNoteSize(div);

        save(div);
    };

    // DELETE + COLOR MENU
        div.oncontextmenu = async (e) => {
            e.preventDefault();

            if (isViewMode) return;

            if (e.shiftKey) {
            await api(`/api/elements/${n.id}`, { method: 'DELETE' });

            socket.emit('element-delete', {
                boardId,
                id: n.id
            });

            div.remove();
            return;
        }

        document.querySelectorAll('.color-menu').forEach(m => m.remove());

        const menu = document.createElement('div');
        menu.className = 'color-menu';

        colors.forEach(c => {
            const item = document.createElement('div');
            item.className = 'color-item ' + c;

            item.onclick = async () => {
                div.className = 'note ' + c;
                div.dataset.color = c;
                await save(div);
                menu.remove();
            };

            menu.appendChild(item);
        });

        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';

        document.body.appendChild(menu);
    };

    bindMobileColorMenu(div);

    // DRAG
    div.onpointerdown = (e) => {

        if (e.button === 2) return;
        if (e.target.closest('.palette')) return;
        if (e.target.classList.contains('resize-handle')) return;

        if (
            div.dataset.editing === 'true' ||
            (
                e.target.classList.contains('note-content') &&
                e.target.isContentEditable
            )
        ) {
            return;
        }

        startDrag(e);
    };

    // RESIZE
    const resize = document.createElement('div');
    resize.className = 'resize-handle';

    resize.onpointerdown = (e) => {
        e.stopPropagation();
        startResize(e, div);
    };

    div.appendChild(resize);

    div.dataset.id = n.id;
    div.dataset.color = color;

    board.appendChild(div);

    normalizeNoteSize(div);
}

function clampBoardPosition(){

    const viewportWidth =
        viewport.clientWidth;

    const viewportHeight =
        viewport.clientHeight;

    const scaledWidth =
        BOARD_WIDTH * boardScale;

    const scaledHeight =
        BOARD_HEIGHT * boardScale;

    if (scaledWidth <= viewportWidth) {

        boardOffsetX =
            (viewportWidth - scaledWidth) / 2;

    } else {

        const maxX = 0;
        const minX =
            viewportWidth - scaledWidth;

        boardOffsetX =
            Math.min(
                maxX,
                Math.max(minX, boardOffsetX)
            );
    }

    if (scaledHeight <= viewportHeight) {

        boardOffsetY =
            (viewportHeight - scaledHeight) / 2;

    } else {

        const maxY = 0;
        const minY =
            viewportHeight - scaledHeight;

        boardOffsetY =
            Math.min(
                maxY,
                Math.max(minY, boardOffsetY)
            );
    }
}

function updateBoardTransform(){

    clampBoardPosition();

    board.style.transform =
        `translate(${boardOffsetX}px, ${boardOffsetY}px)
         scale(${boardScale})`;
}

function getViewportCenterPoint() {

    const viewportRect =
        viewport.getBoundingClientRect();

    return {
        x: ((viewportRect.width / 2) - boardOffsetX) / boardScale,
        y: ((viewportRect.height / 2) - boardOffsetY) / boardScale
    };
}

// ================= ADD =================
btn.onclick = async () => {

    const res = await api('/api/elements', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            board_id: boardId,
            x: getViewportCenterPoint().x,
            y: getViewportCenterPoint().y,
            text: 'Нотатка',
            type: 'note',
            color: 'yellow',
            rotation: 0
        })
    });

    if (!res || !res.ok) {
        alert('Не вдалося створити нотатку');
        return;
    }

    const note =
        await res.json();

    if (!note.id) {
        alert('Сервер не повернув id нотатки');
        return;
    }

    createElement(note);

    socket.emit('element-create', {
        boardId,
        element: note
    });
};

rectBtn.onclick = async () => {

    const res = await api('/api/elements', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            board_id: boardId,
            x: getViewportCenterPoint().x,
            y: getViewportCenterPoint().y,
            width: 160,
            height: 100,
            text: '',
            type: 'rect',
            color: 'blue',
            rotation: 0
        })
    });

    if (!res || !res.ok) {
        alert('Не вдалося створити прямокутник');
        return;
    }

    const el =
        await res.json();

    if (!el.id) {
        alert('Сервер не повернув id прямокутника');
        return;
    }

    createElement(el);

    socket.emit('element-create', {
        boardId,
        element: el
    });
};

lineBtn.onclick = async () => {

    const res = await api('/api/elements', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            board_id: boardId,
            x: getViewportCenterPoint().x,
            y: getViewportCenterPoint().y,
            width: 150,
            height: 2,
            text: '',
            type: 'line',
            color: 'green',
            rotation: 0
        })
    });

    if (!res || !res.ok) {
        alert('Не вдалося створити лінію');
        return;
    }

    const el =
        await res.json();

    if (!el.id) {
        alert('Сервер не повернув id лінії');
        return;
    }

    createElement(el);

    socket.emit('element-create', {
        boardId,
        element: el
    });
};

addBoardBtn.onclick = async () => {

    const res = await api('/api/boards', {
        method: 'POST'
    });

    if (!res || !res.ok) {
        alert('Не вдалося створити дошку');
        return;
    }

    const newBoard = await res.json();

    if (!newBoard.id) {
        alert('Сервер не повернув id дошки');
        return;
    }

    const boardsRes = await api('/api/boards');

    if (!boardsRes || !boardsRes.ok) {
        alert('Не вдалося оновити список дошок');
        return;
    }

    const boards = await boardsRes.json();

    boardId = newBoard.id;

    history.replaceState(
        null,
        '',
        `?board=${boardId}`
    );

    socket.emit('join-board', boardId);

    renderBoards(boards);
    loadNotes();
};

// ================= SHARE =================
shareBtn.onclick = (e) => {

    shareMenu.innerHTML = '';

    // ===== VIEW LINK =====
    const view = document.createElement('div');
    view.className = 'board-menu-item';
    view.innerText = '👁 для перегляду';

    view.onclick = async () => {

    const res = await api(
        `/api/boards/${boardId}/share`,
        {
            method: 'POST',
            body: JSON.stringify({
                mode: 'view'
            })
        }
    );

    if (!res || !res.ok) {
        alert('Не вдалося створити посилання для перегляду');
        return;
    }

    const data = await res.json();

    if (!data.token) {
        alert('Сервер не повернув токен доступу');
        return;
    }

    const link =
        `${window.location.origin}/share/${data.token}`;

        try {
            await navigator.clipboard.writeText(link);

            alert('Посилання для перегляду скопійовано\n' + link);

        } catch (err) {

            prompt(
                'Скопіюйте посилання вручну:',
                link
            );
        }

        shareMenu.style.display = 'none';
    };

    // ===== EDIT LINK =====
    const edit = document.createElement('div');
    edit.className = 'board-menu-item';
    edit.innerText = '✏️ для редагування';

    edit.onclick = async () => {

    const res = await api(
        `/api/boards/${boardId}/share`,
        {
            method: 'POST',
            body: JSON.stringify({
                mode: 'edit'
            })
        }
    );

    if (!res || !res.ok) {
        alert('Не вдалося створити посилання для редагування');
        return;
    }

    const data = await res.json();

    if (!data.token) {
        alert('Сервер не повернув токен доступу');
        return;
    }

    const link =
        `${window.location.origin}/share/${data.token}`;

        try {
            await navigator.clipboard.writeText(link);

            alert('Посилання для редагування скопійовано\n' + link);

        } catch (err) {

            prompt(
                'Скопіюйте посилання вручну:',
                link
            );
        }

        shareMenu.style.display = 'none';
    };

    shareMenu.appendChild(view);
    shareMenu.appendChild(edit);

    const rect = shareBtn.getBoundingClientRect();

    shareMenu.style.left = rect.left + 'px';
    shareMenu.style.top = (rect.bottom + 8) + 'px';

    shareMenu.style.display = 'flex';
};

viewport.addEventListener('wheel', (e) => {

    e.preventDefault();

    const viewportRect =
        viewport.getBoundingClientRect();

    const mouseX =
        e.clientX - viewportRect.left;

    const mouseY =
        e.clientY - viewportRect.top;

    const oldScale =
        boardScale;

    const worldX =
        (mouseX - boardOffsetX) / oldScale;

    const worldY =
        (mouseY - boardOffsetY) / oldScale;

    const zoomFactor =
        e.deltaY > 0 ? 0.9 : 1.1;

    boardScale =
        boardScale * zoomFactor;

    boardScale =
        Math.max(0.2, Math.min(3, boardScale));

    boardOffsetX =
        mouseX - worldX * boardScale;

    boardOffsetY =
        mouseY - worldY * boardScale;

    updateBoardTransform();

}, { passive: false });

let pinchStartDistance = null;
let pinchStartScale = 1;
let pinchWorldX = 0;
let pinchWorldY = 0;
let pinchCenterX = 0;
let pinchCenterY = 0;

function getTouchDistance(e) {

    const dx =
        e.touches[0].clientX - e.touches[1].clientX;

    const dy =
        e.touches[0].clientY - e.touches[1].clientY;

    return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCenter(e) {

    const viewportRect =
        viewport.getBoundingClientRect();

    return {
        x: ((e.touches[0].clientX + e.touches[1].clientX) / 2) - viewportRect.left,
        y: ((e.touches[0].clientY + e.touches[1].clientY) / 2) - viewportRect.top
    };
}

viewport.addEventListener('touchstart', (e) => {

    if (e.touches.length !== 2) return;

    e.preventDefault();

    isPanning = false;

    pinchStartDistance =
        getTouchDistance(e);

    pinchStartScale =
        boardScale;

    const center =
        getTouchCenter(e);

    pinchCenterX =
        center.x;

    pinchCenterY =
        center.y;

    pinchWorldX =
        (pinchCenterX - boardOffsetX) / boardScale;

    pinchWorldY =
        (pinchCenterY - boardOffsetY) / boardScale;

}, { passive: false });

viewport.addEventListener('touchmove', (e) => {

    if (e.touches.length !== 2 || !pinchStartDistance) return;

    e.preventDefault();

    const currentDistance =
        getTouchDistance(e);

    const scaleFactor =
        currentDistance / pinchStartDistance;

    boardScale =
        pinchStartScale * scaleFactor;

    boardScale =
        Math.max(0.2, Math.min(3, boardScale));

    boardOffsetX =
        pinchCenterX - pinchWorldX * boardScale;

    boardOffsetY =
        pinchCenterY - pinchWorldY * boardScale;

    updateBoardTransform();

}, { passive: false });

viewport.addEventListener('touchend', (e) => {

    if (e.touches.length < 2) {
        pinchStartDistance = null;
    }

}, { passive: false });

viewport.addEventListener('touchcancel', () => {
    pinchStartDistance = null;
}, { passive: false });

// ================= SAVE =================
async function save(el) {

    if (!el) return;

    const id =
        el.dataset.id;

    if (!id || id === 'undefined') {
        console.warn('Save skipped: element has no id', el);
        return;
    }

    const x =
        Number.isFinite(parseFloat(el.style.left))
            ? parseFloat(el.style.left)
            : 100;

    const y =
        Number.isFinite(parseFloat(el.style.top))
            ? parseFloat(el.style.top)
            : 100;

    const width =
        Number.isFinite(el.offsetWidth)
            ? el.offsetWidth
            : 160;

    const height =
        el.dataset.type === 'line'
            ? 2
            : (
                Number.isFinite(el.offsetHeight)
                    ? el.offsetHeight
                    : 100
            );

    const rotation =
        Number.isFinite(parseFloat(el.dataset.rotation))
            ? parseFloat(el.dataset.rotation)
            : 0;

    const payload = {
        x,
        y,
        text: el.querySelector('.note-content')?.innerText || '',
        width,
        height,
        color: el.dataset.color || 'yellow',
        type: el.dataset.type || 'note',
        rotation
    };

    const res =
        await api(`/api/elements/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

    if (!res || !res.ok) {
        console.warn('Save failed', payload);
        return;
    }

    socket.emit('element-update', {
        boardId,
        id,
        ...payload
    });
}

let isPanning = false;

let panStartX = 0;
let panStartY = 0;

viewport.addEventListener('pointerdown', (e) => {

    const clickedElement =
        e.target.closest(
            '.note, .rect, .line, .resize-handle, .line-end-handle, button, .board-item, .board-menu-item, .color-menu, .color-item, .palette'
        );

    // ПК: дошка рухається середньою кнопкою навіть по елементу.
    // Телефон: дошка рухається одним пальцем тільки по порожньому місцю.
    if (clickedElement && !(e.pointerType === 'mouse' && e.button === 1)) return;

    if (e.pointerType === 'mouse' && e.button !== 1) return;

    e.preventDefault();

    isPanning = true;

    if (isTouchPointer(e) && viewport.setPointerCapture) {
        viewport.setPointerCapture(e.pointerId);
    }

    panStartX =
        e.clientX - boardOffsetX;

    panStartY =
        e.clientY - boardOffsetY;
});

document.addEventListener('pointermove', (e) => {

    if(!isPanning) return;

    if (isTouchPointer(e)) {
        e.preventDefault();
    }

    boardOffsetX =
        e.clientX - panStartX;

    boardOffsetY =
        e.clientY - panStartY;

    updateBoardTransform();
});

document.addEventListener('pointerup', () => {

    isPanning = false;
});

document.addEventListener('pointercancel', () => {

    isPanning = false;
});

function getBoardPoint(e) {

    const viewportRect =
        viewport.getBoundingClientRect();

    return {
        x: (e.clientX - viewportRect.left - boardOffsetX) / boardScale,
        y: (e.clientY - viewportRect.top - boardOffsetY) / boardScale
    };
}

// ================= DRAG =================
let active = null, offsetX, offsetY;

function startDrag(e) {

    if (isViewMode) return;
    if (e.target.classList.contains('resize-handle')) return;
    if (e.target.classList.contains('line-end-handle')) return;

    // ПК: елемент рухається тільки лівою кнопкою.
    // Середня кнопка лишається для руху дошки.
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    // На телефоні блокуємо стандартні touch-жести браузера тільки під час drag.
    // На ПК preventDefault не ставимо, щоб не ламати dblclick редагування тексту.
    if (isTouchPointer(e)) {
        e.preventDefault();

        if (e.currentTarget.setPointerCapture) {
            e.currentTarget.setPointerCapture(e.pointerId);
        }
    }

    const targetElement =
        e.currentTarget;

    if (
        targetElement.dataset.type === 'note' &&
        targetElement.dataset.editing === 'true'
    ) {
        return;
    }

    if (
        e.target.classList.contains('note-content') &&
        e.target.isContentEditable
    ) {
        return;
    }

    active = targetElement;

    const point =
        getBoardPoint(e);

    offsetX =
        point.x - parseFloat(active.style.left || 0);

    offsetY =
        point.y - parseFloat(active.style.top || 0);

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', stopDrag);
}

function move(e) {

    if (!active) return;

    if (isTouchPointer(e)) {
        e.preventDefault();
    }

    const point =
        getBoardPoint(e);

    active.style.left =
        (point.x - offsetX) + 'px';

    active.style.top =
        (point.y - offsetY) + 'px';
}

function stopDrag() {
    save(active);
    active = null;

    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', stopDrag);
}

// ================= RESIZE =================
let resizing = null, startW, startH, startX, startY;

function startResize(e, el) {
    if (isViewMode) return;

    if (isTouchPointer(e)) {
        e.preventDefault();

        if (e.currentTarget.setPointerCapture) {
            e.currentTarget.setPointerCapture(e.pointerId);
        }
    }

    resizing = el;

    startW = el.offsetWidth;
    startH = el.offsetHeight;
    startX = e.clientX;
    startY = e.clientY;

    document.addEventListener('pointermove', resizeMove);
    document.addEventListener('pointerup', stopResize);
}

function resizeMove(e) {

    if (!resizing) return;

    if (isTouchPointer(e)) {
        e.preventDefault();
    }

    if (resizing.dataset.type === 'line') {

        resizing.style.width =
            Math.max(
                50,
                startW + ((e.clientX - startX) / boardScale)
            ) + 'px';

        resizing.style.height =
            '2px';

        return;
    }

    if (resizing.dataset.type === 'note') {

        const rawTargetWidth =
            startW + ((e.clientX - startX) / boardScale);

        const minSize =
            getNoteMinSize(
                resizing,
                rawTargetWidth
            );

        const targetWidth =
            Math.max(
                minSize.width,
                rawTargetWidth
            );

        const targetHeight =
            Math.max(
                minSize.height,
                startH + ((e.clientY - startY) / boardScale)
            );

        resizing.style.width =
            targetWidth + 'px';

        resizing.style.height =
            targetHeight + 'px';

        return;
    }

    resizing.style.width =
        Math.max(
            100,
            startW + ((e.clientX - startX) / boardScale)
        ) + 'px';

    resizing.style.height =
        Math.max(
            80,
            startH + ((e.clientY - startY) / boardScale)
        ) + 'px';
}

function stopResize() {

    if (resizing && resizing.dataset.type === 'note') {
        normalizeNoteSize(resizing);
    }

    save(resizing);
    resizing = null;

    document.removeEventListener('pointermove', resizeMove);
    document.removeEventListener('pointerup', stopResize);
}

let lineEditing = null;

function startLineTransform(e, el) {

    if (isViewMode) return;

    e.preventDefault();
    e.stopPropagation();

    lineEditing = el;

    document.addEventListener('pointermove', lineTransformMove);
    document.addEventListener('pointerup', stopLineTransform);
}

function lineTransformMove(e) {

    if (!lineEditing) return;

    const point =
        getBoardPoint(e);

    const startX =
        parseFloat(lineEditing.style.left || 0);

    const startY =
        parseFloat(lineEditing.style.top || 0);

    const dx =
        point.x - startX;

    const dy =
        point.y - startY;

    const length =
        Math.max(
            50,
            Math.sqrt(dx * dx + dy * dy)
        );

    const angle =
        Math.atan2(dy, dx) * 180 / Math.PI;

    lineEditing.style.width =
        length + 'px';

    lineEditing.style.height =
        '2px';

    lineEditing.dataset.rotation =
        angle;

    lineEditing.style.transform =
        `rotate(${angle}deg)`;
}

function stopLineTransform() {

    if (lineEditing) {
        save(lineEditing);
    }

    lineEditing = null;

    document.removeEventListener('pointermove', lineTransformMove);
    document.removeEventListener('pointerup', stopLineTransform);
}

logoutBtn.onclick = () => {

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('shareToken');

    window.location.href = '/login.html';
};

// ================= START =================
function centerBoard(){

    const viewportWidth =
        viewport.clientWidth;

    const viewportHeight =
        viewport.clientHeight;

    boardOffsetX =
        (viewportWidth / 2) -
        (BOARD_WIDTH * boardScale / 2);

    boardOffsetY =
        (viewportHeight / 2) -
        (BOARD_HEIGHT * boardScale / 2);

    updateBoardTransform();
}

centerBoard();

init();

document.addEventListener('click', () => {
    document.querySelectorAll('.palette').forEach(p => {
        p.classList.remove('show');
    });
});

document.addEventListener('click', (e) => {
    if (e.button === 2) return; // не закривати при ПКМ

    document.querySelectorAll('.color-menu').forEach(m => m.remove());
});

function renderBoards(boards) {
    boardsList.innerHTML = '';

    boards.forEach(b => {
        const item = document.createElement('div');
        item.className = 'board-item';
        item.innerText = b.title || 'Нова дошка';

        // ACTIVE
        if (b.id === boardId) {
            item.style.background = '#1e293b';
        }

        // CLICK → switch
        item.addEventListener('mousedown', (e) => {

            if (isShareMode) return;

            if (e.button !== 0) return;

            if (item.isContentEditable) return;

            boardId = b.id;

            socket.emit('join-board', boardId);

            history.pushState(null, '', `?board=${b.id}`);

            loadNotes();
            renderBoards(boards);
        });

        // ✏️ EDIT TITLE
        item.oncontextmenu = (e) => {

            if (isShareMode || isViewMode) return;

            e.preventDefault();

            boardMenu.innerHTML = '';

            // ===== RENAME =====
            const rename = document.createElement('div');
            rename.className = 'board-menu-item';
            rename.innerText = '✏️ Перейменувати';

            rename.onclick = () => {
                boardMenu.style.display = 'none';

                item.contentEditable = true;
                item.focus();
                
                item.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        item.blur();
                    }
                };

                document.execCommand('selectAll', false, null);
                document.getSelection().collapseToEnd();

                item.onblur = async () => {
                    item.contentEditable = false;

                    const updateRes = await api(`/api/boards/${b.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            title: item.innerText.trim() || 'Нова дошка'
                        })
                    });

                    if (!updateRes || !updateRes.ok) {
                        alert('Не вдалося перейменувати дошку');
                        item.innerText = b.title || 'Нова дошка';
                        return;
                    }

                    const res = await api('/api/boards');

                    if (!res || !res.ok) {
                        return;
                    }

                    const boards = await res.json();

                    renderBoards(boards);
                };
            };

            // ===== DELETE =====
            const del = document.createElement('div');
            del.className = 'board-menu-item';
            del.innerText = '🗑 Видалити';

            del.onclick = async () => {

                boardMenu.style.display = 'none';

                const deleteRes = await api(`/api/boards/${b.id}`, {
                    method: 'DELETE'
                });

                if (!deleteRes || !deleteRes.ok) {
                    alert('Не вдалося видалити дошку');
                    return;
                }

                const res =
                    await api('/api/boards');

                if (!res || !res.ok) {
                    alert('Не вдалося оновити список дошок');
                    return;
                }

                let boards =
                    await res.json();

                if (boards.length === 0) {

                    const createRes =
                        await api('/api/boards', {
                            method: 'POST'
                        });

                    const newBoard =
                        await createRes.json();

                    boards = [newBoard];
                    boardId = newBoard.id;

                } else {

                    boardId =
                        boards[0].id;
                }

                history.replaceState(
                    null,
                    '',
                    `?board=${boardId}`
                );

                socket.emit('join-board', boardId);

                renderBoards(boards);
                loadNotes();
            };

            // ===== CLEAR =====
            const clear = document.createElement('div');
            clear.className = 'board-menu-item';
            clear.innerText = '🧹 Очистити';

            clear.onclick = async () => {
                boardMenu.style.display = 'none';

                let res = await api(`/api/boards/${b.id}/elements`);
                let elements = await res.json();

                for (let el of elements) {

                    await api(`/api/elements/${el.id}`, {
                        method: 'DELETE'
                    });

                    socket.emit('element-delete', {
                        boardId,
                        id: el.id
                    });
                }

                loadNotes();
            };

            boardMenu.appendChild(rename);
            boardMenu.appendChild(del);
            boardMenu.appendChild(clear);

            boardMenu.style.left = e.pageX + 'px';
            boardMenu.style.top = e.pageY + 'px';
            boardMenu.style.display = 'flex';
        };

        boardsList.appendChild(item);
    });
}

document.addEventListener('click', (e) => {

    if (!e.target.closest('.board-menu') &&
        e.target !== shareBtn) {

        boardMenu.style.display = 'none';
        shareMenu.style.display = 'none';
    }
});

socket.on('element-updated', (data) => {

    const el = document.querySelector(
        `[data-id="${data.id}"]`
    );

    if (!el) return;

    el.style.left = data.x + 'px';
    el.style.top = data.y + 'px';
    el.style.width = data.width + 'px';

    el.style.height =
        data.type === 'line'
            ? '2px'
            : data.height + 'px';

    el.dataset.color =
        data.color || el.dataset.color || 'yellow';

    el.dataset.rotation =
        Number.isFinite(Number(data.rotation))
            ? Number(data.rotation)
            : 0;

    if (data.type === 'note') {

        const content =
            el.querySelector('.note-content');

        if (content) {
            content.innerText = data.text;
        }

        el.className =
            'note ' + data.color;
    }

    if (data.type === 'rect') {
        applyShapeColor(el, el.dataset.color);
    }

    if (data.type === 'line') {

        el.style.transform =
            `rotate(${el.dataset.rotation}deg)`;

        applyShapeColor(el, el.dataset.color);
    }
});

socket.on('element-created', (data) => {

    const exists = document.querySelector(
        `[data-id="${data.element.id}"]`
    );

    if (exists) return;

    createElement(data.element);
});

socket.on('element-deleted', (data) => {

    const el = document.querySelector(
        `[data-id="${data.id}"]`
    );

    if (el) {
        el.remove();
    }
});