# Pizza Delivery

Full-stack project for the Oasis Infobyte Web Development internship.

Developed by Leona Bytyqi.

## About

Pizza Delivery allows customers to register, verify their email, log in,
build a pizza and pay through Razorpay Test Mode.

Customers can review the total and follow their orders. Administrators can
manage ingredient stock, configure low-stock alerts and move confirmed
orders through preparation and delivery.

Prices and order totals use euros (EUR). The payment integration is for
testing only; it does not process real charges.

## Technologies

- React and Vite
- CSS
- Node.js and Express
- MongoDB and Mongoose
- JSON Web Tokens
- bcryptjs
- Nodemailer
- node-cron
- Razorpay Node.js SDK and Standard Checkout

## Implemented features

- Registration and email verification
- Login and protected API routes
- Password recovery by email
- Separate customer and administrator login pages
- Pizza menu and step-by-step pizza builder
- One base, one sauce and one cheese per pizza
- Optional selection of multiple vegetables
- Prices calculated by the backend
- Saving orders before payment
- Customer order history with automatic refresh
- Razorpay Test Mode checkout in EUR
- Backend payment-signature verification and payment-status checks
- Confirmation only after the backend verifies a captured payment
- Automatic stock deduction when a paid order is confirmed
- Transactional order and inventory updates
- A stock-deduction guard for repeated payment confirmations
- Payment-status recovery through the Check payment status button
- Payment-review status when payment succeeds but ingredients are unavailable
- Administrator inventory dashboard
- Manual stock updates and configurable low-stock thresholds
- Scheduled low-stock email notifications
- Administrator order list including paid orders requiring stock review
- Administrator controls for preparation and delivery statuses
- Responsive layout for desktop and mobile screens

## Project folders

- `backend`: API, database models, authentication, scripts and email utilities
- `frontend`: React application and styles

## Local setup

### Requirements

- Node.js and npm
- A MongoDB deployment that supports multi-document transactions, such as
  a MongoDB Atlas cluster
- A Gmail account with an App Password for sending emails
- A Razorpay account with Test Mode API keys
- Internet access for MongoDB Atlas, email delivery and Razorpay

