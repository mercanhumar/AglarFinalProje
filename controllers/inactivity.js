// controllers/inactivity.js
const inactivityTimeout = {};

module.exports = (req, res, next) => {
  const userId = req.user.userId;
  if (inactivityTimeout[userId]) {
    clearTimeout(inactivityTimeout[userId]);
  }
  inactivityTimeout[userId] = setTimeout(() => {
    console.log(`User ${userId} has been inactive for 15 minutes.`);
    // Possibly auto-logout or something
  }, 15 * 60 * 1000);
  next();
};
