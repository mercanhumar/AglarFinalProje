const User = require('../models/User');
const SecurityService = require('../services/security');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { generate2FASecret, verify2FAToken, generateQRCode } = require('./twoFactorAuth');

class UserController {
    constructor(io) {
        this.io = io;
        this.activeUsers = new Map(); // userId -> socketId
        this.securityService = new SecurityService();
        console.log('UserController initialized');
    }

    // Handle user registration
    async register(userData) {
        try {
            console.log('Starting user registration process:', { username: userData.username, email: userData.email });
            const { username, email, password } = userData;

            // Check if user already exists
            const existingUser = await User.findOne({ 
                $or: [{ username }, { email }] 
            });

            if (existingUser) {
                console.warn('Registration failed: User already exists:', { username, email });
                throw new Error('Username or email already exists');
            }

            // Hash password
            console.log('Hashing password for new user');
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user
            const user = new User({
                username,
                email,
                password: hashedPassword
            });

            // Generate encryption keys
            console.log('Generating encryption keys for user:', user._id);
            await this.securityService.generateUserKeys(user._id);

            // Save user
            await user.save();
            console.log('User successfully registered:', { userId: user._id, username });

            return user;
        } catch (error) {
            console.error('Error registering user:', error);
            throw error;
        }
    }

    // Handle user login
    async login(credentials) {
        try {
            console.log('Starting user login process:', { username: credentials.username });
            const { username, password } = credentials;

            // Find user
            const user = await User.findOne({ username });
            if (!user) {
                console.warn('Login failed: User not found:', { username });
                throw new Error('User not found');
            }

            // Verify password
            console.log('Verifying password for user:', user._id);
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                console.warn('Login failed: Invalid password:', { username });
                throw new Error('Invalid password');
            }

            // Generate JWT token
            console.log('Generating JWT token for user:', user._id);
            const token = jwt.sign(
                { userId: user._id, username: user.username },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            console.log('User successfully logged in:', { userId: user._id, username });
            return { user, token };
        } catch (error) {
            console.error('Error logging in:', error);
            throw error;
        }
    }

    // Handle user logout
    async logout(userId) {
        try {
            console.log('Starting user logout process:', { userId });
            // Update user status
            await User.findByIdAndUpdate(userId, { isOnline: false });
            console.log('User successfully logged out:', { userId });

            // Notify other users
            const socketId = this.activeUsers.get(userId);
            if (socketId) {
                this.io.emit('user_status', {
                    userId,
                    status: 'offline'
                });
                this.activeUsers.delete(userId);
            }
        } catch (error) {
            console.error('Error logging out:', error);
            throw error;
        }
    }

    // Handle 2FA setup
    async setup2FA(userId) {
        try {
            console.log('Starting 2FA setup process for user:', userId);
            const user = await User.findById(userId);
            if (!user) {
                console.warn('2FA setup failed: User not found:', { userId });
                throw new Error('User not found');
            }

            // Generate 2FA secret
            console.log('Generating 2FA secret for user:', userId);
            const { base32: secret, otpauth_url } = generate2FASecret();
            
            // Generate QR code
            console.log('Generating QR code for user:', userId);
            const qrCode = await generateQRCode(otpauth_url);

            // Save secret to user
            user.twoFactorSecret = secret;
            user.twoFactorEnabled = false; // Not enabled until verified
            await user.save();
            console.log('2FA setup successfully completed for user:', userId);

            return { secret, qrCode };
        } catch (error) {
            console.error('Error setting up 2FA:', error);
            throw error;
        }
    }

    // Verify and enable 2FA
    async verify2FA(userId, token) {
        try {
            console.log('Starting 2FA verification process for user:', userId);
            const user = await User.findById(userId);
            if (!user || !user.twoFactorSecret) {
                console.warn('2FA verification failed: Invalid user or 2FA not set up:', { userId });
                throw new Error('Invalid user or 2FA not set up');
            }

            console.log('Verifying 2FA token for user:', userId);
            const isValid = verify2FAToken(user.twoFactorSecret, token);
            if (!isValid) {
                console.warn('2FA verification failed: Invalid token:', { userId });
                throw new Error('Invalid 2FA token');
            }

            user.twoFactorEnabled = true;
            await user.save();
            console.log('2FA successfully enabled for user:', userId);

            return true;
        } catch (error) {
            console.error('Error verifying 2FA:', error);
            throw error;
        }
    }

