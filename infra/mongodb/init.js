// ═══════════════════════════════════════════════════════════════════════════
// NextGen Marketplace - MongoDB Initialization Script
// ═══════════════════════════════════════════════════════════════════════════

// Switch to the catalog database
db = db.getSiblingDB('nextgen_catalog');

// Create application user
db.createUser({
  user: 'nextgen_app',
  pwd: 'nextgen_app_secret_2024',
  roles: [
    { role: 'readWrite', db: 'nextgen_catalog' },
    { role: 'dbAdmin', db: 'nextgen_catalog' },
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// COLLECTIONS SETUP
// ═══════════════════════════════════════════════════════════════════════════

// Products Collection
db.createCollection('products', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'slug', 'vendorId', 'categoryId', 'price', 'status'],
      properties: {
        _id: { bsonType: 'string' },
        name: { bsonType: 'string', minLength: 1, maxLength: 500 },
        slug: { bsonType: 'string', pattern: '^[a-z0-9-]+$' },
        vendorId: { bsonType: 'string' },
        categoryId: { bsonType: 'string' },
        price: { bsonType: 'decimal' },
        status: { enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED', 'OUT_OF_STOCK'] },
        specifications: { bsonType: 'object' },
        attributes: { bsonType: 'object' },
        images: { bsonType: 'array', items: { bsonType: 'string' } },
        tags: { bsonType: 'array', items: { bsonType: 'string' } },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    },
  },
});

// Categories Collection (Hierarchical)
db.createCollection('categories', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'slug', 'level', 'isActive'],
      properties: {
        _id: { bsonType: 'string' },
        name: { bsonType: 'string', minLength: 1, maxLength: 200 },
        slug: { bsonType: 'string', pattern: '^[a-z0-9-]+$' },
        parentId: { bsonType: ['string', 'null'] },
        level: { bsonType: 'int', minimum: 0 },
        path: { bsonType: 'string' },
        attributeSchema: { bsonType: 'array' },
        isActive: { bsonType: 'bool' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    },
  },
});

// Reviews Collection
db.createCollection('reviews', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['productId', 'userId', 'overallRating', 'comment'],
      properties: {
        _id: { bsonType: 'string' },
        productId: { bsonType: 'string' },
        userId: { bsonType: 'string' },
        overallRating: { bsonType: 'int', minimum: 1, maximum: 5 },
        comment: { bsonType: 'string', maxLength: 5000 },
        images: { bsonType: 'array', items: { bsonType: 'string' } },
        isVerifiedPurchase: { bsonType: 'bool' },
        status: { enum: ['pending', 'approved', 'rejected'] },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    },
  },
});

// AI Embeddings Collection
db.createCollection('ai_embeddings', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['productId', 'embedding', 'embeddingModel'],
      properties: {
        _id: { bsonType: 'string' },
        productId: { bsonType: 'string' },
        embedding: { bsonType: 'array', items: { bsonType: 'double' } },
        embeddingModel: { bsonType: 'string' },
        lastUpdated: { bsonType: 'date' },
      },
    },
  },
});

// Inventory Logs Collection (Time-series like)
db.createCollection('inventory_logs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['productId', 'type', 'quantity', 'previousStock', 'newStock'],
      properties: {
        _id: { bsonType: 'string' },
        productId: { bsonType: 'string' },
        variantId: { bsonType: ['string', 'null'] },
        type: { bsonType: 'string' },
        quantity: { bsonType: 'int' },
        previousStock: { bsonType: 'int' },
        newStock: { bsonType: 'int' },
        reason: { bsonType: 'string' },
        userId: { bsonType: ['string', 'null'] },
        createdAt: { bsonType: 'date' },
      },
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// INDEXES SETUP
// ═══════════════════════════════════════════════════════════════════════════

// Products Indexes
db.products.createIndex({ slug: 1 }, { unique: true });
db.products.createIndex({ vendorId: 1, status: 1 });
db.products.createIndex({ categoryId: 1, status: 1 });
db.products.createIndex({ status: 1, price: 1 });
db.products.createIndex(
  { name: 'text', 'specifications.brand': 'text', tags: 'text' },
  {
    default_language: 'none',
    name: 'product_search_index',
  }
);
db.products.createIndex({ 'attributes.brand': 1 });
db.products.createIndex({ createdAt: -1 });
db.products.createIndex({ updatedAt: -1 });

// Categories Indexes
db.categories.createIndex({ slug: 1 }, { unique: true });
db.categories.createIndex({ parentId: 1, level: 1 });
db.categories.createIndex({ path: 1 });
db.categories.createIndex({ isActive: 1, level: 1 });

// Reviews Indexes
db.reviews.createIndex({ productId: 1, status: 1 });
db.reviews.createIndex({ userId: 1 });
db.reviews.createIndex({ overallRating: 1 });
db.reviews.createIndex({ createdAt: -1 });
db.reviews.createIndex({ productId: 1, createdAt: -1 });

// AI Embeddings Indexes
db.ai_embeddings.createIndex({ productId: 1 }, { unique: true });
db.ai_embeddings.createIndex({ embeddingModel: 1 });

// Inventory Logs Indexes (Time-series optimized)
db.inventory_logs.createIndex({ productId: 1, createdAt: -1 });
db.inventory_logs.createIndex({ type: 1, createdAt: -1 });
db.inventory_logs.createIndex({ createdAt: -1 });

print('✅ MongoDB initialization completed successfully!');
print('📊 Collections created: products, categories, reviews, ai_embeddings, inventory_logs');
print('🔍 Indexes created for optimal query performance');
print('👤 Application user created: nextgen_app');
