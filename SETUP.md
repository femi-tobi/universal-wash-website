# Laundry Management System - Setup Guide

## Quick Start (5 Minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Database
Open `.env` and update your MySQL password:
```env
DB_PASSWORD=your_mysql_password_here
```

### 3. Create Database
Open MySQL:
```bash
mysql -u root -p
```

Then run:
```sql
source server/schema.sql
```

Or on Windows PowerShell:
```bash
Get-Content server/schema.sql | mysql -u root -p
```

### 4. Start Server
```bash
npm run dev
```

### 5. Open Browser
Go to: `http://localhost:3000`

**Login**: 
- Username: `admin`
- Password: `admin123`

## Troubleshooting

### Database Connection Error
- Check MySQL is running
- Verify credentials in `.env`
- Ensure `laundry_db` database exists

### Port Already in Use
Change PORT in `.env`:
```env
PORT=3001
```

### Module Not Found
Reinstall dependencies:
```bash
rm -rf node_modules
npm install
```

## Default Data

The system comes with:
- 1 admin user (admin/admin123)
- 4 sample services (Wash, Iron, Dry Clean, Wash & Iron)

**Remember to change the admin password after first login!**