Payment confirmation and stock deduction use MongoDB transactions. See the
[MongoDB transaction documentation](https://www.mongodb.com/docs/manual/core/transactions/)
for supported deployment types.

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

RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret
```

- `MONGO_USER` and `MONGO_PASSWORD` are database-user credentials.
- `JWT_SECRET` is a long random secret used to sign access tokens.
- `GMAIL_APP_PASSWORD` is a Gmail App Password, not the normal Gmail password.
- `ADMIN_ALERT_EMAIL` receives low-stock notifications.
- Both Razorpay keys must belong to the same Test Mode key pair.
- `RAZORPAY_KEY_SECRET` stays on the backend. Do not add it to frontend code.

The current payment routes require a key ID beginning with `rzp_test_`.
Live keys are rejected.

Keep real credentials in `backend/.env`. Never commit that file or include
real passwords or key secrets in this README. Restart the backend after
changing environment variables.

### Start the backend

From the project folder, run these commands one at a time:

```bash
cd backend
npm ci
npm start
```

The API runs at http://localhost:5000.

For automatic restart during development, use this instead of `npm start`:

```bash
npm run dev
```

Run only one backend process at a time.

### Start the frontend

Open another terminal in the project folder and run:

```bash
cd frontend
npm ci
npm run dev -- --port 5173 --strictPort
```

Open http://localhost:5173.

Keep both servers running while using the application. The current
configuration uses localhost URLs, so open the application on the same
computer that runs the servers.

### Connection troubleshooting

- For an Atlas connection failure, check the cluster, database credentials,
  network connection and IP Access List. If the public IP changed, add the
  current IP in the correct Atlas project and wait for the rule to become active.
- `Cannot GET /` at `localhost:5000` is expected because the API has no root page.
  Open the frontend at `localhost:5173` to use the application.
- If `localhost:5173` refuses the connection, check that the frontend development
  server is running in its own terminal.
- If backend startup reports `EADDRINUSE` on port `5000`, another process is
  already using that port. Stop the existing backend with Ctrl+C in its terminal,
  then start one backend process.

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

Public registration creates customer accounts. Administrator access
requires an account with the administrator role.

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
2. Register an account at http://localhost:5173/register.
3. Verify the account using the emailed link.
4. Open a separate terminal in the `backend` folder.
5. Run the following command with the verified account's email:

```bash
node scripts/makeAdmin.js "admin@example.com"
```

Replace `admin@example.com` with the intended administrator's email.

The script promotes an existing verified account. It increments the token
version to invalidate previous access tokens. It does not create an account
or change its password.

Log out, then sign in at http://localhost:5173/admin/login using the email
and password chosen when registering the application account.

Only promote accounts that should have administrator access.

## Low-stock alerts

Each ingredient has a configurable alert threshold.

For a threshold of 10:

- Stock of 10 is not below the threshold.
- Stock of 9 is considered low.

The backend checks for low stock every minute. It must remain running for
scheduled checks to take place.

## Orders and inventory

Customers select ingredients, review the total and save an order.
The server calculates prices from the database.

New orders have:

- Order status: `awaiting_payment`
- Payment status: `pending`
- Stock deducted: `false`

Saving an order does not reserve or deduct stock. Each creation request
uses a request ID; repeating the same request with the same ID returns
the existing order.

Customers can view their latest 50 orders under My orders. The list
refreshes automatically every 10 seconds.

### Payment confirmation and stock deduction

The backend creates or reuses a Razorpay order for the saved order's amount
and currency. It verifies the checkout signature and retrieves the payment
from Razorpay before confirming the local order.

Only a captured, unrefunded payment with the matching order, amount and
currency can be used to confirm the order.

When ingredients are available, a MongoDB transaction deducts stock and sets:

- Payment status: `paid`
- Order status: `order_received`
- Stock deducted: `true`

Each selected ingredient consumes one stock unit. The confirmation code
checks `stockDeducted` so a repeated confirmation returns the confirmed
order without deducting stock again or resetting its delivery status.

An unsuccessful payment does not confirm the order or deduct stock.
If checkout closes or the result is uncertain, use Check payment status
before starting another payment. An authorized payment is not treated as
a captured payment.

### Paid orders awaiting stock review

Stock is checked again during confirmation. If payment was captured but
an ingredient is unavailable, the order is saved with:

- Payment status: `paid`
- Order status: `payment_review`
- Stock deducted: `false`

No ingredients are partially deducted in this case. The order is included
in the administrator list and uses the label
"Payment received — stock review required".

The administrator can replenish unavailable ingredients. The customer can
then use Check payment status on the same order to retry confirmation.
When stock is available, the backend deducts it and changes the order to
`order_received`. Another payment is not required.

The application does not currently provide an administrator button to
retry confirmation or issue a refund. Recovery after restocking has been
manually tested using the customer's Check payment status button.

### Administrator order statuses

The administrator can view the latest 100 paid orders with deducted stock
or a `payment_review` status. Pending orders are excluded from this list.
Use Refresh orders to reload it.

Confirmed orders progress through these statuses:

| Current status | Administrator action | Next status |
| --- | --- | --- |
| `order_received` | Move to kitchen | `in_kitchen` |
| `in_kitchen` | Send to delivery | `sent_to_delivery` |
| `sent_to_delivery` | No further transition | — |

The status API only advances paid orders whose stock has been deducted.
Orders in `payment_review` cannot advance to preparation until stock
confirmation succeeds.

## Razorpay test payments

Use the application's Pay button under My orders. All payment endpoints
require the signed-in customer's access token and check order ownership.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/payments/create` | Prepare checkout for a saved order |
| POST | `/api/payments/verify` | Verify the checkout response and confirm payment |
| POST | `/api/payments/check` | Retrieve payment status and retry confirmation |

### Test card

The following domestic Visa test card was used successfully in the project's
EUR checkout:

| Field | Test value |
| --- | --- |
| Card number | `4100 2800 0000 1007` |
| Expiry | Any future expiry date |
| CVV | Any three digits, for example `123` |
| Cardholder | `Leona Test` |

Use test card data with Test Mode keys. No real money is charged.
If a mock bank page opens, choose Success or Failure to test the result.
See [Razorpay's integration and test-card documentation](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/).

An international test card previously returned
`international_transaction_not_allowed` on the development account.
The domestic card above worked in the tested EUR flow. This test result
does not establish eligibility for a live merchant account.

### Suggested manual payment checks

1. Record stock quantities for the selected ingredients.
2. Save an order and open its checkout from My orders.
3. Complete a successful test payment.
4. Confirm that the application shows Paid and Order received.
5. Reload administrator inventory and check that each selected ingredient
   decreased by one.
6. Move the order to In kitchen, then Sent to delivery.
7. Check that the customer's order list reflects the updated statuses.

For a failure test, use a separate unpaid order, choose Failure on the mock
page and verify that stock stays unchanged. Check payment status before
retrying that same order with Success.

## Frontend checks

Run these commands from the `frontend` folder, one at a time:

```bash
npm run lint
npm run build
```

Both checks passed after the payment and administrator-list changes.

The build command generates frontend production files inside `dist`.
These checks do not verify the complete backend or payment flow.

## Manual checks completed during development

- Email verification, login and profile loading
- Password recovery
- Pizza ingredient selection and price summary
- Saving an order and displaying it in customer order history
- Inventory stock updates and low-stock threshold changes
- Receiving a low-stock email with stock 9 and threshold 10
- Mobile layout at 390 × 844 and horizontal inventory-table scrolling
- Successful Razorpay Test Mode payment in EUR
- Displaying Paid and Order received after confirmation
- Showing confirmed orders in the administrator list
- Administrator progression from Order received to In kitchen to Sent to delivery
- Customer order status updating to In kitchen and Sent to delivery
- Failed test payment leaving stock unchanged
- Successful retry deducting one stock unit from the checked ingredients
- Customer order history and paid statuses persisting after logout and login
- A separate customer account displaying none of the first customer's orders
- Stock becoming unavailable after checkout opens, followed by a captured test payment
- Paid stock-review orders appearing in both customer and administrator lists
- No partial ingredient deduction while an order requires stock review
- Restocking and confirming the same review order without another payment
- Two sequential payment-status checks on a confirmed order leaving stock unchanged

During the failure-and-retry check, Thick Crust stayed at 50 and Tomato
stayed at 49 after failure. After the successful retry, their quantities
were 49 and 48 respectively.

During the stock-review check, Classic was set to 0 after checkout opened.
After payment, the order showed Paid and stock review required. Classic
remained at 0, Tomato at 48 and Mozzarella at 49. After Classic was restocked
to 50, Check payment status confirmed the same order. The quantities became
Classic 49, Tomato 47 and Mozzarella 48.

Two subsequent sequential requests to `POST /api/payments/check` returned
`verified: true`, `paymentStatus: paid`, `stockDeducted: true` and
`status: order_received`. Reloading inventory showed:

| Ingredient | Before repeated checks | After repeated checks |
| --- | --- | --- |
| Classic | 49 | 49 |
| Tomato | 47 | 47 |
| Mozzarella | 48 | 48 |

This check covered sequential repeats on an already confirmed order.

## Remaining checks

- Test cross-account payment requests directly against the API, beyond the
  customer-history isolation check completed in the interface.
- Test repeated order-creation requests against the running API.
- Test interrupted confirmation and concurrent confirmation requests.
- Verify setup from a fresh clone using only the documented configuration.

## Current limitations

- The integration accepts Razorpay Test Mode keys only.
- Signed payment webhooks are not implemented. Confirmation currently uses
  the checkout handler and backend API checks. If a callback is interrupted,
  the customer may need to use Check payment status.
- My orders refreshes the saved database state; that refresh alone does not
  query Razorpay or recover an interrupted payment confirmation.
- Stock is not reserved while an order awaits payment.
- Refunds are not implemented in the application.
- Deployment URLs and production configuration have not been added.

## Project status

Authentication, pizza selection, inventory management, low-stock alerts,
Razorpay test payments, automatic stock deduction and administrator order
progression are implemented.

The main local test-payment flow, stock-review recovery, customer status
updates and repeated payment-status checks have been exercised. The
remaining checks listed above have not yet been completed. The project is
a local internship demonstration and has not been validated for live payments.
