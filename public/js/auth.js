// Handle login form submission
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('/api/auth/login', {
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

    // Store token
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.user.username);
    localStorage.setItem('userId', data.user.id);

    // Redirect to chat
    window.location.href = '/chat';
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
    const response = await fetch('/api/auth/register', {
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

    // Store token
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.user.username);
    localStorage.setItem('userId', data.user.id);

    // Redirect to chat
    window.location.href = '/chat';
  } catch (error) {
    console.error('Registration error:', error);
    alert(error.message || 'Registration failed');
  }
});
