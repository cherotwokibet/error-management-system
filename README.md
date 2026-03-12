# ErrorWatch — Error Management System

A full-stack web application for logging, tracking, and resolving software errors. Built with React, Node.js/Express, and PostgreSQL.

---

## Features

- **Secure Auth** — JWT-based login, 3 roles (Admin, Editor, Viewer), rate-limited login
- **Error CRUD** — Create, read, update, delete error reports with validation
- **Screenshot Upload** — Drag & drop, file picker, paste from clipboard; auto-thumbnails
- **Intelligent Search** — Full-text PostgreSQL search with autocomplete suggestions
- **Dashboard** — Sortable, filterable paginated table with status stats
- **Analytics** — Line chart (errors over time), bar charts (by category/channel), pie chart, KPIs
- **Real-time Notifications** — WebSocket (Socket.IO) in-app bell with unread counter
- **Export** — CSV and Excel export with current filters applied
- **User Management** — Admin can create/deactivate/re-role users
- **Audit Logs** — Tracks create/edit/delete actions with IP and user

---

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React 18, Vite, React Router v6     |
| Charts    | Recharts                            |
| Styling   | Pure CSS (custom design system)     |
| Backend   | Node.js, Express                    |
| Auth      | JWT + bcryptjs                      |
| Database  | PostgreSQL                          |
| Uploads   | Multer + Sharp (thumbnails)         |
| Realtime  | Socket.IO                           |
| Export    | ExcelJS                             |

---

## Prerequisites

- Node.js 18+
- PostgreSQL 13+

---

## Setup Instructions

### 1. Clone and install

```bash
# Backend
cd error-management-system/backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Create the PostgreSQL database

```sql
-- In psql or your DB client:
CREATE DATABASE error_management;
```

### 3. Configure the backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your actual values:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=error_management
DB_USER=postgres
DB_PASSWORD=yourpassword
JWT_SECRET=change_this_to_a_long_random_string
FRONTEND_URL=http://localhost:5173
```

### 4. Initialize the database

```bash
cd backend
npm run db:init
```

This creates all tables and a default admin user:
- **Email:** `admin@errormanagement.app`
- **Password:** `Admin@123`

### 5. Start the servers

**Backend** (terminal 1):
```bash
cd backend
npm run dev        # uses nodemon for hot-reload
# or: npm start   # production
```

**Frontend** (terminal 2):
```bash
cd frontend
npm run dev
```

Open http://localhost:5173

---

## Project Structure

