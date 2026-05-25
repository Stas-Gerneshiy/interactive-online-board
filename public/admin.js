const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user || user.role !== 'admin') {
    window.location.href = '/';
}

function escapeHtml(value) {

    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

async function adminApi(url, options = {}) {

    options.headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
    };

    const res = await fetch(url, options);

    if (res.status === 401 || res.status === 403) {
        alert('Потрібні права адміністратора');
        window.location.href = '/';
        return null;
    }

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));

        alert(
            data.error ||
            'Помилка виконання адміністративної дії'
        );

        return null;
    }

    return res;
}

async function loadStats() {

    const res = await adminApi('/api/admin/stats');

    if (!res) return;

    const data = await res.json();

    document.getElementById('usersCount').innerText = data.users;
    document.getElementById('boardsCount').innerText = data.boards;
}

async function loadUsers() {

    const res = await adminApi('/api/admin/users');

    if (!res) return;

    const users = await res.json();

    const tbody = document.getElementById('usersTable');
    tbody.innerHTML = '';

    users.forEach((u, index) => {

        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHtml(u.email)}</td>
            <td>${escapeHtml(u.role)}</td>
            <td>${u.blocked ? 'Так' : 'Ні'}</td>
            <td>
                ${
                    u.blocked
                    ? `<button class="success" onclick="unblockUser(${u.id})">Розблокувати</button>`
                    : `<button class="warning" onclick="blockUser(${u.id})">Заблокувати</button>`
                }
                <button class="danger" onclick="deleteUser(${u.id})">Видалити</button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

async function loadBoards() {

    const res = await adminApi('/api/admin/boards');

    if (!res) return;

    const boards = await res.json();

    const tbody = document.getElementById('boardsTable');
    tbody.innerHTML = '';

    boards.forEach((b, index) => {

        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHtml(b.title)}</td>
            <td>${escapeHtml(b.email)}</td>
            <td>
                <button class="danger" onclick="deleteBoard(${b.id})">Видалити</button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

async function blockUser(id) {

    const res = await adminApi(`/api/admin/users/${id}/block`, {
        method: 'PUT'
    });

    if (res) {
        reload();
    }
}

async function unblockUser(id) {

    const res = await adminApi(`/api/admin/users/${id}/unblock`, {
        method: 'PUT'
    });

    if (res) {
        reload();
    }
}

async function deleteUser(id) {

    if (!confirm('Видалити користувача та всі його дошки?')) return;

    const res = await adminApi(`/api/admin/users/${id}`, {
        method: 'DELETE'
    });

    if (res) {
        reload();
    }
}

async function deleteBoard(id) {

    if (!confirm('Видалити дошку?')) return;

    const res = await adminApi(`/api/admin/boards/${id}`, {
        method: 'DELETE'
    });

    if (res) {
        reload();
    }
}

async function reload() {
    await loadStats();
    await loadUsers();
    await loadBoards();
}

reload();