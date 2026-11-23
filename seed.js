// =====================================================================
// seed.js  —  (re)creates ALL tables and fills them with demo data.
//   npm run seed
// WARNING: this DROPS and recreates the tables (use only on a dev DB).
// =====================================================================
require('dotenv').config();
const { connectDB, sequelize } = require('./config/database');
const { User, Product, PromoCode } = require('./models');

if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.error('Refusing to wipe a production database. Re-run with --force if you really mean it.');
  process.exit(1);
}

// Unsplash image helper (photo IDs are common fashion/clothing photos).
// If a photo ever fails to load, just replace its ID here and re-run the seed.
const u = (id) => `https://images.unsplash.com/photo-${id}?w=900&q=80`;
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const PROMOS = [
  { code: 'INTERN20', discountPercent: 20, isActive: true },
  { code: 'WELCOME10', discountPercent: 10, isActive: true },
  { code: 'AURA15', discountPercent: 15, isActive: true },
  { code: 'EXPIRED50', discountPercent: 50, isActive: false }, // inactive on purpose (demo validation)
];

const USERS = [
  { name: 'Aura Admin', email: 'admin@aura.com', password: 'Admin@123', role: 'admin' },
  { name: 'Demo Customer', email: 'demo@aura.com', password: 'Demo@123', role: 'customer' },
];

