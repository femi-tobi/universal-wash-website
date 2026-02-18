# 🧺 Laundry Management System

A simple, fast, and counter-optimized laundry management system built with Node.js, Express, MySQL, and vanilla JavaScript.

> **⚡ Quick Start**: The system automatically uses SQLite if MySQL is not available, so you can start using it immediately without any database setup!

## Features

### Staff Features
- ✅ Login/Logout with JWT authentication
- 📝 Create new sales with multiple items
- 👤 Customer phone lookup and auto-fill
- 💰 Automatic price calculation
- 💳 Payment status tracking (Paid/Unpaid)
- 📊 View daily sales totals
- 🖨️ Receipt generation (planned)

### Admin Features
- 📈 Dashboard with daily/weekly/monthly revenue analytics
- 📊 Sales breakdown by service type (Chart.js visualization)
- 💸 View and manage outstanding payments
- ⚙️ Service management (add, edit, deactivate)
- 👥 Staff account management
- 📋 Customer history and order tracking

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Charts**: Chart.js
- **Validation**: express-validator

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- MySQL (v5.7 or higher) - **OPTIONAL**: System will use SQLite if MySQL is unavailable
- npm

### Quick Start (No MySQL Required)

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm run dev
   ```
   
   The system will automatically create a SQLite database (`laundry.db`) if MySQL is not available.

3. **Open browser** and go to `http://localhost:3000`

4. **Login with default credentials**:
   - **Username**: `admin`
   - **Password**: `admin123`

### MySQL Setup (Optional)

If you want to use MySQL instead of SQLite:

1. **Set up environment variables**:
   - Update `.env` with your database credentials:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=laundry_db
   ```

2. **Create database and tables**:
   ```bash
   mysql -u root -p < server/schema.sql
   ```

3. **Restart the server** - it will automatically use MySQL

## Project Structure

```
laundry-management/
├── server/
│   ├── config/
│   │   └── database.js          # MySQL connection
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication
│   │   └── roleCheck.js         # Role-based access
│   ├── routes/                  # API routes
│   ├── controllers/             # Business logic
│   ├── schema.sql               # Database schema
│   ├── app.js                   # Express setup
│   └── server.js                # Entry point
├── public/
│   ├── css/
│   │   └── main.css             # Global styles
│   ├── js/
│   │   ├── auth.js              # Auth helpers
│   │   ├── staff/               # Staff JavaScript
│   │   └── admin/               # Admin JavaScript
│   └── views/
│       ├── login.html
│       ├── staff/               # Staff pages
│       └── admin/               # Admin pages
├── .env                         # Environment config
├── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Sales (Staff & Admin)
- `POST /api/sales` - Create new sale
- `GET /api/sales/daily` - Get today's sales summary
- `GET /api/sales/:id` - Get sale details
- `PUT /api/sales/:id/payment` - Update payment status

### Services (Admin only for write)
- `GET /api/services` - Get all services
- `POST /api/services` - Create service
- `PUT /api/services/:id` - Update service
- `DELETE /api/services/:id` - Deactivate service

### Dashboard (Admin only)
- `GET /api/dashboard/revenue/daily` - Daily revenue
- `GET /api/dashboard/revenue/weekly` - Weekly revenue
- `GET /api/dashboard/revenue/monthly` - Monthly revenue
- `GET /api/dashboard/sales-by-service` - Sales breakdown
- `GET /api/dashboard/outstanding` - Outstanding payments

### Staff Management (Admin only)
- `GET /api/staff` - Get all staff
- `POST /api/staff` - Add staff member
- `PUT /api/staff/:id` - Update staff
- `DELETE /api/staff/:id` - Deactivate staff

### Customers (Admin only)
- `GET /api/customers` - Get all customers
- `GET /api/customers/:id/history` - Get customer history

## Usage

### Staff Workflow
1. Login with staff credentials
2. Click "Create New Sale"
3. Enter customer phone (auto-fills name if exists)
4. Add service items with quantities
5. Total is calculated automatically
6. Select payment status
7. Save sale

### Admin Workflow
1. Login with admin credentials
2. View dashboard for revenue analytics
3. Manage services and pricing
4. Add/remove staff accounts
5. Track outstanding payments
6. View customer order history

## Key Features

✅ **Counter-Optimized UI**: Large buttons (56px height), minimal steps, touch-friendly  
✅ **Auto-calculation**: Real-time price calculation  
✅ **Customer Lookup**: Phone number auto-fills existing customer names  
✅ **Transaction Safety**: Database transactions for sale creation  
✅ **Role-Based Access**: Separate staff/admin permissions  
✅ **Analytics**: Daily, weekly, monthly revenue tracking  
✅ **Outstanding Tracking**: Monitor unpaid orders  

## Production Deployment

1. **Update environment**:
   ```env
   NODE_ENV=production
   JWT_SECRET=strong_random_secret
   ```

2. **Use production database**

3. **Enable HTTPS** (required for secure JWT)

4. **Consider using PM2** for process management:
   ```bash
   npm install -g pm2
   pm2 start server/server.js --name laundry-app
   ```

## Security Notes

- Passwords are hashed with bcrypt
- JWT tokens expire in 24 hours
- All API routes require authentication except login
- Admin routes have additional role checking
- SQL injection protection via parameterized queries

## Future Enhancements

- 🖨️ PDF receipt generation (pdfkit/puppeteer)
- 📱 SMS notifications for outstanding payments
- 📦 Inventory management
- 🏪 Multi-branch support
- 📱 Customer mobile app
- 📧 Email receipts
- 💳 Payment gateway integration

## License

ISC

## Support

For issues or questions, contact your system administrator.
# universal-wash-website
