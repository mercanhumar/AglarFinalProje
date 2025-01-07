const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
    caller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date
    },
    status: {
        type: String,
        enum: ['initiated', 'ringing', 'connected', 'ended', 'missed', 'rejected'],
        default: 'initiated'
    },
    duration: {
        type: Number,
        default: 0
    }, // in seconds
    quality: {
        type: {
            audioQuality: {
                type: Number,
                min: 0,
                max: 100
            },
            jitter: {
                type: Number,
                default: 0
            },
            packetLoss: {
                type: Number,
                default: 0
            }
        },
        default: {}
    },
    terminationReason: {
        type: String,
        enum: ['completed', 'caller_ended', 'recipient_ended', 'network_error', 'timeout', 'rejected'],
        required: function() {
            return this.status === 'ended' || this.status === 'rejected';
        }
    }
}, {
    timestamps: true
});

// Calculate call duration before saving
callSchema.pre('save', function(next) {
    if (this.endTime && this.startTime) {
        this.duration = Math.floor((this.endTime - this.startTime) / 1000);
    }
    next();
});

// Static method to get call history for a user
callSchema.statics.getUserCallHistory = async function(userId, limit = 50, skip = 0) {
    return this.find({
        $or: [
            { caller: userId },
            { recipient: userId }
        ]
    })
    .sort({ startTime: -1 })
    .skip(skip)
    .limit(limit)
    .populate('caller', 'username')
    .populate('recipient', 'username');
};

// Method to update call quality metrics
callSchema.methods.updateQualityMetrics = async function(metrics) {
    this.quality = {
        ...this.quality,
        ...metrics
    };
    return await this.save();
};

// Method to end the call
callSchema.methods.endCall = async function(reason) {
    this.status = 'ended';
    this.endTime = new Date();
    this.terminationReason = reason;
    return await this.save();
};

// Method to get call duration in human readable format
callSchema.methods.getFormattedDuration = function() {
    if (!this.duration) return '0s';
    
    const hours = Math.floor(this.duration / 3600);
    const minutes = Math.floor((this.duration % 3600) / 60);
    const seconds = this.duration % 60;
    
    let formatted = '';
    if (hours > 0) formatted += `${hours}h `;
    if (minutes > 0) formatted += `${minutes}m `;
    formatted += `${seconds}s`;
    
    return formatted.trim();
};

const Call = mongoose.model('Call', callSchema);
module.exports = Call;
