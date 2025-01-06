const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
    callerId: { type: String, required: true },
    recipientId: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    status: {
        type: String,
        enum: ['initiated', 'connected', 'ended', 'missed', 'rejected'],
        default: 'initiated'
    },
    duration: { type: Number }, // in seconds
});

// Calculate call duration before saving
callSchema.pre('save', function(next) {
    if (this.endTime && this.startTime) {
        this.duration = Math.floor((this.endTime - this.startTime) / 1000);
    }
    next();
});

module.exports = mongoose.model('Call', callSchema);
