# Pizza Delivery

Full-stack project for the Oasis Infobyte Web Development internship.

Developed by Leona Bytyqi.

## About

Pizza Delivery allows customers to register, verify their email,
log in and build a pizza by choosing ingredients.

Customers can review the total, save an order awaiting payment
and view their order history.

Administrators can update ingredient stock, change low-stock thresholds
and receive scheduled email alerts.

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

- Registration and email verification
- Login and protected API routes
- Password recovery by email
- Separate customer and administrator login pages
- Pizza menu
- Step-by-step pizza builder
- One base, one sauce and one cheese per pizza
- Optional selection of multiple vegetables
- Prices calculated by the backend
- Saving orders with an awaiting-payment status
- Customer order history with automatic refresh
- Administrator inventory dashboard
- Manual stock updates
- Configurable low-stock thresholds
- Scheduled low-stock email notifications
- Administrator interface and API for managing paid-order statuses
- Responsive layout for desktop and mobile screens

## Work in progress

Razorpay payment integration is not complete. Clarification has been
requested from Oasis Infobyte because Kosovo is not listed in the
Razorpay registration country selection.

Saving a pending order and displaying it in customer order history
have been tested.

Payment confirmation and automatic stock deduction are not connected yet.
Saving a pending order does not reserve or deduct stock.

The administrator status-management code is present, but the complete
paid-order lifecycle still requires integration and testing.

## Project folders

- `backend`: API, database models, authentication, scripts and email utilities
- `frontend`: React application and styles

## Local setup

### Requirements

- Node.js and npm
- An accessible MongoDB database
- A Gmail account with an App Password for sending emails

### Download the project

```bash
git clone https://github.com/leonabytyqii/OIBSIP.git
cd OIBSIP/WebDev-L3-PizzaDelivery
```

### Backend configuration

Copy `backend/.env.example` to `backend/.env`.

Replace the placeholders with your own configuration:

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

- `MONGO_USER` and `MONGO_PASSWORD` are database-user credentials.
- `JWT_SECRET` is a long random secret used to sign access tokens.
- `GMAIL_APP_PASSWORD` is a Gmail App Password, not your normal Gmail password.
- `ADMIN_ALERT_EMAIL` receives low-stock notifications.

Keep real credentials in `backend/.env`.
Never commit that file or include real passwords in this README.

### Start the backend

From the project folder:

```bash
cd backend
npm ci
npm start
```

The API runs at `http://localhost:5000`.

For automatic restart during development, use this instead of `npm start`:

```bash
npm run dev
```

Run only one backend process at a time.

### Start the frontend

Open another terminal in the project folder:

```bash
cd frontend
npm ci
npm run dev -- --port 5173 --strictPort
```

Open `http://localhost:5173`.

Keep both servers running while using the application.

The current configuration uses localhost URLs. Open the application
on the same computer that runs the servers.

## Pages

| Path | Purpose |
| --- | --- |
| `/` | Customer login |
| `/login` | Customer login |
| `/register` | Customer registration |
| `/verify-email` | Email verification |
| `/forgot-password` | Request a password reset |
| `/reset-password` | Set a new password using the emailed link |
| `/admin/login` | Administrator login |

Public registration creates customer accounts.
Administrator access requires an account with the administrator role.

## Database initialization

After configuring `backend/.env` and installing backend dependencies,
run these commands from the `backend` folder, one at a time:

```bash
node scripts/seedIngredients.js
node scripts/seedIngredientPrices.js
node scripts/seedPizzas.js
```

Continue only if the previous command succeeds.

- `seedIngredients.js` adds 19 ingredients that do not already exist.
  New ingredients start with stock 50 and alert threshold 20.
  Existing ingredients are left unchanged.
- `seedIngredientPrices.js` updates prices in euro cents.
  Running it again overwrites prices with the values in the script.
- `seedPizzas.js` adds Margherita, Veggie and Pepperoni.
  Existing menu pizzas are left unchanged.

## Administrator account setup

1. Start the backend and frontend.
2. Register an account at `http://localhost:5173/register`.
3. Verify the account using the emailed link.
4. Open a separate terminal in the `backend` folder.
5. Run the following command with the verified account's email:

```bash
node scripts/makeAdmin.js "admin@example.com"
```

Replace `admin@example.com` with the intended administrator's email.

The script promotes an existing verified account. It increments the
token version to invalidate previous access tokens.
It does not create an account or change its password.

Log out, then sign in at `http://localhost:5173/admin/login`.

Use the email and password chosen when registering the application account.

Only promote accounts that should have administrator access.

## Low-stock alerts

Each ingredient has a configurable alert threshold.

For a threshold of 10:

- Stock of 10 is not below the threshold.
- Stock of 9 is considered low.

The backend checks for low stock every minute.
It must remain running for scheduled checks to take place.

## Orders

Customers can select ingredients, review the total and save an order.

New orders have:

- Order status: `awaiting_payment`
- Payment status: `pending`
- Stock deducted: `false`

The server calculates prices from the database.

Each creation request uses a request ID. Repeating the same request
with the same ID returns the existing order rather than creating another.

Customers can view their latest 50 orders under My orders.
The list refreshes automatically every 10 seconds.

The administrator interface is intended to manage paid orders
whose stock has been deducted, with this progression:

```text
Order received → In kitchen → Sent to delivery
```

Pending orders are not shown in the paid-order management list.

Payment confirmation, stock deduction and the complete status progression
still need to be connected and tested together.

## Frontend checks

Run these commands from the `frontend` folder:

```bash
npm run lint
npm run build
```

Both checks passed during development.

The build command generates frontend production files inside `dist`.
These checks do not verify the complete backend or payment flow.

## Manual checks completed during development

- Email verification
- Login and profile loading
- Password recovery
- Pizza ingredient selection and price summary
- Inventory stock updates
- Saving a changed low-stock threshold
- Receiving a low-stock email with stock 9 and threshold 10
- Mobile layout at 390 × 844
- Horizontal inventory-table scrolling on a small screen
- Saving a pending order
- Displaying the saved order in customer order history

## Remaining checks

- Confirm order persistence after logging out and signing in again
- Verify that separate customer accounts cannot see each other's orders
- Test repeated order-creation requests
- Integrate and test the approved payment solution
- Implement and test automatic stock deduction without double deduction
- Test the complete customer and administrator order lifecycle

## Project status

This project is under development.

Authentication, pizza selection, inventory management, low-stock alerts
and pending-order creation are implemented.

Payment integration, automatic stock deduction and testing of the complete
paid-order lifecycle remain unfinished.