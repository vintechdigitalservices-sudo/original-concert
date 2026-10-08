document.addEventListener('DOMContentLoaded', () => {
    const loginCard = document.getElementById('login-card');
    const adminPanel = document.getElementById('admin-panel');
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const togglePassword = document.getElementById('toggle-password');
    const loginError = document.getElementById('login-error');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const tableWrapper = document.getElementById('table-wrapper');
    const statusBox = document.getElementById('status-box');
    const statusText = document.getElementById('status-text');
    const tableSpinner = document.getElementById('table-spinner');
    const adminMeta = document.getElementById('admin-meta');
    const searchInput = document.getElementById('search-input');
    const btnRefresh = document.getElementById('btn-refresh');
    const toastEl = document.getElementById('toast');
    const deleteModal = document.getElementById('delete-modal');
    const deleteName = document.getElementById('delete-name');
    const deleteTicketId = document.getElementById('delete-ticket-id');
    const deleteEmail = document.getElementById('delete-email');
    const btnCancelDelete = document.getElementById('btn-cancel-delete');
    const btnConfirmDelete = document.getElementById('btn-confirm-delete');

    let tickets = [];
    let currentUser = null;
    let pendingDeleteId = null;
    const MAX_LOGIN_ATTEMPTS = 5;
    const LOCKOUT_MS = 30000;
    let failedAttempts = 0;
    let lockoutUntil = 0;

    const withTimeout = (promise, ms, message) =>
        Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
        ]);

    const showToast = (message) => {
        toastEl.textContent = message;
        toastEl.classList.add('show');
        setTimeout(() => toastEl.classList.remove('show'), 3000);
    };

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const safePhotoSrc = (value) => {
        const v = String(value || '');
        if (/^data:image\/(?:png|jpeg|jpg|webp);base64,/i.test(v)) return v;
        if (/^https?:\/\//i.test(v)) return v;
        return '';
    };

    const friendlyAuthError = (err) => {
        const code = err && err.code ? err.code : '';
        switch (code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
            case 'auth/invalid-login-credentials':
                return 'Invalid email or password.';
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/network-request-failed':
                return 'No internet connection. Check your connection and try again.';
            case 'auth/too-many-requests':
                return 'Too many sign-in attempts. Please wait a few minutes and try again.';
            case 'auth/user-disabled':
                return 'This account has been disabled. Please contact the administrator.';
            default:
                return 'Sign-in failed. Please try again later.';
        }
    };

    const updateLockoutState = () => {
        const now = Date.now();
        if (lockoutUntil > now) {
            const waitSec = Math.ceil((lockoutUntil - now) / 1000);
            btnLogin.disabled = true;
            btnLogin.textContent = 'Try again in ' + waitSec + 's';
            setTimeout(updateLockoutState, Math.min(1000, lockoutUntil - now));
            return;
        }
        btnLogin.disabled = false;
        btnLogin.textContent = 'Sign In';
    };

    const formatDate = (iso) => {
        if (!iso) return '—';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const showStatus = (message, { spinner = false, error = false } = {}) => {
        tableSpinner.style.display = spinner ? 'block' : 'none';
        statusText.textContent = message;
        statusText.classList.toggle('error-message', error);
        statusBox.style.display = 'block';

        const existingTable = tableWrapper.querySelector('.tickets-table');
        if (existingTable) existingTable.remove();
    };

    const renderTable = (rows) => {
        const existingTable = tableWrapper.querySelector('.tickets-table');
        if (existingTable) existingTable.remove();
        statusBox.style.display = 'none';

        if (rows.length === 0) {
            renderEmpty();
            return;
        }

        const table = document.createElement('table');
        table.className = 'tickets-table';

        const head = document.createElement('thead');
        head.innerHTML = `
            <tr>
                <th>Photo</th>
                <th>Full Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Ticket ID</th>
                <th>Created</th>
                <th>Actions</th>
            </tr>
        `;

        const body = document.createElement('tbody');
        rows.forEach((ticket) => {
            const safePhoto = safePhotoSrc(ticket.photo);
            const photo = safePhoto
                ? `<img class="ticket-photo" src="${escapeHtml(safePhoto)}" alt="Attendee photo" loading="lazy">`
                : `<span class="ticket-photo ticket-photo--empty">No<br>Photo</span>`;

            const tr = document.createElement('tr');
            tr.dataset.id = ticket.ticketId;
            tr.innerHTML = `
                <td>${photo}</td>
                <td>${escapeHtml(ticket.fullName)}</td>
                <td>${escapeHtml(ticket.phone)}</td>
                <td>${escapeHtml(ticket.email)}</td>
                <td class="ticket-id">${escapeHtml(ticket.ticketId)}</td>
                <td class="created-at">${escapeHtml(formatDate(ticket.createdAt))}</td>
                <td class="actions">
                    <button class="btn-danger" data-delete="${escapeHtml(ticket.ticketId)}">Delete</button>
                </td>
            `;
            body.appendChild(tr);
        });

        table.appendChild(head);
        table.appendChild(body);
        tableWrapper.appendChild(table);
    };

    const renderEmpty = () => {
        showStatus('No tickets found.');
        const retry = document.createElement('button');
        retry.className = 'btn-secondary';
        retry.textContent = 'Refresh';
        retry.addEventListener('click', loadTickets);
        statusBox.appendChild(retry);
    };

    const renderError = (message) => {
        showStatus('Could not load tickets:\n\n' + message, { error: true });
        const retry = document.createElement('button');
        retry.className = 'btn-secondary';
        retry.textContent = 'Retry';
        retry.addEventListener('click', loadTickets);
        statusBox.appendChild(retry);
    };

    const loadTickets = async () => {
        showStatus('Loading tickets...', { spinner: true });
        adminMeta.textContent = 'Loading...';

        try {
            if (!window.db) {
                throw new Error('Database is not ready. Please check your connection and try again.');
            }

            const snapshot = await withTimeout(
                window.db.collection('tickets').orderBy('createdAt', 'desc').get(),
                20000,
                'The database request timed out after 20 seconds.'
            );

            tickets = snapshot.docs.map((doc) => ({ ...doc.data() }));
            adminMeta.textContent = tickets.length === 1
                ? '1 ticket registered'
                : tickets.length + ' tickets registered';

            renderTable(tickets);
            searchInput.value = '';
        } catch (err) {
            console.error('[Admin] Failed to load tickets:', err);
            adminMeta.textContent = 'Load failed';
            renderError(err && err.message ? err.message : String(err));
        }
    };

    const openDeleteModal = (ticketId) => {
        const ticket = tickets.find((t) => t.ticketId === ticketId);
        if (!ticket) return;

        pendingDeleteId = ticketId;
        deleteName.textContent = ticket.fullName || 'Unknown attendee';
        deleteTicketId.textContent = ticket.ticketId || '—';
        deleteEmail.textContent = ticket.email || '—';
        btnConfirmDelete.textContent = 'Delete Ticket';
        btnConfirmDelete.disabled = false;
        deleteModal.style.display = 'flex';
    };

    const closeDeleteModal = () => {
        deleteModal.style.display = 'none';
        pendingDeleteId = null;
    };

    const deleteTicket = async (ticketId) => {
        btnConfirmDelete.textContent = 'Deleting...';
        btnConfirmDelete.disabled = true;

        try {
            await withTimeout(
                window.db.collection('tickets').doc(ticketId).delete(),
                20000,
                'The database request timed out after 20 seconds.'
            );
            const removed = tickets.find((t) => t.ticketId === ticketId);
            tickets = tickets.filter((t) => t.ticketId !== ticketId);
            adminMeta.textContent = tickets.length === 1
                ? '1 ticket registered'
                : tickets.length + ' tickets registered';
            renderTable(tickets);
            closeDeleteModal();
            showToast('Ticket ' + ticketId + ' deleted' + (removed && removed.fullName ? ' (' + removed.fullName + ')' : '') + '.');
        } catch (err) {
            console.error('[Admin] Delete failed:', err);
            btnConfirmDelete.textContent = 'Delete Ticket';
            btnConfirmDelete.disabled = false;
            showToast('Delete failed: ' + (err && err.message ? err.message : String(err)));
        }
    };

    tableWrapper.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-delete]');
        if (btn) openDeleteModal(btn.dataset.delete);
    });

    btnCancelDelete.addEventListener('click', closeDeleteModal);
    btnConfirmDelete.addEventListener('click', () => {
        if (pendingDeleteId) deleteTicket(pendingDeleteId);
    });
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && deleteModal.style.display === 'flex') closeDeleteModal();
    });

    btnRefresh.addEventListener('click', loadTickets);

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        if (!query) {
            renderTable(tickets);
            return;
        }
        const filtered = tickets.filter((t) =>
            [t.fullName, t.email, t.phone, t.ticketId].some((field) =>
                String(field || '').toLowerCase().includes(query)
            )
        );
        renderTable(filtered);
    });

    const showAuthView = () => {
        adminPanel.style.display = 'none';
        loginCard.style.display = 'block';
        loginEmail.value = '';
        loginPassword.value = '';
        loginPassword.setAttribute('type', 'password');
        togglePassword.querySelector('.eye-open').style.display = 'block';
        togglePassword.querySelector('.eye-closed').style.display = 'none';
        togglePassword.setAttribute('aria-label', 'Show password');
        togglePassword.setAttribute('title', 'Show password');
        loginError.style.display = 'none';
        failedAttempts = 0;
        updateLockoutState();
    };

    const showAdminView = (user) => {
        currentUser = user;
        loginCard.style.display = 'none';
        adminPanel.style.display = 'block';
        loginPassword.value = '';
        loadTickets();
    };

    const showLoginError = (message) => {
        loginError.textContent = message;
        loginError.style.display = 'block';
        btnLogin.disabled = false;
        btnLogin.textContent = 'Sign In';
    };

    btnLogin.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = loginEmail.value.trim();
        const password = loginPassword.value;

        if (!email || !password) {
            showLoginError('Please enter your email and password.');
            return;
        }

        loginError.style.display = 'none';
        btnLogin.disabled = true;
        btnLogin.textContent = 'Signing in...';

        try {
            if (!window.auth) {
                throw new Error('Authentication is not available. Please check your connection.');
            }
            const userCredential = await withTimeout(
                window.auth.signInWithEmailAndPassword(email, password),
                20000,
                'The sign-in request timed out. Please try again.'
            );
            failedAttempts = 0;
            lockoutUntil = 0;
            showAdminView(userCredential.user);
        } catch (err) {
            console.error('[Admin] Sign-in failed (details withheld to prevent account enumeration).');
            const code = err && err.code ? err.code : '';
            const isBadCredential = code === 'auth/user-not-found'
                || code === 'auth/wrong-password'
                || code === 'auth/invalid-credential'
                || code === 'auth/invalid-login-credentials';
            if (isBadCredential) {
                failedAttempts += 1;
                if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
                    lockoutUntil = Date.now() + LOCKOUT_MS;
                    failedAttempts = 0;
                    showLoginError('Too many failed attempts. Login locked for 30 seconds.');
                    updateLockoutState();
                    return;
                }
            } else if (code === 'auth/network-request-failed') {
                failedAttempts = Math.max(0, failedAttempts - 1);
            }
            showLoginError(friendlyAuthError(err));
        }
    });

    btnLogout.addEventListener('click', async () => {
        try {
            await window.auth.signOut();
        } catch (err) {
            console.error('[Admin] Sign-out failed:', err);
        }
        currentUser = null;
        tickets = [];
        closeDeleteModal();
        showAuthView();
    });

    loginEmail.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnLogin.click();
    });
    loginPassword.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnLogin.click();
    });

    togglePassword.addEventListener('click', () => {
        const isHidden = loginPassword.getAttribute('type') === 'password';
        loginPassword.setAttribute('type', isHidden ? 'text' : 'password');
        togglePassword.querySelector('.eye-open').style.display = isHidden ? 'none' : 'block';
        togglePassword.querySelector('.eye-closed').style.display = isHidden ? 'block' : 'none';
        togglePassword.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
        togglePassword.setAttribute('title', isHidden ? 'Hide password' : 'Show password');
        loginPassword.focus();
    });

    if (window.auth) {
        window.auth.onAuthStateChanged((user) => {
            if (user) {
                showAdminView(user);
            } else {
                showAuthView();
            }
        });
    } else {
        showAuthView();
        btnLogin.disabled = true;
        btnLogin.textContent = 'Unavailable';
        showLoginError('Authentication is not available. Please reload the page.');
    }
});