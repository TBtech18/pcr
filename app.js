const express = require('express');
const app = express();
const path = require('path');
const mysql = require('mysql');
const argon2 = require('argon2');
const util = require('util');
require('dotenv').config();
try {
  var db = mysql.createConnection({
    host: "31.220.106.51",
    user: "u583874119_pcr",
    password: "K|8/O!*Zeqm",
    database: "u583874119_pcr",
    connectTimeout: 20000 ,
    acquireTimeout: 20000,
  });

} catch (error) {
  console.log("error");

}
db.on('error', (err) => {
  console.error('MySQL connection error:', err);

});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database');
});

const query = util.promisify(db.query).bind(db);

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));


app.get('/', (req, res) => {
  res.render('signin.ejs');
});

app.get('/signup', (req, res) => {
  res.render('signup.ejs');
});

app.get('/share', (req, res) => {
  res.render('share.ejs');
});

app.get('/calculate', (req, res) => {
  res.render('calculate.ejs');
});



app.post('/signin', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const results = await query('SELECT * FROM users WHERE email = ?', [email]);

    if (results.length === 0) {
      return res.status(401).json({ message: 'Admin not found' });
    }

    const user = results[0];


    const isPasswordValid = await argon2.verify(user.password, password);

    if (isPasswordValid) {

      return res.render("dashboard.ejs");
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

   
    await query(sql);


    res.render('dashboard.ejs');
  } catch (err) {

    console.error('Error executing query:', err);
    res.status(500).send('An error occurred while deleting the data.');
  }
});
app.get("/report", async (req, res) => {
  try {
    const sql = "SELECT * FROM monthlyreport";
    const results = await query(sql);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/share', async (req, res) => {
  const { zulfiqarshare, shareholder, qasimLabPayment } = req.body;

  try {
    const sql = 'UPDATE config SET zulfiqarshare=?, shareholder=?, qasimLabPayment=?';
    const results = await query(sql, [zulfiqarshare, shareholder, qasimLabPayment]);

    if (results.affectedRows > 0) {
      return res.send('Data updated successfully');
    } else {
      return res.send('Record not found');
    }
  } catch (err) {
    console.error('Error updating the database:', err);
    return res.status(500).send('An error occurred while updating the data.');
  }
});

app.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {

    const existingUser = await query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'Email already exists.' });
    }


    const hashedPassword = await argon2.hash(password);

    await query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword]);

    res.status(201).json({ success: true, message: 'Account created successfully.' });
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/calculate', async (req, res) => {
  const { fromDate, toDate, perTestCost, purchases, expenditures } = req.body;

  try {
    const salesQuery = "SELECT SUM(od.Price) AS total_price, SUM(od.qty) AS total_quantity FROM order_details AS od WHERE od.product_name LIKE '%PCR%' AND od.submited_date BETWEEN ? AND ?";

    const salesResults = await query(salesQuery, [fromDate, toDate]);
    const totalSales = salesResults[0].total_price || 0;
    const totalTests = salesResults[0].total_quantity || 0;

    const configQuery = `SELECT ZulfiqarShare, shareholder, qasimLabPayment FROM config`;

    const configResults = await query(configQuery);
    const share = configResults[0].ZulfiqarShare || 0;
    const numParticipants = configResults[0].shareholder || 0;
    const QLP = configResults[0].qasimLabPayment || 0;

    const qasimLabPayment = QLP * totalTests;
    const totalCost = perTestCost * totalTests;
    const zulfiqarShare = share * totalTests;
    const profit = totalSales - totalCost - zulfiqarShare;
    const finalProfit = profit - (expenditures + purchases + qasimLabPayment);
    const sharePerParticipant = numParticipants > 0 ? finalProfit / numParticipants : 0;

    const reportInsertQuery = `INSERT INTO monthlyreport (from_date, to_date, total_tests, total_sales, total_cost, profit, zulfiqar_share, final_profit, qasim_lab_payment, num_participants, share_per_participant)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const reportValues = [fromDate, toDate, totalTests, totalSales, totalCost, profit, zulfiqarShare, finalProfit, qasimLabPayment, numParticipants, sharePerParticipant];
    await query(reportInsertQuery, reportValues);

    console.log('Report data inserted successfully.');
    res.json({
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

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
