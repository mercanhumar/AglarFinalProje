// DOM Elements
const settingsButton = document.getElementById('settings-button');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const saveSettingsBtn = document.getElementById('save-settings');
const twoFAToggle = document.getElementById('2fa-toggle');
const twoFASetup = document.getElementById('2fa-setup');
const qrCodeImg = document.getElementById('qr-code-img');
const verificationInput = document.getElementById('2fa-code');

// Show/Hide Settings Modal
settingsButton.addEventListener('click', () => {
    settingsModal.style.display = 'block';
    loadUserSettings();
});

closeSettingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'none';
    twoFASetup.style.display = 'none';
    verificationInput.value = '';
});

// Load user settings
async function loadUserSettings() {
    try {
        const response = await fetch('/api/auth/settings', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        
        twoFAToggle.checked = data.twoFactorEnabled;
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Handle 2FA toggle
twoFAToggle.addEventListener('change', async () => {
    if (twoFAToggle.checked) {
        try {
            const response = await fetch('/api/auth/2fa/setup', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            
            qrCodeImg.src = data.qrCodeUrl;
            twoFASetup.style.display = 'block';
        } catch (error) {
            console.error('Error setting up 2FA:', error);
            twoFAToggle.checked = false;
        }
    } else {
        twoFASetup.style.display = 'none';
    }
});

// Save settings
saveSettingsBtn.addEventListener('click', async () => {
    if (twoFAToggle.checked && verificationInput.value) {
        try {
            const response = await fetch('/api/auth/2fa/verify', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    code: verificationInput.value
                })
            });
            
            if (response.ok) {
                alert('Two-factor authentication enabled successfully!');
                settingsModal.style.display = 'none';
                twoFASetup.style.display = 'none';
                verificationInput.value = '';
            } else {
                alert('Invalid verification code. Please try again.');
            }
        } catch (error) {
            console.error('Error verifying 2FA:', error);
            alert('Error enabling two-factor authentication. Please try again.');
        }
    } else if (!twoFAToggle.checked) {
        try {
            await fetch('/api/auth/2fa/disable', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            alert('Two-factor authentication disabled successfully!');
            settingsModal.style.display = 'none';
        } catch (error) {
            console.error('Error disabling 2FA:', error);
            alert('Error disabling two-factor authentication. Please try again.');
        }
    }
});
