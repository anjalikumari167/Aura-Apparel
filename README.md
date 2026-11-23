# AURA APPAREL — Node.js + Express + EJS + MySQL (Sequelize)

Full-stack demo e-commerce store. Server-rendered EJS pages, Tailwind (CDN), vanilla JS `fetch()` for the
cart / wishlist / promo / filters / checkout, MySQL via Sequelize, sessions stored in the SQL database.

## Run it

```bash
npm install
copy .env.example .env      # Windows  (Mac/Linux: cp .env.example .env)
# edit .env: SESSION_SECRET (and DB_PASSWORD if your MySQL has one). Start MySQL (XAMPP -> Start)
npm run seed                # creates tables + 20 products + promo codes + demo users (resets data!)
npm run dev                 # http://localhost:3000
```

| Login | Email | Password |
|---|---|---|
| Admin | admin@aura.com | Admin@123 |
| Customer | demo@aura.com | Demo@123 |

Promo codes: `INTERN20` (20%), `WELCOME10` (10%), `AURA15` (15%), `EXPIRED50` (inactive, to show validation).

## Folder structure (MVC)

```
config/database.js            Sequelize connection (MySQL / PostgreSQL), auto-creates the DB
models/                       User, Product, Order, OrderItem, PromoCode, CartItem, WishlistItem + index.js (associations)
controllers/                  auth, store, cart (JSON API), checkout, account, admin
routes/                       storeRoutes, authRoutes, accountRoutes, apiRoutes, adminRoutes
middleware/auth.js            loadUser, requireLogin, requireAdmin
utils/                        helpers, validators, cartService (guest + DB cart logic)
views/pages, partials, admin  EJS templates
public/js, css, img           main.js (cart drawer, wishlist, filters, toasts), checkout.js, admin.js
server.js                     Express app, sessions, error handling
seed.js                       resets + seeds the database
```

## How the key requirements work

| Requirement | Where / how |
|---|---|
| Sessions in SQL | `server.js`: `connect-session-sequelize` -> table `sessions` |
| Guest cart | `req.session.cart` (stored in `sessions`); merged into `cart_items` on login/signup (`authController.startSession` -> `cartService.mergeGuestCart`) |
| Live filtering/sorting/search | `Product.buildQuery()` builds the SQL `WHERE/ORDER`; `/shop/grid` returns an HTML fragment; `main.js` swaps the grid with `fetch()` |
| Size must be chosen | `main.js` blocks Add to Cart; server re-validates in `cartService.addItem` |
| Promo validation | `POST /api/cart/promo` looks the code up in `promo_codes` (active only); checkout re-checks it |
| **Checkout transaction** | `checkoutController.placeOrder`: `sequelize.transaction` -> lock products -> check stock -> create `Order` + `OrderItems` -> decrement `stockCount` -> clear `cart_items`. Any failure rolls everything back |
| My Orders | `/orders` (the new order appears immediately); confirmation page `/orders/:id/confirmation` |
| Admin | `/admin` (admin role only): add product, update stock, delete product, change order status (Processing -> Shipped -> Delivered) |
| Passwords | `bcryptjs` hash in `User` model (`password` virtual field) |

## Routes

Pages: `/`, `/shop`, `/product/:id`, `/login`, `/signup`, `/checkout`*, `/orders`*, `/orders/:id/confirmation`*, `/wishlist`*, `/account`*, `/admin`** (* login, ** admin)

API (JSON): `GET /api/cart`, `POST /api/cart/add|update|remove|promo|promo/remove`, `POST /api/wishlist/toggle`*, `POST /api/checkout`*, `POST /api/account`*,
`POST /admin/api/products`, `PATCH|DELETE /admin/api/products/:id`, `PATCH /admin/api/orders/:id/status`

## Test checklist (do this before your demo)

1. Browse `/shop`: tick a category, a size, a color, set a price range, change sort, type in search — grid updates without reloading.
2. Open a product, try **Add to cart without a size** — it is blocked. Pick a size, add — drawer opens.
3. As a guest add 2 items, then **log in** as `demo@aura.com` — the cart is still there (merged into the database).
4. Apply `INTERN20` (20% off), try `EXPIRED50` and a random code (both rejected).
5. Checkout: address -> payment (card 4242 4242 4242 4242) -> confirmation. Check `/orders`.
6. phpMyAdmin: `products.stockCount` went down, `orders` and `order_items` have rows, `cart_items` is empty for the user.
7. Try to order more than the stock: it fails and nothing changes.
8. Log in as admin: add a product, move an order to Shipped, then check the customer's `/orders`.
9. As the demo customer, open `/admin` — you get "Access denied".

## Notes

- `npm run seed` DROPS and recreates all tables. Don't run it after you've added data you want to keep.
- Cancelled orders are not offered in the admin UI (stock is not auto-restored).
- Security basics included: hashed passwords, httpOnly + SameSite=Lax session cookie, session id regenerated on login, prices/stock/promo re-checked on the server, safe redirects, HTML escaping. For production add HTTPS (`COOKIE_SECURE=true`), CSRF tokens, rate limiting and `helmet`.
- To use PostgreSQL: `npm install pg pg-hstore`, set `DB_DIALECT=postgres`, `DB_PORT=5432`, `DB_USER=postgres`, create the DB first.