```
error-management-system/
├── backend/
│   ├── config/
│   │   └── database.js          # PostgreSQL pool
│   ├── db/
│   │   ├── schema.sql            # Full DB schema + seed
│   │   └── init.js               # Run with: npm run db:init
│   ├── middleware/
│   │   ├── auth.js               # JWT verify, RBAC, audit log
│   │   └── upload.js             # Multer + Sharp thumbnails
│   ├── routes/
│   │   ├── auth.js               # Login, register, users
│   │   ├── errors.js             # Error CRUD + screenshots + comments
│   │   ├── notifications.js      # Get/mark-read notifications
│   │   ├── analytics.js          # Stats endpoints
│   │   └── export.js             # CSV + Excel download
│   ├── uploads/                  # Uploaded images (auto-created)
│   ├── server.js                 # Express + Socket.IO entry
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── api/
    │   │   └── api.js            # Axios client + all API calls
    │   ├── context/
    │   │   └── AuthContext.jsx   # User state, socket, permissions
    │   ├── components/
    │   │   ├── Layout.jsx        # App shell
    │   │   ├── Sidebar.jsx       # Navigation
    │   │   ├── Navbar.jsx        # Top bar + notifications
    │   │   └── StatusBadge.jsx   # Colored status + channel badges
    │   ├── pages/
    │   │   ├── Login.jsx         # Login form
    │   │   ├── Dashboard.jsx     # Error table + filters + stats
    │   │   ├── ErrorForm.jsx     # Create/edit form + dropzone
    │   │   ├── ErrorDetail.jsx   # Full error view + comments + lightbox
    │   │   ├── Analytics.jsx     # Charts + KPIs
    │   │   └── Users.jsx         # User management (admin)
    │   ├── App.jsx               # Router + Toaster
    │   ├── main.jsx
    │   └── index.css             # Full design system (CSS variables)
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## API Reference

### Auth
| Method | Endpoint               | Access  | Description              |
|--------|------------------------|---------|--------------------------|
| POST   | `/api/auth/login`      | Public  | Login, returns JWT       |
| GET    | `/api/auth/me`         | Any     | Current user             |
| POST   | `/api/auth/register`   | Admin   | Create a user            |
| GET    | `/api/auth/users`      | Admin   | List all users           |
| PUT    | `/api/auth/users/:id`  | Admin   | Update role/status       |

### Errors
| Method | Endpoint                                | Access         | Description             |
|--------|-----------------------------------------|----------------|-------------------------|
| GET    | `/api/errors`                           | Any            | List with filters/search|
| POST   | `/api/errors`                           | Admin, Editor  | Create error            |
| GET    | `/api/errors/:id`                       | Any            | Get full detail         |
| PUT    | `/api/errors/:id`                       | Admin, Editor  | Update error            |
| DELETE | `/api/errors/:id`                       | Admin          | Delete error            |
| POST   | `/api/errors/:id/screenshots`           | Admin, Editor  | Upload screenshots      |
| DELETE | `/api/errors/:id/screenshots/:sid`      | Admin, Editor  | Remove screenshot       |
| POST   | `/api/errors/:id/comments`              | Admin, Editor  | Add comment             |
| DELETE | `/api/errors/:id/comments/:cid`         | Owner, Admin   | Delete comment          |

### Analytics
| GET `/api/analytics/overview`    | Summary stats + MTTR          |
| GET `/api/analytics/over-time`   | Time series (daily/weekly/monthly) |
| GET `/api/analytics/by-category` | Breakdown by category         |
| GET `/api/analytics/by-channel`  | Breakdown by channel          |

### Export
| GET `/api/export/errors.csv`  | CSV download (respects filters) |
| GET `/api/export/errors.xlsx` | Excel download                  |

---

## Roles & Permissions

| Action          | Admin | Editor | Viewer |
|-----------------|-------|--------|--------|
| View errors     | ✅    | ✅     | ✅     |
| Create errors   | ✅    | ✅     | ❌     |
| Edit errors     | ✅    | ✅     | ❌     |
| Delete errors   | ✅    | ❌     | ❌     |
| Add comments    | ✅    | ✅     | ❌     |
| Upload files    | ✅    | ✅     | ❌     |
| Manage users    | ✅    | ❌     | ❌     |
| View analytics  | ✅    | ✅     | ✅     |
| Export          | ✅    | ✅     | ✅     |

---

## Implementation Phases (Status)

| Phase | Feature                              | Status  |
|-------|--------------------------------------|---------|
| 1     | Auth, roles, error CRUD              | ✅ Done |
| 2     | Image upload, paste, thumbnails      | ✅ Done |
| 3     | Dashboard, sorting, filtering, search| ✅ Done |
| 4     | Notifications, export, analytics     | ✅ Done |
| 5     | Audit logs (DB), polish              | ✅ Done |

---

## Environment Variables Reference

| Variable        | Default                  | Description                     |
|-----------------|--------------------------|---------------------------------|
| `PORT`          | `5000`                   | Backend port                    |
| `DB_HOST`       | `localhost`              | PostgreSQL host                 |
| `DB_PORT`       | `5432`                   | PostgreSQL port                 |
| `DB_NAME`       | `error_management`       | Database name                   |
| `DB_USER`       | `postgres`               | Database user                   |
| `DB_PASSWORD`   | —                        | Database password               |
| `JWT_SECRET`    | —                        | **Required** — long random string|
| `JWT_EXPIRES_IN`| `7d`                     | Token lifetime                  |
| `UPLOAD_DIR`    | `./uploads`              | Where images are stored         |
| `MAX_FILE_SIZE` | `10485760` (10MB)        | Max upload size in bytes        |
| `FRONTEND_URL`  | `http://localhost:5173`  | For CORS + Socket.IO            |
