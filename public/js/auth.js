// Authentication handling
// Use absolute origin for better mobile browser compatibility
const API_URL = window.location.origin + '/api';

// Login form handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const btn = document.getElementById('loginBtn');
        if (btn) {
            btn.textContent = 'Signing in...';
            btn.disabled = true;
        }

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Save token and user data
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Set cookie as a fallback for some mobile browsers (e.g., iOS Safari strict mode)
                document.cookie = `auth_token=${data.token}; path=/; max-age=86400; SameSite=Lax`;
                
                // Redirect based on role
                if (data.user.role === 'admin') {
                    window.location.href = '/views/admin/dashboard.html';
                } else {
                    window.location.href = '/views/staff/dashboard.html';
                }
            } else {
                showAlert(data.error || 'Login failed', 'error');
                if (btn) {
                    btn.textContent = 'Sign In';
                    btn.disabled = false;
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            showAlert('Connection error. Please try again.', 'error');
            if (btn) {
                btn.textContent = 'Sign In';
                btn.disabled = false;
            }
        }
    });
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/';
}

// Check if user is authenticated
function checkAuth() {
    let token = localStorage.getItem('token');
    
    // Fallback if localStorage fails but cookie exists
    if (!token) {
        const match = document.cookie.match(/(?:^|;)\s*auth_token=([^;]+)/);
        if (match) {
            token = match[1];
            localStorage.setItem('token', token); // restore it
        }
    }
    
    if (!token) {
        window.location.href = '/';
        return null;
    }
    return token;
}

// Get current user
function getCurrentUser() {
    try {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
        console.error('Failed to parse user data:', e);
        return null;
    }
}

// Get auth headers - Mobile bulletproof ensuring correct headers format
function getAuthHeaders() {
    let token = localStorage.getItem('token');
    
    // Fallback to cookie if localStorage is somehow inaccessible during fetch
    if (!token) {
        const match = document.cookie.match(/(?:^|;)\s*auth_token=([^;]+)/);
        if (match) token = match[1];
    }

    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
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
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.background = 'rgba(0,0,0,0.4)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '9999';

        const box = document.createElement('div');
        box.style.background = '#fff';
        box.style.padding = '18px';
        box.style.borderRadius = '8px';
        box.style.minWidth = '280px';
        box.style.maxWidth = '90%';
        box.style.boxShadow = '0 6px 24px rgba(0,0,0,0.2)';

        box.innerHTML = `<div style="font-weight:700;margin-bottom:8px">Select payment method</div>
            <select id="_pm_select" style="width:100%;padding:10px;margin-bottom:16px;font-size:16px;border:1px solid #ccc;border-radius:4px;background:#fff;">
                <option value="cash">Cash</option>
                <option value="pos">POS</option>
                <option value="transfer">Transfer</option>
            </select>
            <div style="text-align:right">
                <button id="_pm_cancel" class="btn btn-secondary" style="margin-right:8px;padding:8px 16px;">Cancel</button>
                <button id="_pm_ok" class="btn btn-primary" style="padding:8px 16px;">OK</button>
            </div>`;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const select = box.querySelector('#_pm_select');
        select.value = defaultMethod || 'cash';
        const cleanup = (val) => { 
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay); 
            }
            resolve(val); 
        };

        box.querySelector('#_pm_cancel').addEventListener('click', (e) => {
            e.preventDefault();
            cleanup(null);
        });
        box.querySelector('#_pm_ok').addEventListener('click', (e) => {
            e.preventDefault();
            cleanup(select.value);
        });

        // keyboard support
        overlay.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') cleanup(null);
            if (ev.key === 'Enter') cleanup(select.value);
        });
        select.focus();
    });
}
