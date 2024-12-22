<<<<<<< HEAD
// controllers/inactivity.js
const inactivityTimeout = {};

module.exports = (req, res, next) => {
  const userId = req.user.id;
  if (inactivityTimeout[userId]) {
    clearTimeout(inactivityTimeout[userId]);
  }
  inactivityTimeout[userId] = setTimeout(() => {
    console.log(`User ${userId} has been inactive.`);
    // Add any auto-logout logic if desired
  }, 15 * 60 * 1000); // 15 min
  next();
=======
const inactivityTimeout = {};

module.exports = (req, res, next) => {
    const userId = req.user.id;
    if (inactivityTimeout[userId]) {
        clearTimeout(inactivityTimeout[userId]);
    }

    inactivityTimeout[userId] = setTimeout(() => {
        console.log(`User ${userId} has been inactive.`);
        // Perform logout or other inactivity actions if desired
    }, 15 * 60 * 1000); // 15 minutes

    next();
>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
};