const PRODUCTS = [
  // ---------------- TOPS ----------------
  { name: 'Essential Boxy Tee', description: 'Heavyweight 240gsm organic cotton tee with a relaxed boxy cut and reinforced collar. The everyday staple, elevated.',
    price: 45, discountPrice: null, category: 'Tops', sizes: ['XS', 'S', 'M', 'L', 'XL'], colors: ['White', 'Black', 'Sand'],
    images: [u('1521572163474-6864f9cf17ab'), u('1583743814966-8936f5b7be1a'), u('1562157873-818bc0726f68')], rating: 4.6, stockCount: 60, days: 2 },
  { name: 'Linen Camp Collar Shirt', description: 'Breathable European linen shirt with a relaxed camp collar and corozo buttons. Made for warm evenings.',
    price: 88, discountPrice: 70, category: 'Tops', sizes: ['S', 'M', 'L', 'XL'], colors: ['Ivory', 'Olive', 'Navy'],
    images: [u('1576566588028-4147f3842f27'), u('1507680434567-5739c80be1ac')], rating: 4.4, stockCount: 35, days: 5 },
  { name: 'Oxford Button-Down', description: 'Classic brushed-cotton oxford with a soft roll collar and a tailored but easy fit.',
    price: 95, discountPrice: null, category: 'Tops', sizes: ['S', 'M', 'L', 'XL'], colors: ['White', 'Sky Blue'],
    images: [u('1507680434567-5739c80be1ac'), u('1576566588028-4147f3842f27')], rating: 4.5, stockCount: 28, days: 9 },
  { name: 'Ribbed Longline Tank', description: 'Stretch-rib cotton tank with a longline hem. Layer it or wear it solo.',
    price: 38, discountPrice: 30, category: 'Tops', sizes: ['XS', 'S', 'M', 'L'], colors: ['Black', 'Cream', 'Charcoal'],
    images: [u('1618354691373-d851c5c3a990'), u('1521572163474-6864f9cf17ab')], rating: 4.2, stockCount: 48, days: 12 },
  { name: 'Satin Slip Blouse', description: 'Fluid satin blouse with a cowl neckline and a bias-cut drape that moves with you.',
    price: 110, discountPrice: null, category: 'Tops', sizes: ['XS', 'S', 'M', 'L'], colors: ['Champagne', 'Black', 'Emerald'],
    images: [u('1515886657613-9f3515b0c78f'), u('1445205170230-053b83016050')], rating: 4.7, stockCount: 22, days: 3 },
  { name: 'Breton Stripe Long Sleeve', description: 'Soft jersey long sleeve in a timeless breton stripe with a boat neck and slim fit.',
    price: 62, discountPrice: null, category: 'Tops', sizes: ['XS', 'S', 'M', 'L', 'XL'], colors: ['Navy/White', 'Black/Cream'],
    images: [u('1529374255404-311a2a4f1fd9'), u('1618354691373-d851c5c3a990')], rating: 4.2, stockCount: 38, days: 16 },

  // ---------------- BOTTOMS ----------------
  { name: 'Straight Fit Selvedge Denim', description: '14oz Japanese selvedge denim in a clean straight fit. Gets better with every wear.',
    price: 145, discountPrice: 120, category: 'Bottoms', sizes: ['28', '30', '32', '34', '36'], colors: ['Indigo', 'Washed Black'],
    images: [u('1542272604-787c3835535d'), u('1541099649105-f69ad21f3246')], rating: 4.8, stockCount: 40, days: 1 },
  { name: 'Pleated Wide-Leg Trousers', description: 'Fluid wool-blend trousers with double pleats and a high rise. Tailoring with ease.',
    price: 135, discountPrice: null, category: 'Bottoms', sizes: ['XS', 'S', 'M', 'L', 'XL'], colors: ['Charcoal', 'Stone', 'Black'],
    images: [u('1594938298603-c8148c4dae35'), u('1434389677669-e08b4cac3105')], rating: 4.5, stockCount: 26, days: 8 },
  { name: 'Relaxed Cargo Pants', description: 'Garment-dyed cotton twill cargos with articulated knees and utility pockets.',
    price: 98, discountPrice: 78, category: 'Bottoms', sizes: ['S', 'M', 'L', 'XL'], colors: ['Olive', 'Khaki', 'Black'],
    images: [u('1541099649105-f69ad21f3246'), u('1542272604-787c3835535d')], rating: 4.3, stockCount: 33, days: 15 },
  { name: 'Pleated Midi Skirt', description: 'Knife-pleated recycled-poly midi skirt with an elasticated waist. Movement in every step.',
    price: 85, discountPrice: null, category: 'Bottoms', sizes: ['XS', 'S', 'M', 'L'], colors: ['Camel', 'Black', 'Dusty Rose'],
    images: [u('1583496661160-fb5886a13d44'), u('1434389677669-e08b4cac3105')], rating: 4.4, stockCount: 30, days: 20 },

  // ---------------- OUTERWEAR ----------------
  { name: 'Wool Blend Overcoat', description: 'Single-breasted overcoat in a soft Italian wool blend, fully lined with a clean notch lapel.',
    price: 320, discountPrice: 260, category: 'Outerwear', sizes: ['S', 'M', 'L', 'XL'], colors: ['Camel', 'Charcoal', 'Black'],
    images: [u('1551028719-00167b16eac5'), u('1539109136881-3be0616acf4b')], rating: 4.9, stockCount: 14, days: 4 },
  { name: 'Washed Denim Trucker Jacket', description: 'Boxy trucker jacket in rigid denim, stone-washed for a lived-in feel.',
    price: 125, discountPrice: null, category: 'Outerwear', sizes: ['S', 'M', 'L', 'XL'], colors: ['Light Wash', 'Indigo'],
    images: [u('1591047139829-d91aecb6caea'), u('1551028719-00167b16eac5')], rating: 4.5, stockCount: 24, days: 11 },
  { name: 'Technical Shell Jacket', description: 'Lightweight water-repellent shell with taped seams and a packable hood.',
    price: 180, discountPrice: 150, category: 'Outerwear', sizes: ['S', 'M', 'L', 'XL'], colors: ['Black', 'Slate', 'Forest'],
    images: [u('1539109136881-3be0616acf4b'), u('1591047139829-d91aecb6caea')], rating: 4.6, stockCount: 18, days: 6 },

  // ---------------- KNITWEAR ----------------
  { name: 'Merino Crewneck Sweater', description: 'Fine-gauge extra-fine merino wool crewneck. Naturally temperature regulating and soft on skin.',
    price: 130, discountPrice: null, category: 'Knitwear', sizes: ['XS', 'S', 'M', 'L', 'XL'], colors: ['Oatmeal', 'Navy', 'Forest', 'Charcoal'],
    images: [u('1620799140408-edc6dcb6d633'), u('1556905055-8f358a7a47b2')], rating: 4.7, stockCount: 32, days: 7 },
  { name: 'Chunky Cable Knit Cardigan', description: 'Oversized cable-knit cardigan in a cotton-wool blend with horn buttons.',
    price: 165, discountPrice: 135, category: 'Knitwear', sizes: ['XS', 'S', 'M', 'L'], colors: ['Cream', 'Taupe'],
    images: [u('1556905055-8f358a7a47b2'), u('1620799140408-edc6dcb6d633')], rating: 4.6, stockCount: 20, days: 10 },
  { name: 'Heavyweight Hoodie', description: '450gsm brushed-back French terry hoodie with a double-layer hood and ribbed cuffs.',
    price: 105, discountPrice: null, category: 'Knitwear', sizes: ['S', 'M', 'L', 'XL', 'XXL'], colors: ['Heather Grey', 'Black', 'Bone'],
    images: [u('1556905055-8f358a7a47b2'), u('1503342217505-b0a15ec3261c')], rating: 4.8, stockCount: 52, days: 13 },

  // ---------------- DRESSES ----------------
  { name: 'Silk Slip Dress', description: 'Bias-cut washed-silk midi dress with adjustable straps and a softly draped back.',
    price: 220, discountPrice: 185, category: 'Dresses', sizes: ['XS', 'S', 'M', 'L'], colors: ['Champagne', 'Black', 'Sage'],
    images: [u('1496747611176-843222e1e57c'), u('1515886657613-9f3515b0c78f')], rating: 4.8, stockCount: 16, days: 2 },
  { name: 'Poplin Shirt Dress', description: 'Crisp cotton poplin shirt dress with a self-tie belt and a flattering A-line skirt.',
    price: 128, discountPrice: null, category: 'Dresses', sizes: ['XS', 'S', 'M', 'L', 'XL'], colors: ['White', 'Powder Blue'],
    images: [u('1529374255404-311a2a4f1fd9'), u('1445205170230-053b83016050')], rating: 4.4, stockCount: 27, days: 18 },

  // ---------------- ACCESSORIES ----------------
  { name: 'Canvas Everyday Tote', description: 'Heavy organic canvas tote with leather handles and an internal zip pocket.',
    price: 58, discountPrice: 45, category: 'Accessories', sizes: ['One Size'], colors: ['Natural', 'Black'],
    images: [u('1523381210434-271e8be1f52b'), u('1489987707025-afc232f7ea0f')], rating: 4.3, stockCount: 70, days: 25 },
  { name: 'Merino Ribbed Scarf', description: 'Generously sized merino wool scarf with a ribbed texture and brushed finish.',
    price: 65, discountPrice: null, category: 'Accessories', sizes: ['One Size'], colors: ['Camel', 'Grey', 'Navy'],
    images: [u('1441984904996-e0b6ba687e04'), u('1489987707025-afc232f7ea0f')], rating: 4.5, stockCount: 45, days: 30 },
];

async function run() {
  await connectDB();

  console.log('→ Recreating tables (this drops existing data)...');
  await sequelize.sync({ force: true });

  console.log('→ Seeding promo codes...');
  await PromoCode.bulkCreate(PROMOS);

  console.log('→ Seeding users...');
  for (const userData of USERS) await User.create(userData); // create() one-by-one so password hashing runs

  console.log('→ Seeding products...');
  // create() one-by-one so the effectivePrice hook runs for every product
  for (const { days, ...data } of PRODUCTS) {
    await Product.create({ ...data, createdAt: daysAgo(days) });
  }

  const [products, users, promos] = await Promise.all([Product.count(), User.count(), PromoCode.count()]);
  console.log('\n✔ Seed complete');
  console.log(`  ${products} products, ${users} users, ${promos} promo codes`);
  console.log('\n  Admin login    : admin@aura.com / Admin@123');
  console.log('  Customer login : demo@aura.com  / Demo@123');
  console.log('  Promo codes    : INTERN20 (20%), WELCOME10 (10%), AURA15 (15%), EXPIRED50 (inactive)\n');
}

run()
  .catch((err) => {
    console.error('\n✘ Seeding failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
