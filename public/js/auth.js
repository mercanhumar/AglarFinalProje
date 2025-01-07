// Handle login form submission
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('https://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    // Store token and user info
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.user.username);
    localStorage.setItem('userId', data.user._id);

    // Redirect to index.html
    window.location.href = 'https://localhost:3000/index.html';
  } catch (error) {
    console.error('Login error:', error);
    alert(error.message || 'Login failed');
  }
});

// Handle registration form submission
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('regUsername').value;
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (password !== confirmPassword) {
    alert('Passwords do not match');
    return;
  }

  try {
    const response = await fetch('https://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    alert('Registration successful! Please login.');
    window.location.href = 'https://localhost:3000/login.html';
  } catch (error) {
    console.error('Registration error:', error);
    alert(error.message || 'Registration failed');
  }
});

// Check if user is logged in
function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'https://localhost:3000/login.html';
  }
  return token;
}

// Handle logout
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('userId');
  window.location.href = 'https://localhost:3000/login.html';
}

// 2FA Settings Management
class TwoFactorAuth {
  constructor() {
    this.settingsButton = document.getElementById('settings-button');
    this.settingsModal = document.getElementById('settings-modal');
    this.closeSettingsBtn = document.getElementById('close-settings');
    this.saveSettingsBtn = document.getElementById('save-settings');
    this.twoFAToggle = document.getElementById('2fa-toggle');
    this.twoFASetup = document.getElementById('2fa-setup');
    this.qrCodeImg = document.getElementById('qr-code-img');
    this.verificationInput = document.getElementById('2fa-code');
    
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // Show/Hide Settings Modal
    this.settingsButton?.addEventListener('click', () => {
      this.settingsModal.style.display = 'block';
      this.loadUserSettings();
    });

    this.closeSettingsBtn?.addEventListener('click', () => {
      this.settingsModal.style.display = 'none';
      this.twoFASetup.style.display = 'none';
      this.verificationInput.value = '';
    });

    // Handle 2FA toggle
    this.twoFAToggle?.addEventListener('change', () => this.handleTwoFAToggle());

    // Save settings
    this.saveSettingsBtn?.addEventListener('click', () => this.saveSettings());
  }

  async loadUserSettings() {
    try {
      const token = checkAuth();
      const response = await fetch('https://localhost:3000/api/auth/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      this.twoFAToggle.checked = data.twoFactorEnabled;
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async handleTwoFAToggle() {
    if (this.twoFAToggle.checked) {
      try {
        const token = checkAuth();
        const response = await fetch('https://localhost:3000/api/auth/2fa/setup', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        
        this.qrCodeImg.src = data.qrCodeUrl;
        this.twoFASetup.style.display = 'block';
      } catch (error) {
        console.error('Error setting up 2FA:', error);
        this.twoFAToggle.checked = false;
      }
    } else {
      this.twoFASetup.style.display = 'none';
    }
  }

  async saveSettings() {
    const token = checkAuth();
    
    if (this.twoFAToggle.checked && this.verificationInput.value) {
      try {
        const response = await fetch('https://localhost:3000/api/auth/2fa/verify', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            code: this.verificationInput.value
          })
        });
        
        if (response.ok) {
          alert('Two-factor authentication enabled successfully!');
          this.settingsModal.style.display = 'none';
          this.twoFASetup.style.display = 'none';
          this.verificationInput.value = '';
        } else {
          alert('Invalid verification code. Please try again.');
        }
      } catch (error) {
        console.error('Error verifying 2FA:', error);
        alert('Error enabling two-factor authentication. Please try again.');
      }
    } else if (!this.twoFAToggle.checked) {
      try {
        await fetch('https://localhost:3000/api/auth/2fa/disable', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        alert('Two-factor authentication disabled successfully!');
        this.settingsModal.style.display = 'none';
      } catch (error) {
        console.error('Error disabling 2FA:', error);
        alert('Error disabling two-factor authentication. Please try again.');
      }
    }
  }
}

// Initialize 2FA settings if on main page
if (document.getElementById('settings-button')) {
  new TwoFactorAuth();
}
