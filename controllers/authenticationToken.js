// controllers/authenticationToken.js
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(403).json({ message: 'Access denied' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
<<<<<<< HEAD
    // user = { id: <MongoDB _id> }
    req.user = user;
=======
    req.user = user; // user = { id: user._id }
>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
    next();
  });
}

module.exports = authenticateToken;
