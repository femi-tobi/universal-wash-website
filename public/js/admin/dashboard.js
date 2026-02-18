// Admin dashboard logic
checkAuth();

const user = getCurrentUser();
if (user.role !== 'admin') {
    alert('Access denied');
    window.location.href = '/views/staff/dashboard.html';
}

function fmt(n) {
    return 'NGN ' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 0 });
}

// Load dashboard data
async function loadDashboard() {
    await Promise.all([
        loadRevenueStats(),
        loadOutstandingPayments(),
        loadServiceBreakdown()
    ]);
}

// Load revenue statistics
async function loadRevenueStats() {
    try {
        // Daily revenue
        const dailyRes = await fetch('/api/dashboard/revenue/daily', { headers: getAuthHeaders() });
        const daily = await dailyRes.json();
        document.getElementById('dailyRevenue').textContent = fmt(daily.revenue);
        document.getElementById('dailySales').textContent = `${daily.sales_count || 0} orders`;

        // Weekly revenue
        const weeklyRes = await fetch('/api/dashboard/revenue/weekly', { headers: getAuthHeaders() });
        const weekly = await weeklyRes.json();
        const weeklyTotal = weekly.reduce((sum, d) => sum + parseFloat(d.revenue || 0), 0);
        document.getElementById('weeklyRevenue').textContent = fmt(weeklyTotal);

        // Monthly revenue
        const monthlyRes = await fetch('/api/dashboard/revenue/monthly', { headers: getAuthHeaders() });
        const monthly = await monthlyRes.json();
        const monthlyTotal = monthly.reduce((sum, w) => sum + parseFloat(w.revenue || 0), 0);
        document.getElementById('monthlyRevenue').textContent = fmt(monthlyTotal);
    } catch (error) {
        console.error('Error loading revenue stats:', error);
    }
}

// Load outstanding payments
async function loadOutstandingPayments() {
    try {
        const response = await fetch('/api/dashboard/outstanding', { headers: getAuthHeaders() });
        const data = await response.json();

        document.getElementById('outstandingCount').textContent = `${data.summary.total_unpaid || 0} unpaid`;
        document.getElementById('outstandingAmount').textContent = fmt(data.summary.total_unpaid_amount);

        const tbody = document.getElementById('outstandingBody');

        if (!data.outstanding || data.outstanding.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px">No outstanding payments</td></tr>';
            return;
        }

        tbody.innerHTML = data.outstanding.map(sale => `
            <tr>
                <td>
                    <div style="font-weight:600">${sale.customer_name}</div>
                    <div style="font-size:11px;color:var(--muted)">${sale.customer_phone}</div>
                </td>
                <td style="font-weight:600;color:var(--red)">${fmt(sale.total_amount)}</td>
                <td style="color:var(--muted);font-size:12px">${new Date(sale.created_at).toLocaleDateString('en-GB')}</td>
                <td>
                    <button class="btn-sm btn-sm-green" onclick="markAsPaid(${sale.sale_id})">Mark Paid</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading outstanding payments:', error);
    }
}

// Load service breakdown chart
async function loadServiceBreakdown() {
    try {
        const response = await fetch('/api/dashboard/sales-by-service', { headers: getAuthHeaders() });
        const data = await response.json();

        if (!data.length) {
            document.getElementById('serviceChart').parentElement.innerHTML =
                '<p style="text-align:center;color:var(--muted);padding:40px 0">No sales data yet</p>';
            return;
        }

        const ctx = document.getElementById('serviceChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(s => s.service_name),
                datasets: [{
                    label: 'Revenue (NGN)',
                    data: data.map(s => parseFloat(s.total_revenue)),
                    backgroundColor: '#2563eb',
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => 'NGN ' + Number(ctx.raw).toLocaleString()
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f1f5f9' },
                        ticks: { callback: v => 'NGN ' + Number(v).toLocaleString() }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading service breakdown:', error);
    }
}

// Mark sale as paid
async function markAsPaid(saleId) {
    if (!confirm('Mark this sale as paid?')) return;

    try {
        const response = await fetch(`/api/sales/${saleId}/payment`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ payment_status: 'paid' })
        });

        if (response.ok) {
            showAlert('Payment marked as paid!', 'success');
            loadOutstandingPayments();
            loadRevenueStats();
        } else {
            showAlert('Failed to update payment status', 'error');
        }
    } catch (error) {
        console.error('Error updating payment:', error);
        showAlert('Connection error', 'error');
    }
}

// Initialize
loadDashboard();