    // Get user profile
    async getProfile(userId) {
        try {
            console.log('Starting user profile retrieval process for user:', userId);
            const user = await User.findById(userId).select('-password -twoFactorSecret');
            if (!user) {
                console.warn('User profile retrieval failed: User not found:', { userId });
                throw new Error('User not found');
            }
            console.log('User profile successfully retrieved for user:', userId);
            return user;
        } catch (error) {
            console.error('Error getting user profile:', error);
            throw error;
        }
    }

    // Update user profile
    async updateProfile(userId, updates) {
        try {
            console.log('Starting user profile update process for user:', userId);
            const allowedUpdates = ['username', 'email', 'avatar'];
            const updateData = {};

            Object.keys(updates).forEach(key => {
                if (allowedUpdates.includes(key)) {
                    updateData[key] = updates[key];
                }
            });

            const user = await User.findByIdAndUpdate(
                userId,
                updateData,
                { new: true, runValidators: true }
            ).select('-password -twoFactorSecret');
            console.log('User profile successfully updated for user:', userId);
            return user;
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }
    }

    // Get user contacts
    async getContacts(userId) {
        try {
            console.log('Starting user contacts retrieval process for user:', userId);
            const user = await User.findById(userId)
                .populate('contacts', 'username email avatar isOnline lastSeen')
                .select('contacts');
            console.log('User contacts successfully retrieved for user:', userId);
            return user.contacts;
        } catch (error) {
            console.error('Error getting user contacts:', error);
            throw error;
        }
    }

    // Add contact
    async addContact(userId, contactId) {
        try {
            console.log('Starting contact addition process for user:', userId);
            const user = await User.findById(userId);
            const contact = await User.findById(contactId);

            if (!user || !contact) {
                console.warn('Contact addition failed: User or contact not found:', { userId, contactId });
                throw new Error('User or contact not found');
            }

            if (user.contacts.includes(contactId)) {
                console.warn('Contact addition failed: Contact already added:', { userId, contactId });
                throw new Error('Contact already added');
            }

            user.contacts.push(contactId);
            await user.save();
            console.log('Contact successfully added for user:', userId);
            return contact;
        } catch (error) {
            console.error('Error adding contact:', error);
            throw error;
        }
    }

    // Remove contact
    async removeContact(userId, contactId) {
        try {
            console.log('Starting contact removal process for user:', userId);
            const user = await User.findById(userId);
            if (!user) {
                console.warn('Contact removal failed: User not found:', { userId });
                throw new Error('User not found');
            }

            user.contacts = user.contacts.filter(id => id.toString() !== contactId);
            await user.save();
            console.log('Contact successfully removed for user:', userId);
            return true;
        } catch (error) {
            console.error('Error removing contact:', error);
            throw error;
        }
    }

    // Handle socket connection
    handleConnection(socket) {
        const userId = socket.user.userId;
        this.activeUsers.set(userId, socket.id);

        // Update user status
        console.log('Updating user status for user:', userId);
        User.findByIdAndUpdate(userId, { 
            isOnline: true,
            lastSeen: new Date()
        }).catch(error => {
            console.error('Error updating user status:', error);
        });

        // Notify contacts that user is online
        console.log('Notifying contacts that user is online:', userId);
        this.io.emit('user_status', {
            userId,
            status: 'online'
        });
    }

    // Handle socket disconnection
    handleDisconnect(socket) {
        const userId = socket.user.userId;
        this.activeUsers.delete(userId);

        // Update user status
        console.log('Updating user status for user:', userId);
        User.findByIdAndUpdate(userId, { 
            isOnline: false,
            lastSeen: new Date()
        }).catch(error => {
            console.error('Error updating user status:', error);
        });

        // Notify contacts that user is offline
        console.log('Notifying contacts that user is offline:', userId);
        this.io.emit('user_status', {
            userId,
            status: 'offline'
        });
    }
}

module.exports = UserController;
