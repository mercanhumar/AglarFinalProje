const Message = require('../models/Message');
const User = require('../models/User');

class MessageController {
    constructor(io) {
        this.io = io;
        this.activeUsers = new Map(); // userId -> socketId
    }

    handleConnection(socket) {
        // Store user connection
        this.activeUsers.set(socket.user.userId, socket.id);

        // Handle private messages
        socket.on('private_message', async (data) => {
            try {
                const messageData = await this.handleMessage(socket, data);
                const { recipientId } = data;

                // Get recipient's socket
                const recipientSocketId = this.activeUsers.get(recipientId);
                if (recipientSocketId) {
                    const recipientSocket = this.io.sockets.sockets.get(recipientSocketId);
                    if (recipientSocket) {
                        // Send message to recipient
                        recipientSocket.emit('private_message', messageData);

                        // Update message status to delivered
                        const updatedMessage = await this.updateMessageStatus(messageData._id, 'delivered');
                        // Notify sender that message was delivered
                        socket.emit('message_status', {
                            messageId: updatedMessage._id,
                            status: 'delivered'
                        });
                    }
                }

                // Send confirmation to sender
                socket.emit('message_sent', messageData);

            } catch (error) {
                console.error('Error sending private message:', error);
                socket.emit('message_error', { 
                    error: 'Failed to send message',
                    details: error.message 
                });
            }
        });

        // Handle message seen status
        socket.on('message_seen', async (data) => {
            try {
                const { messageId } = data;
                const message = await Message.findById(messageId);
                
                if (message && message.receiver.toString() === socket.user.userId) {
                    const updatedMessage = await this.updateMessageStatus(messageId, 'seen');
                    // Notify sender that message was seen
                    const senderSocketId = this.activeUsers.get(message.sender.toString());
                    if (senderSocketId) {
                        const senderSocket = this.io.sockets.sockets.get(senderSocketId);
                        if (senderSocket) {
                            senderSocket.emit('message_status', {
                                messageId: updatedMessage._id,
                                status: 'seen'
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Error updating message seen status:', error);
            }
        });

        // Handle typing status
        socket.on('typing_status', (data) => {
            const { recipientId, isTyping } = data;
            const recipientSocketId = this.activeUsers.get(recipientId);
            
            if (recipientSocketId) {
                const recipientSocket = this.io.sockets.sockets.get(recipientSocketId);
                if (recipientSocket) {
                    recipientSocket.emit('typing_status', {
                        userId: socket.user.userId,
                        isTyping
                    });
                }
            }
        });

        // Handle message deletion
        socket.on('delete_message', async (data) => {
            try {
                const { messageId } = data;
                const message = await Message.findById(messageId);
                
                if (message && message.sender.toString() === socket.user.userId) {
                    await message.remove();

                    // Notify recipient about message deletion
                    const recipientSocketId = this.activeUsers.get(message.receiver.toString());
                    if (recipientSocketId) {
                        const recipientSocket = this.io.sockets.sockets.get(recipientSocketId);
                        if (recipientSocket) {
                            recipientSocket.emit('message_deleted', {
                                messageId: message._id
                            });
                        }
                    }

                    // Confirm deletion to sender
                    socket.emit('message_deleted', {
                        messageId: message._id
                    });
                }
            } catch (error) {
                console.error('Error deleting message:', error);
                socket.emit('message_error', { 
                    error: 'Failed to delete message',
                    details: error.message 
                });
            }
        });
    }

    handleDisconnect(socket) {
        this.activeUsers.delete(socket.user.userId);
    }

    async handleMessage(socket, data) {
        try {
            const { recipientId, content } = data;

            // Create and save message
            const message = new Message({
                sender: socket.user.userId,
                receiver: recipientId,
                content: content,
                status: 'sent'
            });

            await message.save();
            await message.populate('sender', 'username');
            await message.populate('receiver', 'username');

            return message;
        } catch (error) {
            console.error('Error handling message:', error);
            throw error;
        }
    }

    async getConversationHistory(userId1, userId2) {
        try {
            const messages = await Message.getConversation(userId1, userId2);
            return messages;
        } catch (error) {
            console.error('Error getting conversation history:', error);
            throw error;
        }
    }

    async updateMessageStatus(messageId, status) {
        try {
            const message = await Message.findByIdAndUpdate(
                messageId,
                { status },
                { new: true }
            ).populate('sender', 'username')
             .populate('receiver', 'username');
            
            return message;
        } catch (error) {
            console.error('Error updating message status:', error);
            throw error;
        }
    }

    // Get recent conversations
    async getRecentConversations(userId, limit = 20) {
        try {
            const recentMessages = await Message.aggregate([
                {
                    $match: {
                        $or: [
                            { sender: mongoose.Types.ObjectId(userId) },
                            { receiver: mongoose.Types.ObjectId(userId) }
                        ]
                    }
                },
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: {
                            $cond: {
                                if: { $eq: ["$sender", mongoose.Types.ObjectId(userId)] },
                                then: "$receiver",
                                else: "$sender"
                            }
                        },
                        lastMessage: { $first: "$$ROOT" }
                    }
                },
                { $limit: limit }
            ]);

            return Message.populate(recentMessages, [
                { path: 'lastMessage.sender', select: 'username isOnline' },
                { path: 'lastMessage.receiver', select: 'username isOnline' }
            ]);
        } catch (error) {
            console.error('Error getting recent conversations:', error);
            throw error;
        }
    }
}

module.exports = MessageController;
