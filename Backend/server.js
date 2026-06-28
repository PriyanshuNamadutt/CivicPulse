const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");

const app = express();

dotenv.config();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.Mongo_URI)  
    .then(() => console.log('✅  MongoDB connected'))
    .catch(err => { console.error('❌  MongoDB error:', err.message); process.exit(1); });

app.use("/api", require("./routes/auth") );

const port = 5000;
app.listen( port, () => {
    console.log(`app is listening at ${port}` );
});