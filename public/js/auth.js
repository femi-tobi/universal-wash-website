// Authentication handling
const API_URL = '/api';

// Login form handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Save token and user data
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Redirect based on role
                if (data.user.role === 'admin') {
                    window.location.href = '/views/admin/dashboard.html';
                } else {
                    window.location.href = '/views/staff/dashboard.html';
                }
            } else {
                showAlert(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showAlert('Connection error. Please try again.', 'error');
        }
    });
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

// Check if user is authenticated
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return null;
    }
    return token;
}

// Get current user
function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Show alert message
function showAlert(message, type = 'error') {
    const alertDiv = document.getElementById('alert');
    if (alertDiv) {
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        alertDiv.classList.remove('hidden');
        
        setTimeout(() => {
            alertDiv.classList.add('hidden');
        }, 5000);
    }
}

// Small modal dialog to pick payment method. Returns the selected method ('cash'|'pos'|'transfer') or null if cancelled.
function showPaymentMethodDialog(defaultMethod = 'cash') {
    return new Promise((resolve) => {
        // create overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.left = 0;
        overlay.style.top = 0;
        overlay.style.right = 0;
        overlay.style.bottom = 0;
        overlay.style.background = 'rgba(0,0,0,0.4)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = 9999;

        const box = document.createElement('div');
        box.style.background = '#fff';
        box.style.padding = '18px';
        box.style.borderRadius = '8px';
        box.style.minWidth = '280px';
        box.style.boxShadow = '0 6px 24px rgba(0,0,0,0.2)';

        box.innerHTML = `<div style="font-weight:700;margin-bottom:8px">Select payment method</div>
            <select id="_pm_select" style="width:100%;padding:8px;margin-bottom:12px">
                <option value="cash">Cash</option>
                <option value="pos">POS</option>
                <option value="transfer">Transfer</option>
            </select>
            <div style="text-align:right">
                <button id="_pm_cancel" class="btn btn-secondary" style="margin-right:8px">Cancel</button>
                <button id="_pm_ok" class="btn btn-primary">OK</button>
            </div>`;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const select = box.querySelector('#_pm_select');
        select.value = defaultMethod || 'cash';
        const cleanup = (val) => { document.body.removeChild(overlay); resolve(val); };

        box.querySelector('#_pm_cancel').addEventListener('click', () => cleanup(null));
        box.querySelector('#_pm_ok').addEventListener('click', () => cleanup(select.value));

        // keyboard support
        overlay.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') cleanup(null);
            if (ev.key === 'Enter') cleanup(select.value);
        });
        select.focus();
    });
}
