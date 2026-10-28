# Pizza Delivery

Full-stack project for the Oasis Infobyte Web Development internship.

Developed by Leona Bytyqi.

## About

Pizza Delivery allows users to create an account, verify their email,
log in and build a pizza by choosing its ingredients.

Administrators can manage ingredient stock, change low-stock alert
thresholds and receive email notifications when supplies are low.

Prices are displayed in euros (EUR).

## Technologies

- React and Vite
- CSS
- Node.js and Express
- MongoDB and Mongoose
- JSON Web Tokens
- bcryptjs
- Nodemailer
- node-cron

## Implemented features

- User registration and email verification
- Login and protected API routes
- Password recovery by email
- Separate customer and administrator login pages
- Pizza menu
- Step-by-step pizza builder
- One base, one sauce and one cheese per pizza
- Optional selection of multiple vegetables
- Order summary with prices calculated by the backend
- Administrator inventory dashboard
- Manual stock updates
- Configurable low-stock thresholds
- Scheduled low-stock email notifications
- Responsive layout for desktop and mobile screens

## Work in progress

Payment integration is not complete.

Order creation, payment confirmation and automatic stock deduction
still need to be connected and tested together.

Customer order history and administrator order-management screens
are present, but the complete paid-order flow has not yet been tested.

## Project folders

- `backend`: API, database models, authentication and email utilities
- `frontend`: React application and styles

## Local setup

### Requirements

- Node.js and npm
- A MongoDB database accessible from the development computer
- A Gmail account with an App Password for sending emails

### Download the project

```bash
git clone https://github.com/leonabytyqii/OIBSIP.git
cd OIBSIP/WebDev-L3-PizzaDelivery
```

### Backend configuration

Copy `backend/.env.example` to `backend/.env`.
Replace the example values with your own configuration.

Add the following variables and replace the example values with
your own configuration:

```dotenv
PORT=5000
MONGO_URI=mongodb+srv://YOUR_CLUSTER_HOST/
MONGO_USER=YOUR_DATABASE_USERNAME
MONGO_PASSWORD=YOUR_DATABASE_PASSWORD
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
GMAIL_USER=YOUR_GMAIL_ADDRESS
GMAIL_APP_PASSWORD=YOUR_GMAIL_APP_PASSWORD
ADMIN_ALERT_EMAIL=YOUR_ADMIN_EMAIL_ADDRESS
```

`MONGO_USER` and `MONGO_PASSWORD` are database-user credentials.

`GMAIL_APP_PASSWORD` is a Gmail App Password, not the normal
password used to sign in to Gmail.

`ADMIN_ALERT_EMAIL` is the address that receives stock alerts.

Never commit your real `.env` file or credentials.

### Start the backend

Open a terminal in the project folder:

```bash
cd backend
npm ci
npm start
```

The backend runs at:

```text
http://localhost:5000
```

To restart the backend automatically when its code changes:

```bash
npm run dev
```

Use one backend process at a time.

### Start the frontend

Open a second terminal in the project folder:

```bash
cd frontend
npm ci
npm run dev -- --port 5173 --strictPort
```

Open:

```text
http://localhost:5173
```

Keep both terminals running while using the application.

The current configuration uses localhost URLs, so open the
application on the same computer that runs the servers.

## Pages

| Path | Purpose |
| --- | --- |
| `/` | Customer login |
| `/login` | Customer login |
| `/register` | Create a customer account |
| `/verify-email` | Verify an email using the emailed link |
| `/forgot-password` | Request a password reset |
| `/reset-password` | Set a new password using the emailed link |
| `/admin/login` | Administrator login |

Registration creates customer accounts. Administrator access
requires an account with the administrator role.

## Database initialization

After configuring `backend/.env` and installing the backend
dependencies, run these commands from the `backend` folder,
one at a time:

```bash
node scripts/seedIngredients.js
node scripts/seedIngredientPrices.js
node scripts/seedPizzas.js
```

Continue to the next command only if the previous command succeeds.

- `seedIngredients.js` adds 19 ingredients that do not already
  exist. New ingredients start with stock 50 and alert threshold 20.
  Existing ingredients are left unchanged.
- `seedIngredientPrices.js` sets the ingredient prices in euro
  cents. Running it again overwrites existing prices with the
  values defined in the script.
- `seedPizzas.js` adds three menu pizzas: Margherita, Veggie and
  Pepperoni. Existing pizzas are left unchanged.

## Administrator account setup

1. Start the backend and frontend.
2. Create an account at `http://localhost:5173/register`.
3. Verify the account using the link sent by email.
4. Open a separate terminal in the `backend` folder and run:

```bash
node scripts/makeAdmin.js "admin@example.com"
```

Replace `admin@example.com` with the email address of the verified
account you want to promote.

The script requires an existing, verified account. It changes the
role to administrator and increments the token version to invalidate
previous access tokens. It does not change the password.

Log out if necessary, then sign in at:

```text
http://localhost:5173/admin/login
```

Use the same email address and application password chosen during
registration.

Run this script only for accounts that should have administrator
access. Public registration always creates customer accounts.
## Low-stock alerts

Each ingredient has its own alert threshold.

For example, if the threshold is 10:

- Stock of 10 is not below the threshold.
- Stock of 9 is considered low.

The backend checks for low stock every minute. It must remain
running for scheduled checks to take place.

## Frontend checks

Run these commands inside `frontend`:

```bash
npm run build
npm run lint
```

The build command creates the production frontend in `dist`.

## Manual checks completed during development

- Email verification
- Login and profile loading
- Password recovery
- Pizza ingredient selection and price summary
- Inventory stock updates
- Saving a changed alert threshold
- Receiving a low-stock email with stock 9 and threshold 10
- Mobile layout at 390 × 844
- Horizontal scrolling of the inventory table on a small screen

Payment and the complete order lifecycle remain pending.

## Project status

This project is under development. Setup instructions and testing
notes will be updated as the remaining features are completed.