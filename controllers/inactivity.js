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
};
