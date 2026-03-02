import express from "express";
import Database from "better-sqlite3";

const db = new Database("sinostock.db");

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT, -- 'admin', 'tienda', 'bodega'
    full_name TEXT
  );

  CREATE TABLE IF NOT EXISTS containers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    arrival_date TEXT,
    status TEXT -- 'en_camino', 'recibido'
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    internal_code TEXT UNIQUE,
    name TEXT,
    category_id INTEGER,
    price REAL,
    cost REAL,
    stock INTEGER,
    container_id INTEGER,
    warehouse_id INTEGER,
    image_url TEXT,
    FOREIGN KEY(category_id) REFERENCES categories(id),
    FOREIGN KEY(container_id) REFERENCES containers(id),
    FOREIGN KEY(warehouse_id) REFERENCES warehouses(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE,
    user_id INTEGER,
    order_date TEXT,
    total REAL,
    status TEXT, -- 'pendiente', 'pagado', 'despachado'
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS order_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    unit_price REAL,
    subtotal REAL,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT,
    table_name TEXT,
    timestamp TEXT,
    details TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Ensure roles exist
const roleCount = db.prepare("SELECT COUNT(*) as count FROM roles").get() as { count: number };
if (roleCount.count === 0) {
  db.prepare("INSERT INTO roles (name) VALUES (?)").run("ADMIN");
  db.prepare("INSERT INTO roles (name) VALUES (?)").run("TIENDA");
  db.prepare("INSERT INTO roles (name) VALUES (?)").run("BODEGA");
}

// Helper for audit
const logAudit = (userId: number | null, action: string, tableName: string, details: string) => {
  db.prepare("INSERT INTO audit (user_id, action, table_name, timestamp, details) VALUES (?, ?, ?, ?, ?)")
    .run(userId, action, tableName, new Date().toISOString(), details);
};

const ensureOrderDetailsTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      unit_price REAL,
      subtotal REAL,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
  `);
};

// Seed initial data if empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  db.prepare("INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)").run("admin", "admin123", "admin", "Administrador Principal");
  db.prepare("INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)").run("tienda", "tienda123", "tienda", "Encargado Tienda");
  db.prepare("INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)").run("bodega", "bodega123", "bodega", "Jefe de Bodega");

  db.prepare("INSERT INTO categories (name) VALUES (?)").run("Electrónica");
  db.prepare("INSERT INTO categories (name) VALUES (?)").run("Hogar");
  db.prepare("INSERT INTO categories (name) VALUES (?)").run("Juguetes");
  db.prepare("INSERT INTO categories (name) VALUES (?)").run("Moda");
  db.prepare("INSERT INTO categories (name) VALUES (?)").run("Herramientas");

  db.prepare("INSERT INTO warehouses (name) VALUES (?)").run("Bodega Central - GYE");
  db.prepare("INSERT INTO warehouses (name) VALUES (?)").run("Bodega Norte - UIO");

  db.prepare("INSERT INTO containers (code, arrival_date, status) VALUES (?, ?, ?)").run("CONT-CHN-2024-001", "2024-02-15", "recibido");
  
  db.prepare(`INSERT INTO products (internal_code, name, category_id, price, cost, stock, container_id, warehouse_id, image_url) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    "PROD-001", "Smartphone Dragon X1", 1, 299.99, 150.00, 45, 1, 1, "https://picsum.photos/seed/phone/800/800"
  );
  db.prepare(`INSERT INTO products (internal_code, name, category_id, price, cost, stock, container_id, warehouse_id, image_url) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    "PROD-002", "Set de Cocina Imperial", 2, 85.00, 35.00, 120, 1, 1, "https://picsum.photos/seed/kitchen/800/800"
  );
  db.prepare(`INSERT INTO products (internal_code, name, category_id, price, cost, stock, container_id, warehouse_id, image_url) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    "PROD-003", "Drone Explorer Pro", 1, 450.00, 210.00, 15, 1, 2, "https://picsum.photos/seed/drone/800/800"
  );
  db.prepare(`INSERT INTO products (internal_code, name, category_id, price, cost, stock, container_id, warehouse_id, image_url) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    "PROD-004", "Lámpara Solar Jardín", 2, 12.50, 4.20, 300, 1, 1, "https://picsum.photos/seed/solar/800/800"
  );
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = Number(process.env.PORT) || 7002;

  app.get("/api/health", (req, res) => {
    res.json({ ok: true, service: "backend", port: PORT });
  });

  // --- API Routes ---

  // Public Products (No Auth)
  app.get("/api/public/products", (req, res) => {
    const products = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.stock > 0
    `).all();
    res.json(products);
  });

  // Auth
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT id, username, role, full_name FROM users WHERE username = ? AND password = ?").get(username, password);
    if (user) {
      logAudit(user.id as number, "LOGIN", "users", "Inicio de sesión exitoso");
      res.json(user);
    } else {
      res.status(401).json({ error: "Credenciales inválidas" });
    }
  });

  app.post("/api/public/register", (req, res) => {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: "Datos de usuario incompletos" });
    }

    const existingUser = db.prepare("SELECT id FROM users WHERE username = ?").get(email);
    if (existingUser) {
      const user = db.prepare("SELECT id, username, role, full_name FROM users WHERE username = ?").get(email);
      return res.json(user);
    }

    try {
      const result = db
        .prepare("INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)")
        .run(email, password, "tienda", full_name);

      const user = db
        .prepare("SELECT id, username, role, full_name FROM users WHERE id = ?")
        .get(result.lastInsertRowid);

      logAudit(user?.id as number, "REGISTER", "users", `Registro público: ${email}`);
      res.json(user);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Dashboard Stats
  app.get("/api/stats", (req, res) => {
    const totalStock = db.prepare("SELECT SUM(stock) as total FROM products").get() as { total: number };
    const lowStock = db.prepare("SELECT COUNT(*) as count FROM products WHERE stock < 20").get() as { count: number };
    const pendingOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'pendiente'").get() as { count: number };
    const paidOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'pagado'").get() as { count: number };
    const recentProducts = db.prepare("SELECT * FROM products ORDER BY id DESC LIMIT 5").all();
    
    res.json({
      totalStock: totalStock.total || 0,
      lowStock: lowStock.count,
      pendingOrders: pendingOrders.count,
      paidOrders: paidOrders.count,
      recentProducts
    });
  });

  // Inventory
  app.get("/api/products", (req, res) => {
    const products = db.prepare(`
      SELECT p.*, c.name as category_name, cont.code as container_code, w.name as warehouse_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN containers cont ON p.container_id = cont.id
      LEFT JOIN warehouses w ON p.warehouse_id = w.id
    `).all();
    res.json(products);
  });

  app.post("/api/products", (req, res) => {
    const { internal_code, name, category_id, price, cost, stock, container_id, warehouse_id, image_url } = req.body;
    try {
      const result = db.prepare(`
        INSERT INTO products (internal_code, name, category_id, price, cost, stock, container_id, warehouse_id, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(internal_code, name, category_id, price, cost, stock, container_id, warehouse_id, image_url);
      res.json({ id: result.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Orders
  app.get("/api/orders", (req, res) => {
    const orders = db.prepare(`
      SELECT o.*, u.full_name as user_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.id DESC
    `).all();
    res.json(orders);
  });

  app.get("/api/orders/:id", (req, res) => {
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
    const details = db.prepare(`
      SELECT od.*, p.name as product_name, p.internal_code
      FROM order_details od
      JOIN products p ON od.product_id = p.id
      WHERE od.order_id = ?
    `).all(req.params.id);
    res.json({ ...order, details });
  });

  app.post("/api/orders", (req, res) => {
    const { user_id, items, total } = req.body;
    const orderNumber = `ORD-${Date.now()}`;
    const date = new Date().toISOString();

    ensureOrderDetailsTable();

    const transaction = db.transaction(() => {
      const orderResult = db.prepare(`
        INSERT INTO orders (order_number, user_id, order_date, total, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(orderNumber, user_id, date, total, 'pendiente');

      const orderId = orderResult.lastInsertRowid;

      for (const item of items) {
        db.prepare(`
          INSERT INTO order_details (order_id, product_id, quantity, unit_price, subtotal)
          VALUES (?, ?, ?, ?, ?)
        `).run(orderId, item.id, item.quantity, item.price, item.price * item.quantity);

        // Update Stock
        db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").run(item.quantity, item.id);
      }

      return orderId;
    });

    try {
      const orderId = transaction();
      res.json({ id: orderId, orderNumber });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/orders/:id/status", (req, res) => {
    const { status } = req.body;
    db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, req.params.id);
    res.json({ success: true });
  });

  // Containers & Categories
  app.get("/api/containers", (req, res) => res.json(db.prepare("SELECT * FROM containers").all()));
  app.get("/api/categories", (req, res) => res.json(db.prepare("SELECT * FROM categories").all()));
  app.get("/api/warehouses", (req, res) => res.json(db.prepare("SELECT * FROM warehouses").all()));

  app.post("/api/products/bulk", (req, res) => {
    const products = req.body;
    const insert = db.prepare(`
      INSERT INTO products (internal_code, name, category_id, price, cost, stock, container_id, warehouse_id, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((items) => {
      for (const item of items) {
        // Find or create category/container/warehouse if they were strings in excel
        // For simplicity in this demo, we assume IDs are provided or we map them
        // In a real app, we'd look up by name
        insert.run(
          item.internal_code,
          item.name,
          item.category_id || 1,
          item.price,
          item.cost,
          item.stock,
          item.container_id || 1,
          item.warehouse_id || 1,
          item.image_url || "https://picsum.photos/seed/new/400/400"
        );
      }
    });

    try {
      transaction(products);
      res.json({ success: true, count: products.length });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // --- Urbano & Payment Integration ---

  // Mock Urbano Credentials (In a real app, these would be in .env)
  const URBANO_CONFIG = {
    user: process.env.URBANO_USER || "1010-WebService",
    pass: process.env.URBANO_PASS || "1qasw27ygfsdernh",
    id_contrato: process.env.URBANO_CONTRATO || "1010"
  };

  // Cotizar Envío (Urbano)
  app.post("/api/shipping/quote", async (req, res) => {
    const { destination_ubigeo, weight, pieces } = req.body;
    
    // According to manual section 1.5
    // In a real scenario, we would call: https://app.urbano.com.ec/ws/ue/cotizarenvio
    // For this demo, we simulate a response based on the manual's structure
    
    const mockQuote = [
      {
        "error_sql": "0",
        "error_info": "",
        "id_servicio": "1",
        "servicio": "Distribucion",
        "valor_ennvio": "3.50",
        "time_envio": "1 00:00"
      },
      {
        "error_sql": "0",
        "error_info": "",
        "id_servicio": "3",
        "servicio": "Seguro",
        "valor_ennvio": "0.50"
      }
    ];

    res.json(mockQuote);
  });

  // Confirm Payment & Generate Urbano Guide
  app.post("/api/checkout", async (req, res) => {
    const { order_id, shipping_data, payment_method } = req.body;

    try {
      // 1. Simulate Payment Processing (e.g. Stripe)
      // const paymentIntent = await stripe.paymentIntents.create({...});
      
      // 2. Update Order Status to 'pagado'
      db.prepare("UPDATE orders SET status = 'pagado' WHERE id = ?").run(order_id);

      // 3. Generate Urbano Guide (Section 1.1 of manual)
      // We simulate the call to https://app.urbano.com.ec/ws/ue/ge
      const urbanoPayload = {
        "json": JSON.stringify({
          "linea": "3",
          "id_contrato": URBANO_CONFIG.id_contrato,
          "cod_rastreo": `SINO-${order_id}`,
          "nom_cliente": shipping_data.name,
          "dir_entrega": shipping_data.address,
          "ubi_direc": shipping_data.ubigeo, // 6 digit code
          "nro_telf": shipping_data.phone,
          "peso_total": shipping_data.weight,
          "pieza_total": shipping_data.pieces,
          "productos": shipping_data.items.map((item: any) => ({
            "cod_sku": item.internal_code,
            "descr_sku": item.name,
            "cantidad_sku": item.quantity
          }))
        })
      };

      // Mocking Urbano Response
      const mockUrbanoResponse = {
        "error": 1,
        "mensaje": "OK",
        "guía": `URB${Math.floor(10000000 + Math.random() * 90000000)}`
      };

      res.json({
        success: true,
        payment_status: "succeeded",
        shipping_guide: mockUrbanoResponse.guía,
        message: "Pago procesado y guía de Urbano generada correctamente"
      });

    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
