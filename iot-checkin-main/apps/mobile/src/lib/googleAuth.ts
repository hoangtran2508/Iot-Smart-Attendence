import { Platform } from 'react-native';

const GOOGLE_CLIENT_ID = '641690281436-3saqne3mu42lr5krpng391nb4enj9gcn.apps.googleusercontent.com';

/**
 * Cross-platform Google Sign-In helper.
 * - Web: uses Google Identity Services (GSI) API loaded via script tag.
 * - Native (iOS/Android): uses @react-native-google-signin/google-signin.
 */
export async function signInWithGoogle(): Promise<string> {
  if (Platform.OS === 'web') {
    return signInWithGoogleWeb();
  } else {
    return signInWithGoogleNative();
  }
}

export async function signOutGoogle(): Promise<void> {
  if (Platform.OS !== 'web') {
    try {
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      await GoogleSignin.signOut();
    } catch (_) {
      // Ignore if not signed in with Google
    }
  }
}

// --- Web implementation using Google Identity Services ---

function signInWithGoogleWeb(): Promise<string> {
  return new Promise((resolve, reject) => {
    const google = (window as any).google;
    if (!google?.accounts?.id) {
      reject(new Error('Google Sign-In is not loaded. Please refresh and try again.'));
      return;
    }

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: any) => {
        if (response.credential) {
          resolve(response.credential);
        } else {
          reject(new Error('Google Sign-In failed: no credential returned.'));
        }
      },
    });

    // Show the One Tap prompt
    google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // If One Tap doesn't show (e.g. user dismissed before), 
        // fall back to rendering a temporary button
        showGooglePopup(google, resolve, reject);
      }
    });
  });
}

function showGooglePopup(google: any, resolve: (token: string) => void, reject: (err: Error) => void): void {
  // Create a temporary container for the Google button
  const container = document.createElement('div');
  container.id = 'google-signin-popup';
  Object.assign(container.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '99999',
  });

  const inner = document.createElement('div');
  Object.assign(inner.style, {
    backgroundColor: '#18181b',
    padding: '32px',
    borderRadius: '16px',
    border: '1px solid #27272a',
    textAlign: 'center',
  });

  const title = document.createElement('p');
  title.textContent = 'Sign in with Google';
  Object.assign(title.style, { color: '#fafafa', marginBottom: '16px', fontSize: '16px' });
  inner.appendChild(title);

  const btnContainer = document.createElement('div');
  btnContainer.id = 'google-btn-render';
  inner.appendChild(btnContainer);

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  Object.assign(cancelBtn.style, {
    marginTop: '16px',
    color: '#a1a1aa',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
  });
  cancelBtn.onclick = () => {
    document.body.removeChild(container);
    reject(new Error('Google Sign-In cancelled.'));
  };
  inner.appendChild(cancelBtn);

  container.appendChild(inner);
  // Close on backdrop click
  container.onclick = (e) => {
    if (e.target === container) {
      document.body.removeChild(container);
      reject(new Error('Google Sign-In cancelled.'));
    }
  };
  document.body.appendChild(container);

  // Reinitialize with callback that cleans up
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response: any) => {
      if (document.getElementById('google-signin-popup')) {
        document.body.removeChild(container);
      }
      if (response.credential) {
        resolve(response.credential);
      } else {
        reject(new Error('Google Sign-In failed.'));
      }
    },
  });

  google.accounts.id.renderButton(btnContainer, {
    theme: 'filled_black',
    size: 'large',
    width: 280,
    shape: 'pill',
  });
}

// --- Native implementation ---

async function signInWithGoogleNative(): Promise<string> {
  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');

  GoogleSignin.configure({
    webClientId: GOOGLE_CLIENT_ID,
  });

  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  const idToken = response.data?.idToken;

  if (!idToken) {
    throw new Error('Failed to get Google ID token');
  }

  return idToken;
}
