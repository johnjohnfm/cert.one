const express = require('express');
const app = express();
const certRoutes = require('./routes/cert');

app.use(express.json());
app.use('/api', certRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
