const express = require('express');
const mysql = require('mysql2');
const argon2 = require('argon2');
const cors = require('cors');

// Initialize express app
const app = express();

// Create a pool of connections using mysql2
const pool = mysql.createPool({
  host: "31.220.106.51",
  user: "u583874119_pcr",
  password: "K|8/O!*Zeqm",
  database: "u583874119_pcr",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 20000,
  acquireTimeout: 20000
});

// Promisify the pool.query method for easier usage with async/await
const promisePool = pool.promise();

// Handle pool errors
pool.on('error', (err) => {
  console.error('MySQL pool error:', err);
});

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/",(req,res)=>{
  res.send("Hello!!")
});
// Route handlers
app.post('/signin', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const [results] = await promisePool.query('SELECT * FROM users WHERE email = ?', [email]);

    if (results.length === 0) {
      return res.status(401).json({ message: 'Admin not found' });
    }

    const user = results[0];
    const isPasswordValid = await argon2.verify(user.password, password);

    if (isPasswordValid) {
      return res.status(200).json({ message: 'Sign in successful' });
    } else {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Error verifying password:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

app.get('/delete', async (req, res) => {
  try {
    const sql = 'TRUNCATE TABLE monthlyreport';
    await promisePool.query(sql);
    res.status(200).json({ message: 'Data deleted successfully' });
  } catch (err) {
    console.error('Error executing query:', err);
    res.status(500).json({ message: 'An error occurred while deleting the data.' });
  }
});

app.get("/report", async (req, res) => {
  try {
    const sql = "SELECT * FROM monthlyreport";
    const [results] = await promisePool.query(sql);
    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/share', async (req, res) => {
  const { zulfiqarshare, shareholder, qasimLabPayment } = req.body;

  try {
    const sql = 'UPDATE config SET zulfiqarshare=?, shareholder=?, qasimLabPayment=?';
    const [results] = await promisePool.query(sql, [zulfiqarshare, shareholder, qasimLabPayment]);

    if (results.affectedRows > 0) {
      return res.status(200).json({ message: 'Data updated successfully' });
    } else {
      return res.status(404).json({ message: 'Record not found' });
    }
  } catch (err) {
    console.error('Error updating the database:', err);
    return res.status(500).json({ message: 'An error occurred while updating the data.' });
  }
});

app.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const [existingUser] = await promisePool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'Email already exists.' });
    }

    const hashedPassword = await argon2.hash(password);
    await promisePool.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword]);

    res.status(201).json({ success: true, message: 'Account created successfully.' });
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/calculate', async (req, res) => {
  const { fromDate, toDate, perTestCost, purchases, expenditures } = req.body;

  try {
    const salesQuery = "SELECT SUM(od.Price) AS total_price, SUM(od.qty) AS total_quantity FROM order_details AS od WHERE od.product_id IN (200,201,202,203) AND od.submited_date BETWEEN ? AND ?";
    const [salesResults] = await promisePool.query(salesQuery, [fromDate, toDate]);
    const totalSales = salesResults[0].total_price;
    const totalTests = salesResults[0].total_quantity;

    const configQuery = `SELECT ZulfiqarShare, shareholder, qasimLabPayment FROM config`;
    const [configResults] = await promisePool.query(configQuery);
    const share = configResults[0].ZulfiqarShare;
    const numParticipants = configResults[0].shareholder;
    const QLP = configResults[0].qasimLabPayment;

    const qasimLabPayment = QLP * totalTests;
    const totalCost = perTestCost * totalTests;
    const zulfiqarShare = share * totalTests;
    const profit = totalSales - totalCost - zulfiqarShare;
    const finalProfit = profit - (expenditures + purchases + qasimLabPayment);
    const sharePerParticipant = numParticipants > 0 ? finalProfit / numParticipants : 0;

    const reportInsertQuery = `INSERT INTO monthlyreport (from_date, to_date, total_tests, total_sales, total_cost, profit, zulfiqar_share, final_profit, qasim_lab_payment, num_participants, share_per_participant)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const reportValues = [fromDate, toDate, totalTests, totalSales, totalCost, profit, zulfiqarShare, finalProfit, qasimLabPayment, numParticipants, sharePerParticipant];
    await promisePool.query(reportInsertQuery, reportValues);

    console.log('Report data inserted successfully.');
    res.status(200).json({
      totalTests,
      totalSales,
      totalCost,
      profit,
      zulfiqarShare,
      finalProfit,
      qasimLabPayment,
      numParticipants,
      sharePerParticipant
    });
  } catch (err) {
    console.error('Error processing calculation:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Define the port
const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
